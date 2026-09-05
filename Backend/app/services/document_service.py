"""Document (PO / Vendor Bill / SO / Customer Invoice) service — design doc
§2.2, §3.2, §3.5. This is the one place that computes line and header
totals — the client never sends them (design doc §7.5) — and the one place
that decides which journal a document posts through (fixed by doc_type,
per the wireframe's "bill journal would always be Purchase" note, not
user-selectable).
"""
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.accounting import engine, resolver, rules, sequence, validators
from app.core.exceptions import ConflictError, NotFoundError
from app.models import Document, DocumentLine, JournalEntry, Product
from app.models.enums import DocStatus, DocType, JournalEntrySourceType

TWO_PLACES = Decimal("0.01")

_PURCHASE_TYPES = {DocType.PURCHASE_ORDER, DocType.VENDOR_BILL}
_JOURNAL_ENTRY_SOURCE_BY_DOC_TYPE = {
    DocType.VENDOR_BILL: JournalEntrySourceType.VENDOR_BILL,
    DocType.CUSTOMER_INVOICE: JournalEntrySourceType.CUSTOMER_INVOICE,
}


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def _resolve_default_journal_id(db: Session, doc_type: DocType) -> int | None:
    settings = resolver.get_company_settings(db)
    return settings.purchase_journal_id if doc_type in _PURCHASE_TYPES else settings.sales_journal_id


def _build_lines(db: Session, doc_type: DocType, line_inputs: list[dict]) -> list[DocumentLine]:
    is_purchase = doc_type in _PURCHASE_TYPES
    validators.validate_document_lines([
        {"quantity": li["quantity"], "unit_price": li["unit_price"], "tax_rate": li["tax_rate"]}
        for li in line_inputs
    ])

    lines = []
    for i, li in enumerate(line_inputs, start=1):
        product = db.get(Product, li["product_id"]) if li.get("product_id") else None
        account_id = resolver.resolve_line_account_id(li.get("account_id"), product, is_purchase=is_purchase)

        subtotal = _quantize(li["quantity"] * li["unit_price"])
        tax_amount = _quantize(subtotal * li["tax_rate"] / Decimal("100"))
        lines.append(DocumentLine(
            line_no=i,
            product_id=li.get("product_id"),
            account_id=account_id,
            analytic_account_id=li.get("analytic_account_id"),
            description=li.get("description"),
            quantity=li["quantity"],
            unit_price=li["unit_price"],
            tax_rate=li["tax_rate"],
            tax_amount=tax_amount,
            subtotal=subtotal,
            total=subtotal + tax_amount,
        ))
    return lines


def create_document(db: Session, doc_type: DocType, data: dict, *, created_by_user_id: int) -> Document:
    lines = _build_lines(db, doc_type, data["lines"])

    document = Document(
        doc_type=doc_type,
        doc_number=sequence.next_number(db, doc_type.value),
        partner_id=data["partner_id"],
        journal_id=_resolve_default_journal_id(db, doc_type),
        doc_date=data["doc_date"],
        due_date=data.get("due_date"),
        reference=data.get("reference"),
        status=DocStatus.DRAFT,
        notes=data.get("notes"),
        created_by=created_by_user_id,
        untaxed_amount=sum((l.subtotal for l in lines), Decimal("0")),
        tax_amount=sum((l.tax_amount for l in lines), Decimal("0")),
        total_amount=sum((l.total for l in lines), Decimal("0")),
    )
    document.lines = lines
    db.add(document)
    db.flush()
    return document


def update_document(db: Session, document: Document, data: dict) -> Document:
    if document.status != DocStatus.DRAFT:
        raise ConflictError("Only a draft document can be edited.", code="NOT_DRAFT")

    line_inputs = data.pop("lines", None)
    for key, value in data.items():
        setattr(document, key, value)

    if line_inputs is not None:
        document.lines.clear()
        db.flush()
        document.lines = _build_lines(db, document.doc_type, line_inputs)
        document.untaxed_amount = sum((l.subtotal for l in document.lines), Decimal("0"))
        document.tax_amount = sum((l.tax_amount for l in document.lines), Decimal("0"))
        document.total_amount = sum((l.total for l in document.lines), Decimal("0"))
    db.flush()
    return document


def confirm_document(db: Session, document: Document) -> Document:
    """PO/SO only — no ledger posting (design doc §3.2's PO/SO section)."""
    validators.validate_not_already_posted(document.status, DocStatus.CONFIRMED)
    if document.status != DocStatus.DRAFT:
        raise ConflictError("Only a draft document can be confirmed.", code="NOT_DRAFT")
    document.status = DocStatus.CONFIRMED
    db.flush()
    return document


def cancel_draft_or_confirmed(db: Session, document: Document) -> Document:
    """PO/SO cancellation — these never posted, so there's nothing to
    reverse; a POSTED Bill/Invoice must go through `cancel_posted_document`."""
    if document.status not in (DocStatus.DRAFT, DocStatus.CONFIRMED):
        raise ConflictError("Only a draft or confirmed document can be cancelled this way.", code="INVALID_STATE")
    document.status = DocStatus.CANCELLED
    db.flush()
    return document


def create_bill_from_po(db: Session, po: Document, *, created_by_user_id: int) -> Document:
    if po.doc_type != DocType.PURCHASE_ORDER:
        raise ConflictError("Only a Purchase Order can be converted to a Vendor Bill.", code="INVALID_STATE")
    if po.status != DocStatus.CONFIRMED:
        raise ConflictError("The Purchase Order must be confirmed before creating a bill.", code="NOT_CONFIRMED")

    bill = Document(
        doc_type=DocType.VENDOR_BILL,
        doc_number=sequence.next_number(db, DocType.VENDOR_BILL.value),
        partner_id=po.partner_id,
        journal_id=_resolve_default_journal_id(db, DocType.VENDOR_BILL),
        source_document_id=po.id,
        doc_date=po.doc_date,
        status=DocStatus.DRAFT,
        created_by=created_by_user_id,
        untaxed_amount=po.untaxed_amount,
        tax_amount=po.tax_amount,
        total_amount=po.total_amount,
    )
    bill.lines = [
        DocumentLine(
            line_no=l.line_no, product_id=l.product_id, account_id=l.account_id,
            analytic_account_id=l.analytic_account_id, description=l.description,
            quantity=l.quantity, unit_price=l.unit_price, tax_rate=l.tax_rate,
            tax_amount=l.tax_amount, subtotal=l.subtotal, total=l.total,
        )
        for l in po.lines
    ]
    db.add(bill)
    db.flush()
    return bill


def create_invoice_from_so(db: Session, so: Document, *, created_by_user_id: int) -> Document:
    if so.doc_type != DocType.SALES_ORDER:
        raise ConflictError("Only a Sales Order can be converted to a Customer Invoice.", code="INVALID_STATE")
    if so.status != DocStatus.CONFIRMED:
        raise ConflictError("The Sales Order must be confirmed before creating an invoice.", code="NOT_CONFIRMED")

    invoice = Document(
        doc_type=DocType.CUSTOMER_INVOICE,
        doc_number=sequence.next_number(db, DocType.CUSTOMER_INVOICE.value),
        partner_id=so.partner_id,
        journal_id=_resolve_default_journal_id(db, DocType.CUSTOMER_INVOICE),
        source_document_id=so.id,
        doc_date=so.doc_date,
        status=DocStatus.DRAFT,
        created_by=created_by_user_id,
        untaxed_amount=so.untaxed_amount,
        tax_amount=so.tax_amount,
        total_amount=so.total_amount,
    )
    invoice.lines = [
        DocumentLine(
            line_no=l.line_no, product_id=l.product_id, account_id=l.account_id,
            analytic_account_id=l.analytic_account_id, description=l.description,
            quantity=l.quantity, unit_price=l.unit_price, tax_rate=l.tax_rate,
            tax_amount=l.tax_amount, subtotal=l.subtotal, total=l.total,
        )
        for l in so.lines
    ]
    db.add(invoice)
    db.flush()
    return invoice


def post_document(db: Session, document: Document, *, posted_by_user_id: int) -> Document:
    """Design doc §3.2 — only Vendor Bill / Customer Invoice reach the
    ledger. PO/SO calling this is a programming error, not a user-facing
    409, so it's an assertion rather than a ConflictError."""
    assert document.doc_type in _JOURNAL_ENTRY_SOURCE_BY_DOC_TYPE, "PO/SO do not post to the ledger"

    validators.validate_not_already_posted(document.status, DocStatus.POSTED)
    if document.status != DocStatus.DRAFT:
        raise ConflictError("Only a draft document can be posted.", code="NOT_DRAFT")

    settings = resolver.get_company_settings(db)
    line_specs = rules.build_document_lines(document, settings)

    entry = engine.build_entry(
        db,
        journal_id=document.journal_id,
        entry_date=document.doc_date,
        reference=document.doc_number,
        narration=f"Auto-posted on confirming {document.doc_number}.",
        source_type=_JOURNAL_ENTRY_SOURCE_BY_DOC_TYPE[document.doc_type],
        source_document_id=document.id,
        line_specs=line_specs,
    )
    engine.validate_and_post(db, entry, settings, posted_by_user_id=posted_by_user_id)

    document.status = DocStatus.POSTED
    db.flush()
    return document


def attach_balance(db: Session, document: Document) -> Document:
    """Reads `v_document_balance` (design doc §2.4) and stamps the result
    onto a transient (non-mapped) `.balance` attribute so `DocumentOut`'s
    `from_attributes` pickup finds it — the view has no ORM mapping of its
    own since it's read-only and derived, never written through."""
    row = db.execute(
        text("SELECT amount_paid, paid_via_cash, paid_via_bank, amount_due, payment_status "
             "FROM v_document_balance WHERE document_id = :id"),
        {"id": document.id},
    ).mappings().one_or_none()
    document.balance = dict(row) if row else None
    return document


def cancel_posted_document(db: Session, document: Document, *, cancelled_by_user_id: int) -> Document:
    """Reversal, not deletion (design doc §3.5) — finds the journal entry
    this document posted and reverses it, exactly like a manual entry's cancel."""
    if document.status != DocStatus.POSTED:
        raise ConflictError("Only a posted document can be cancelled.", code="NOT_POSTED")

    entry = db.query(JournalEntry).filter_by(source_document_id=document.id).one_or_none()
    if entry is None:
        raise NotFoundError("No journal entry found for this document.", code="NOT_FOUND")

    settings = resolver.get_company_settings(db)
    engine.reverse_entry(db, entry, settings, reversed_by_user_id=cancelled_by_user_id)

    document.status = DocStatus.CANCELLED
    db.flush()
    return document
