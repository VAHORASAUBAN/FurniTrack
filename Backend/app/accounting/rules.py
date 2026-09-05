"""Posting rules — design doc §3.2. Each `build_*` function takes an
already-resolved domain object (a Document or Payment) plus the company
settings, and returns the list of journal-entry-line specs to create. Pure:
no DB writes, no session use beyond what's already loaded on the objects
passed in — `engine.build_entry()` is what actually inserts rows.

Partner is stamped on the receivable/payable line so the ledger can be aged
by contact. Analytic is copied from the document line onto the matching
income/expense line, which is what powers the budget report (design doc §4.3).
"""
from decimal import Decimal

from app.accounting import resolver
from app.models import CompanySetting, Document, Payment
from app.models.enums import DocType, PaymentType


def _line(
    account_id: int,
    *,
    debit: Decimal = Decimal("0"),
    credit: Decimal = Decimal("0"),
    partner_id: int | None = None,
    analytic_account_id: int | None = None,
    label: str | None = None,
) -> dict:
    return {
        "account_id": account_id,
        "debit": debit,
        "credit": credit,
        "partner_id": partner_id,
        "analytic_account_id": analytic_account_id,
        "label": label,
    }


def build_vendor_bill_lines(document: Document, settings: CompanySetting) -> list[dict]:
    """Design doc §3.2 Vendor Bill:
    Dr expense account (per line) + Dr input tax (if any) / Cr Creditors (total)."""
    lines = [
        _line(
            dl.account_id,
            debit=dl.subtotal,
            analytic_account_id=dl.analytic_account_id,
            label=f"{document.doc_number} — {dl.description}" if dl.description else document.doc_number,
        )
        for dl in document.lines
    ]
    if document.tax_amount > 0:
        lines.append(
            _line(
                resolver.resolve_input_tax_account_id(settings),
                debit=document.tax_amount,
                label=f"{document.doc_number} — input tax",
            )
        )
    lines.append(
        _line(
            resolver.resolve_payable_account_id(settings),
            credit=document.total_amount,
            partner_id=document.partner_id,
            label=document.doc_number,
        )
    )
    return lines


def build_customer_invoice_lines(document: Document, settings: CompanySetting) -> list[dict]:
    """Design doc §3.2 Customer Invoice:
    Dr Debtors (total) / Cr income account (per line) + Cr output tax (if any)."""
    lines = [
        _line(
            resolver.resolve_receivable_account_id(settings),
            debit=document.total_amount,
            partner_id=document.partner_id,
            label=document.doc_number,
        )
    ]
    for dl in document.lines:
        lines.append(
            _line(
                dl.account_id,
                credit=dl.subtotal,
                analytic_account_id=dl.analytic_account_id,
                label=f"{document.doc_number} — {dl.description}" if dl.description else document.doc_number,
            )
        )
    if document.tax_amount > 0:
        lines.append(
            _line(
                resolver.resolve_output_tax_account_id(settings),
                credit=document.tax_amount,
                label=f"{document.doc_number} — output tax",
            )
        )
    return lines


def build_document_lines(document: Document, settings: CompanySetting) -> list[dict]:
    """Dispatches by doc_type. Purchase/Sales Orders never reach here — they
    don't post to the ledger at all (design doc §3.2, PO/SO section)."""
    if document.doc_type == DocType.VENDOR_BILL:
        return build_vendor_bill_lines(document, settings)
    if document.doc_type == DocType.CUSTOMER_INVOICE:
        return build_customer_invoice_lines(document, settings)
    raise ValueError(
        f"{document.doc_type.value} does not post to the ledger — only Vendor Bill and "
        f"Customer Invoice do (design doc §3.2)."
    )


def build_bill_payment_lines(payment: Payment, settings: CompanySetting) -> list[dict]:
    """Design doc §3.2 Bill Payment: Dr Creditors / Cr Bank-or-Cash."""
    bank_or_cash_id = resolver.resolve_payment_account_id(payment.journal)
    return [
        _line(
            resolver.resolve_payable_account_id(settings),
            debit=payment.amount,
            partner_id=payment.partner_id,
            label=payment.payment_number,
        ),
        _line(bank_or_cash_id, credit=payment.amount, label=payment.payment_number),
    ]


def build_invoice_payment_lines(payment: Payment, settings: CompanySetting) -> list[dict]:
    """Design doc §3.2 Invoice Payment: Dr Bank-or-Cash / Cr Debtors."""
    bank_or_cash_id = resolver.resolve_payment_account_id(payment.journal)
    return [
        _line(bank_or_cash_id, debit=payment.amount, label=payment.payment_number),
        _line(
            resolver.resolve_receivable_account_id(settings),
            credit=payment.amount,
            partner_id=payment.partner_id,
            label=payment.payment_number,
        ),
    ]


def build_payment_lines(payment: Payment, settings: CompanySetting) -> list[dict]:
    """Dispatches by payment_type: SEND pays a vendor bill, RECEIVE collects
    a customer invoice (design doc §3.2's two Payment rows)."""
    if payment.payment_type == PaymentType.SEND:
        return build_bill_payment_lines(payment, settings)
    return build_invoice_payment_lines(payment, settings)
