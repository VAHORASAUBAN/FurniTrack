"""Unit tests for all 17 blocking validators (design doc §3.4). Pure —
these construct plain (unpersisted) model instances and call `validators.py`
functions directly, no DB, no HTTP. This is exactly what §1's "no FastAPI,
no HTTP" design for the accounting engine buys: every rule here runs in
milliseconds.
"""
from datetime import date
from decimal import Decimal

import pytest

from app.accounting import validators
from app.core.exceptions import PostingError
from app.models import AnalyticAccount, ChartOfAccount, CompanySetting, Contact
from app.models.enums import AccountType, AnalyticType, ContactType, DocStatus, JournalEntryStatus, JournalType


def _account(**overrides):
    defaults = dict(code="X", name="Test Account", account_type=AccountType.EXPENSE, is_active=True)
    defaults.update(overrides)
    return ChartOfAccount(**defaults)


def _contact(**overrides):
    defaults = dict(name="Test Contact", contact_type=ContactType.VENDOR, is_active=True)
    defaults.update(overrides)
    return Contact(**defaults)


def _analytic(**overrides):
    defaults = dict(name="Test Analytic", analytic_type=AnalyticType.EXPENSE, is_active=True)
    defaults.update(overrides)
    return AnalyticAccount(**defaults)


# ---------- rule 5: NO_LINES ----------

def test_no_lines_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_lines_present(0)
    assert exc.value.code == "NO_LINES"


def test_at_least_one_line_passes():
    validators.validate_lines_present(1)  # does not raise


# ---------- rules 2, 3, 4: LINE_BOTH_SIDES, LINE_EMPTY, NEGATIVE_AMOUNT ----------

def test_line_with_both_debit_and_credit_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_line_shape([{"debit": Decimal("10"), "credit": Decimal("10")}])
    assert exc.value.code == "LINE_BOTH_SIDES"


def test_line_with_neither_debit_nor_credit_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_line_shape([{"debit": Decimal("0"), "credit": Decimal("0")}])
    assert exc.value.code == "LINE_EMPTY"


def test_negative_debit_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_line_shape([{"debit": Decimal("-5"), "credit": Decimal("0")}])
    assert exc.value.code == "NEGATIVE_AMOUNT"


def test_negative_credit_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_line_shape([{"debit": Decimal("0"), "credit": Decimal("-5")}])
    assert exc.value.code == "NEGATIVE_AMOUNT"


def test_well_formed_lines_pass():
    validators.validate_line_shape([
        {"debit": Decimal("100.00"), "credit": Decimal("0")},
        {"debit": Decimal("0"), "credit": Decimal("100.00")},
    ])  # does not raise


# ---------- rule 1: UNBALANCED_ENTRY ----------

def test_unbalanced_entry_rejected_with_exact_difference():
    with pytest.raises(PostingError) as exc:
        validators.validate_balanced(Decimal("10000.00"), Decimal("9000.00"))
    assert exc.value.code == "UNBALANCED_ENTRY"
    assert exc.value.details[0]["difference"] == "1000.00"


def test_balanced_entry_passes():
    validators.validate_balanced(Decimal("6000.00"), Decimal("6000.00"))  # does not raise


def test_balance_check_has_no_epsilon_tolerance():
    """A one-paisa mismatch must still block — this is the whole point of
    using exact Decimal comparison instead of a float tolerance."""
    with pytest.raises(PostingError):
        validators.validate_balanced(Decimal("100.00"), Decimal("100.01"))


# ---------- rule 6: ARCHIVED_ACCOUNT ----------

def test_archived_account_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_accounts_active([_account(is_active=False)])
    assert exc.value.code == "ARCHIVED_ACCOUNT"


def test_active_account_passes():
    validators.validate_accounts_active([_account(is_active=True)])  # does not raise


# ---------- rule 7: ARCHIVED_PARTNER ----------

def test_archived_partner_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_partners_active([_contact(is_active=False)])
    assert exc.value.code == "ARCHIVED_PARTNER"


# ---------- rule 8: ARCHIVED_ANALYTIC ----------

def test_archived_analytic_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_analytics_active([_analytic(is_active=False)])
    assert exc.value.code == "ARCHIVED_ANALYTIC"


# ---------- rule 9: PERIOD_LOCKED ----------

def test_entry_dated_on_the_lock_date_is_rejected():
    settings = CompanySetting(id=1, books_lock_date=date(2026, 1, 31))
    with pytest.raises(PostingError) as exc:
        validators.validate_period_open(date(2026, 1, 31), settings)
    assert exc.value.code == "PERIOD_LOCKED"


def test_entry_dated_before_the_lock_date_is_rejected():
    settings = CompanySetting(id=1, books_lock_date=date(2026, 1, 31))
    with pytest.raises(PostingError) as exc:
        validators.validate_period_open(date(2026, 1, 15), settings)
    assert exc.value.code == "PERIOD_LOCKED"


def test_entry_dated_after_the_lock_date_passes():
    settings = CompanySetting(id=1, books_lock_date=date(2026, 1, 31))
    validators.validate_period_open(date(2026, 2, 1), settings)  # does not raise


def test_no_lock_date_configured_never_blocks():
    settings = CompanySetting(id=1, books_lock_date=None)
    validators.validate_period_open(date(2020, 1, 1), settings)  # does not raise


# ---------- rule 12: ALREADY_POSTED ----------

def test_already_posted_entry_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_not_already_posted(JournalEntryStatus.POSTED, JournalEntryStatus.POSTED)
    assert exc.value.code == "ALREADY_POSTED"


def test_draft_entry_passes_already_posted_check():
    validators.validate_not_already_posted(JournalEntryStatus.DRAFT, JournalEntryStatus.POSTED)  # does not raise


# ---------- rules 10, 11: INVALID_QUANTITY, NEGATIVE_PRICE ----------

def test_zero_quantity_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_document_lines([{"quantity": Decimal("0"), "unit_price": Decimal("10"), "tax_rate": Decimal("0")}])
    assert exc.value.code == "INVALID_QUANTITY"


def test_negative_quantity_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_document_lines([{"quantity": Decimal("-1"), "unit_price": Decimal("10"), "tax_rate": Decimal("0")}])
    assert exc.value.code == "INVALID_QUANTITY"


def test_negative_unit_price_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_document_lines([{"quantity": Decimal("1"), "unit_price": Decimal("-10"), "tax_rate": Decimal("0")}])
    assert exc.value.code == "NEGATIVE_PRICE"


def test_negative_tax_rate_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_document_lines([{"quantity": Decimal("1"), "unit_price": Decimal("10"), "tax_rate": Decimal("-5")}])
    assert exc.value.code == "NEGATIVE_PRICE"


def test_valid_document_line_passes():
    validators.validate_document_lines([{"quantity": Decimal("3"), "unit_price": Decimal("2000"), "tax_rate": Decimal("0")}])


# ---------- rule 17: WRONG_JOURNAL_TYPE ----------

def test_wrong_journal_type_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_journal_type(JournalType.CASH, JournalType.PURCHASE)
    assert exc.value.code == "WRONG_JOURNAL_TYPE"


def test_matching_journal_type_passes():
    validators.validate_journal_type(JournalType.PURCHASE, JournalType.PURCHASE)  # does not raise


# ---------- rule 15: DOC_NOT_POSTED ----------

def test_paying_an_unposted_document_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_document_posted(DocStatus.CONFIRMED, DocStatus.POSTED)
    assert exc.value.code == "DOC_NOT_POSTED"


def test_paying_a_posted_document_passes():
    validators.validate_document_posted(DocStatus.POSTED, DocStatus.POSTED)  # does not raise


# ---------- rule 13: OVER_ALLOCATION ----------

def test_allocation_exceeding_amount_due_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_allocation_within_document(Decimal("7000.00"), Decimal("6000.00"))
    assert exc.value.code == "OVER_ALLOCATION"


def test_allocation_within_amount_due_passes():
    validators.validate_allocation_within_document(Decimal("6000.00"), Decimal("6000.00"))  # does not raise


# ---------- rule 14: PAYMENT_EXCEEDS_AMOUNT ----------

def test_allocations_exceeding_payment_amount_rejected():
    with pytest.raises(PostingError) as exc:
        validators.validate_allocation_within_payment(Decimal("6000.00"), Decimal("5000.00"))
    assert exc.value.code == "PAYMENT_EXCEEDS_AMOUNT"


def test_allocations_within_payment_amount_passes():
    validators.validate_allocation_within_payment(Decimal("5000.00"), Decimal("5000.00"))  # does not raise
