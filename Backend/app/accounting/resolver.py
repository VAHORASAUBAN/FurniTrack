"""Account resolution — design doc §3.1.

Two distinct resolution needs, handled separately:
  * Document LINE accounts (income/expense) are resolved once, when a line
    is first created — `document_line.account_id` is NOT NULL, so by the
    time a line reaches the engine its account is already settled. The
    `resolve_line_account_id` chain below is what a document service calls
    at create time, not something the engine re-derives at posting time.
  * Counterparty accounts (Debtors, Creditors, Bank/Cash, Tax) are never
    stored on the document or payment at all — the engine resolves these
    fresh from `company_setting` (and the posting journal) every time it
    builds a journal entry, which is why they live here rather than on a model.
"""
from sqlalchemy.orm import Session

from app.core.exceptions import PostingError
from app.models import CompanySetting, Journal, Product


def resolve_line_account_id(line_account_id: int | None, product: Product | None, *, is_purchase: bool) -> int:
    """Design doc §3.1 resolution chain, steps 1-2: whatever the user
    explicitly picked on the line wins; otherwise fall back to the
    product's configured income/expense account. Raises if neither
    resolves — a line can never post with no account at all."""
    if line_account_id is not None:
        return line_account_id
    if product is not None:
        fallback = product.expense_account_id if is_purchase else product.income_account_id
        if fallback is not None:
            return fallback
    raise PostingError(
        "This line has no account, and its product has no default account configured.",
        code="MISSING_CONFIG",
    )


def get_company_settings(db: Session) -> CompanySetting:
    settings = db.get(CompanySetting, 1)
    if settings is None:
        raise PostingError("Company settings have not been configured.", code="MISSING_CONFIG")
    return settings


def resolve_receivable_account_id(settings: CompanySetting) -> int:
    if settings.receivable_account_id is None:
        raise PostingError(
            "No receivable (Debtors) account is configured in company settings.", code="MISSING_CONFIG"
        )
    return settings.receivable_account_id


def resolve_payable_account_id(settings: CompanySetting) -> int:
    if settings.payable_account_id is None:
        raise PostingError(
            "No payable (Creditors) account is configured in company settings.", code="MISSING_CONFIG"
        )
    return settings.payable_account_id


def resolve_output_tax_account_id(settings: CompanySetting) -> int:
    if settings.output_tax_account_id is None:
        raise PostingError("No output tax account is configured in company settings.", code="MISSING_CONFIG")
    return settings.output_tax_account_id


def resolve_input_tax_account_id(settings: CompanySetting) -> int:
    if settings.input_tax_account_id is None:
        raise PostingError("No input tax account is configured in company settings.", code="MISSING_CONFIG")
    return settings.input_tax_account_id


def resolve_payment_account_id(journal: Journal) -> int:
    """The Bank/Cash account a payment debits or credits, resolved from the
    journal the payment posts through (design doc §3.2 Bill/Invoice Payment)."""
    if journal.default_account_id is None:
        raise PostingError(f"Journal {journal.code!r} has no default account configured.", code="MISSING_CONFIG")
    return journal.default_account_id
