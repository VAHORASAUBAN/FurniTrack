"""The 17 blocking validators — design doc §3.4. Each raises `PostingError`
with a stable `code` on failure; a validator that returns normally means
that check passed. No DB writes here — these only read what's handed to
them, so every one is exercisable with plain Python objects in a test.

Rule 16 (MISSING_CONFIG) isn't a separate function here — it's raised
directly by `resolver.py`'s resolution functions at the point a required
account/journal turns out to be unconfigured, which is a more precise place
to raise it than a generic pre-check would be.

Grouped by what they validate: entry-level (every journal_entry_line, from
any source), document-level (PO/SO/Bill/Invoice lines), and payment-level.
"""
from datetime import date
from decimal import Decimal

from app.core.exceptions import PostingError
from app.models import AnalyticAccount, ChartOfAccount, CompanySetting, Contact

# ---------- entry-level: rules 1-9, apply to every posted journal entry ----------


def validate_lines_present(line_count: int) -> None:
    """Rule 5 — NO_LINES."""
    if line_count == 0:
        raise PostingError("An entry must have at least one line.", code="NO_LINES")


def validate_line_shape(lines: list[dict]) -> None:
    """Rules 2, 3, 4 — LINE_BOTH_SIDES, LINE_EMPTY, NEGATIVE_AMOUNT.
    Each item in `lines` needs "debit" and "credit" keys (Decimal)."""
    for i, line in enumerate(lines, start=1):
        debit, credit = line["debit"], line["credit"]
        if debit < 0 or credit < 0:
            raise PostingError(f"Line {i}: debit and credit cannot be negative.", code="NEGATIVE_AMOUNT")
        if debit > 0 and credit > 0:
            raise PostingError(f"Line {i}: a line cannot have both a debit and a credit.", code="LINE_BOTH_SIDES")
        if debit == 0 and credit == 0:
            raise PostingError(f"Line {i}: a line must have either a debit or a credit.", code="LINE_EMPTY")


def validate_balanced(total_debit: Decimal, total_credit: Decimal) -> None:
    """Rule 1 — UNBALANCED_ENTRY. Exact `Decimal` comparison, no epsilon —
    the wireframe's "blocking warning if debit and credit don't match"."""
    if total_debit != total_credit:
        difference = abs(total_debit - total_credit)
        raise PostingError(
            f"Total debit {total_debit} does not equal total credit {total_credit} "
            f"(difference {difference}).",
            code="UNBALANCED_ENTRY",
            details=[{
                "field": "lines",
                "total_debit": str(total_debit),
                "total_credit": str(total_credit),
                "difference": str(difference),
            }],
        )


def validate_accounts_active(accounts: list[ChartOfAccount]) -> None:
    """Rule 6 — ARCHIVED_ACCOUNT."""
    for account in accounts:
        if not account.is_active:
            raise PostingError(
                f"Account {account.code} ({account.name}) is archived and cannot be posted to.",
                code="ARCHIVED_ACCOUNT",
            )


def validate_partners_active(partners: list[Contact]) -> None:
    """Rule 7 — ARCHIVED_PARTNER."""
    for partner in partners:
        if not partner.is_active:
            raise PostingError(f"Contact {partner.name!r} is archived.", code="ARCHIVED_PARTNER")


def validate_analytics_active(analytics: list[AnalyticAccount]) -> None:
    """Rule 8 — ARCHIVED_ANALYTIC."""
    for analytic in analytics:
        if not analytic.is_active:
            raise PostingError(f"Analytic account {analytic.name!r} is archived.", code="ARCHIVED_ANALYTIC")


def validate_period_open(entry_date: date, settings: CompanySetting) -> None:
    """Rule 9 — PERIOD_LOCKED."""
    if settings.books_lock_date is not None and entry_date <= settings.books_lock_date:
        raise PostingError(
            f"{entry_date} falls on or before the books lock date ({settings.books_lock_date}).",
            code="PERIOD_LOCKED",
        )


def validate_not_already_posted(status, posted_value) -> None:
    """Rule 12 — ALREADY_POSTED. Works for any status enum (JournalEntry,
    Document, Payment) — pass that enum's POSTED member as `posted_value`."""
    if status == posted_value:
        raise PostingError("This has already been posted.", code="ALREADY_POSTED")


# ---------- document-level: rules 10, 11 — PO/SO/Bill/Invoice lines ----------


def validate_document_lines(lines: list[dict]) -> None:
    """Rules 10, 11 — INVALID_QUANTITY, NEGATIVE_PRICE. Each item needs
    "quantity", "unit_price", "tax_rate" keys (Decimal)."""
    for i, line in enumerate(lines, start=1):
        if line["quantity"] <= 0:
            raise PostingError(f"Line {i}: quantity must be greater than zero.", code="INVALID_QUANTITY")
        if line["unit_price"] < 0 or line["tax_rate"] < 0:
            raise PostingError(f"Line {i}: unit price and tax rate cannot be negative.", code="NEGATIVE_PRICE")


def validate_journal_type(actual, expected) -> None:
    """Rule 17 — WRONG_JOURNAL_TYPE. Pass the journal's actual JournalType
    and the JournalType the document/payment is required to post through."""
    if actual != expected:
        raise PostingError(
            f"This must post through a {expected.value} journal, not {actual.value}.",
            code="WRONG_JOURNAL_TYPE",
        )


# ---------- payment-level: rules 13, 14, 15 ----------


def validate_document_posted(status, posted_value) -> None:
    """Rule 15 — DOC_NOT_POSTED."""
    if status != posted_value:
        raise PostingError("You can only pay a document that has been posted.", code="DOC_NOT_POSTED")


def validate_allocation_within_document(amount_allocated: Decimal, amount_due: Decimal) -> None:
    """Rule 13 — OVER_ALLOCATION."""
    if amount_allocated > amount_due:
        raise PostingError(
            f"Allocated amount {amount_allocated} exceeds the outstanding balance {amount_due}.",
            code="OVER_ALLOCATION",
        )


def validate_allocation_within_payment(total_allocated: Decimal, payment_amount: Decimal) -> None:
    """Rule 14 — PAYMENT_EXCEEDS_AMOUNT."""
    if total_allocated > payment_amount:
        raise PostingError(
            f"Total allocated {total_allocated} exceeds the payment amount {payment_amount}.",
            code="PAYMENT_EXCEEDS_AMOUNT",
        )
