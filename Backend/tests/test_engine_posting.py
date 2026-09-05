"""Engine round-trip tests: the posting-rule tables from design doc §3.2,
plus `build_entry()` / `validate_and_post()` / `reverse_entry()` end to end
against the real (seeded) Chart of Accounts and Journals. Uses `db_session`
(savepoint, rolled back at teardown — see conftest.py) rather than HTTP,
per the engine's own "no FastAPI" boundary.
"""
from datetime import date
from decimal import Decimal

import pytest

from app.accounting import engine, rules, sequence
from app.core.exceptions import PostingError
from app.models import (
    ChartOfAccount,
    CompanySetting,
    Contact,
    Document,
    DocumentLine,
    Journal,
    Payment,
)
from app.models.enums import (
    AccountType,
    ContactType,
    DocStatus,
    DocType,
    JournalEntrySourceType,
    PaymentMethod,
    PaymentType,
)


def _account(db, code):
    return db.query(ChartOfAccount).filter_by(code=code).one()


def _journal(db, code):
    return db.query(Journal).filter_by(code=code).one()


def _settings(db):
    return db.get(CompanySetting, 1)


def _vendor(db):
    contact = Contact(name="Azure Furniture", contact_type=ContactType.VENDOR, email=f"azure-{id(object())}@t.co")
    db.add(contact)
    db.flush()
    return contact


def _customer(db):
    contact = Contact(name="Nimesh Pathak", contact_type=ContactType.CUSTOMER, email=f"nimesh-{id(object())}@t.co")
    db.add(contact)
    db.flush()
    return contact


# ---------- manual entry: the full build -> post round trip ----------

def test_balanced_manual_entry_posts_successfully(db_session):
    journal = _journal(db_session, "CASH")
    cash = _account(db_session, "1000")
    capital = _account(db_session, "3000")

    entry = engine.build_entry(
        db_session,
        journal_id=journal.id,
        entry_date=date(2026, 2, 1),
        reference="Owner's capital",
        narration=None,
        source_type=JournalEntrySourceType.MANUAL,
        line_specs=[
            {"account_id": cash.id, "debit": Decimal("10000.00"), "credit": Decimal("0")},
            {"account_id": capital.id, "debit": Decimal("0"), "credit": Decimal("10000.00")},
        ],
    )
    assert entry.entry_number.startswith("JE/")
    assert entry.status.value == "DRAFT"

    posted = engine.validate_and_post(db_session, entry, _settings(db_session), posted_by_user_id=1)
    assert posted.status.value == "POSTED"
    assert posted.total_debit == Decimal("10000.00")
    assert posted.total_credit == Decimal("10000.00")
    assert posted.posted_at is not None


def test_unbalanced_manual_entry_is_rejected_and_stays_draft(db_session):
    journal = _journal(db_session, "CASH")
    cash = _account(db_session, "1000")
    capital = _account(db_session, "3000")

    entry = engine.build_entry(
        db_session,
        journal_id=journal.id,
        entry_date=date(2026, 2, 1),
        reference=None,
        narration=None,
        source_type=JournalEntrySourceType.MANUAL,
        line_specs=[
            {"account_id": cash.id, "debit": Decimal("10000.00"), "credit": Decimal("0")},
            {"account_id": capital.id, "debit": Decimal("0"), "credit": Decimal("9000.00")},
        ],
    )

    with pytest.raises(PostingError) as exc:
        engine.validate_and_post(db_session, entry, _settings(db_session), posted_by_user_id=1)
    assert exc.value.code == "UNBALANCED_ENTRY"
    assert exc.value.details[0]["difference"] == "1000.00"
    assert entry.status.value == "DRAFT"  # rejected post attempt must not flip status


def test_posting_an_already_posted_entry_is_rejected(db_session):
    journal = _journal(db_session, "CASH")
    cash = _account(db_session, "1000")
    capital = _account(db_session, "3000")
    settings = _settings(db_session)

    entry = engine.build_entry(
        db_session,
        journal_id=journal.id,
        entry_date=date(2026, 2, 1),
        reference=None,
        narration=None,
        source_type=JournalEntrySourceType.MANUAL,
        line_specs=[
            {"account_id": cash.id, "debit": Decimal("500.00"), "credit": Decimal("0")},
            {"account_id": capital.id, "debit": Decimal("0"), "credit": Decimal("500.00")},
        ],
    )
    engine.validate_and_post(db_session, entry, settings, posted_by_user_id=1)

    with pytest.raises(PostingError) as exc:
        engine.validate_and_post(db_session, entry, settings, posted_by_user_id=1)
    assert exc.value.code == "ALREADY_POSTED"


def test_archived_account_blocks_posting(db_session):
    journal = _journal(db_session, "CASH")
    cash = _account(db_session, "1000")
    scratch = ChartOfAccount(
        code=f"T{id(object()) % 100000}", name="Scratch", account_type=AccountType.EXPENSE, is_active=False
    )
    db_session.add(scratch)
    db_session.flush()

    entry = engine.build_entry(
        db_session,
        journal_id=journal.id,
        entry_date=date(2026, 2, 1),
        reference=None,
        narration=None,
        source_type=JournalEntrySourceType.MANUAL,
        line_specs=[
            {"account_id": cash.id, "debit": Decimal("100.00"), "credit": Decimal("0")},
            {"account_id": scratch.id, "debit": Decimal("0"), "credit": Decimal("100.00")},
        ],
    )
    with pytest.raises(PostingError) as exc:
        engine.validate_and_post(db_session, entry, _settings(db_session), posted_by_user_id=1)
    assert exc.value.code == "ARCHIVED_ACCOUNT"


def test_entry_number_is_gap_free_across_two_posts(db_session):
    journal = _journal(db_session, "CASH")
    cash = _account(db_session, "1000")
    capital = _account(db_session, "3000")

    specs = [
        {"account_id": cash.id, "debit": Decimal("1.00"), "credit": Decimal("0")},
        {"account_id": capital.id, "debit": Decimal("0"), "credit": Decimal("1.00")},
    ]
    first = engine.build_entry(
        db_session, journal_id=journal.id, entry_date=date(2026, 2, 1), reference=None, narration=None,
        source_type=JournalEntrySourceType.MANUAL, line_specs=specs,
    )
    second = engine.build_entry(
        db_session, journal_id=journal.id, entry_date=date(2026, 2, 1), reference=None, narration=None,
        source_type=JournalEntrySourceType.MANUAL, line_specs=specs,
    )
    first_n = int(first.entry_number.rsplit("/", 1)[1])
    second_n = int(second.entry_number.rsplit("/", 1)[1])
    assert second_n == first_n + 1


# ---------- reversal ----------

def test_reversing_a_posted_entry_swaps_debit_and_credit(db_session):
    journal = _journal(db_session, "CASH")
    cash = _account(db_session, "1000")
    capital = _account(db_session, "3000")
    settings = _settings(db_session)

    entry = engine.build_entry(
        db_session, journal_id=journal.id, entry_date=date(2026, 2, 1), reference=None, narration=None,
        source_type=JournalEntrySourceType.MANUAL,
        line_specs=[
            {"account_id": cash.id, "debit": Decimal("300.00"), "credit": Decimal("0")},
            {"account_id": capital.id, "debit": Decimal("0"), "credit": Decimal("300.00")},
        ],
    )
    engine.validate_and_post(db_session, entry, settings, posted_by_user_id=1)

    reversal = engine.reverse_entry(db_session, entry, settings, reversed_by_user_id=1)

    assert entry.status.value == "CANCELLED"
    assert reversal.status.value == "POSTED"
    reversal_by_account = {line.account_id: (line.debit, line.credit) for line in reversal.lines}
    assert reversal_by_account[cash.id] == (Decimal("0.00"), Decimal("300.00"))  # was Dr, now Cr
    assert reversal_by_account[capital.id] == (Decimal("300.00"), Decimal("0.00"))  # was Cr, now Dr


def test_reversing_a_draft_entry_is_rejected(db_session):
    journal = _journal(db_session, "CASH")
    cash = _account(db_session, "1000")
    capital = _account(db_session, "3000")

    entry = engine.build_entry(
        db_session, journal_id=journal.id, entry_date=date(2026, 2, 1), reference=None, narration=None,
        source_type=JournalEntrySourceType.MANUAL,
        line_specs=[
            {"account_id": cash.id, "debit": Decimal("50.00"), "credit": Decimal("0")},
            {"account_id": capital.id, "debit": Decimal("0"), "credit": Decimal("50.00")},
        ],
    )
    with pytest.raises(PostingError) as exc:
        engine.reverse_entry(db_session, entry, _settings(db_session), reversed_by_user_id=1)
    assert exc.value.code == "NOT_POSTED"


# ---------- posting rules: §3.2's worked example, Vendor Bill / Customer Invoice ----------

def test_vendor_bill_posting_rule_matches_design_doc_worked_example(db_session):
    """3 x Table @ 2000, no tax -> Dr Purchase Expense 6000 / Cr Creditors 6000."""
    settings = _settings(db_session)
    vendor = _vendor(db_session)
    expense_account = _account(db_session, "5000")

    document = Document(
        doc_type=DocType.VENDOR_BILL, doc_number=sequence.next_number(db_session, "VENDOR_BILL"), partner_id=vendor.id,
        doc_date=date(2026, 2, 1), status=DocStatus.CONFIRMED,
        untaxed_amount=Decimal("6000.00"), tax_amount=Decimal("0"), total_amount=Decimal("6000.00"),
        created_by=1,
    )
    document.lines.append(DocumentLine(
        line_no=1, account_id=expense_account.id, description="Table",
        quantity=Decimal("3"), unit_price=Decimal("2000.00"), tax_rate=Decimal("0"),
        tax_amount=Decimal("0"), subtotal=Decimal("6000.00"), total=Decimal("6000.00"),
    ))
    db_session.add(document)
    db_session.flush()

    lines = rules.build_document_lines(document, settings)
    by_account = {line["account_id"]: line for line in lines}

    assert by_account[expense_account.id]["debit"] == Decimal("6000.00")
    assert by_account[expense_account.id]["credit"] == Decimal("0")

    creditors = _account(db_session, "2100")
    assert by_account[creditors.id]["credit"] == Decimal("6000.00")
    assert by_account[creditors.id]["partner_id"] == vendor.id

    total_debit = sum(l["debit"] for l in lines)
    total_credit = sum(l["credit"] for l in lines)
    assert total_debit == total_credit == Decimal("6000.00")


def test_customer_invoice_posting_rule_matches_design_doc_worked_example(db_session):
    """3 x Table @ 2000, no tax -> Dr Debtors 6000 / Cr Sales Income 6000."""
    settings = _settings(db_session)
    customer = _customer(db_session)
    income_account = _account(db_session, "4000")

    document = Document(
        doc_type=DocType.CUSTOMER_INVOICE, doc_number=sequence.next_number(db_session, "CUSTOMER_INVOICE"), partner_id=customer.id,
        doc_date=date(2026, 2, 1), status=DocStatus.CONFIRMED,
        untaxed_amount=Decimal("6000.00"), tax_amount=Decimal("0"), total_amount=Decimal("6000.00"),
        created_by=1,
    )
    document.lines.append(DocumentLine(
        line_no=1, account_id=income_account.id, description="Table",
        quantity=Decimal("3"), unit_price=Decimal("2000.00"), tax_rate=Decimal("0"),
        tax_amount=Decimal("0"), subtotal=Decimal("6000.00"), total=Decimal("6000.00"),
    ))
    db_session.add(document)
    db_session.flush()

    lines = rules.build_document_lines(document, settings)
    by_account = {line["account_id"]: line for line in lines}

    debtors = _account(db_session, "1100")
    assert by_account[debtors.id]["debit"] == Decimal("6000.00")
    assert by_account[debtors.id]["partner_id"] == customer.id
    assert by_account[income_account.id]["credit"] == Decimal("6000.00")

    total_debit = sum(l["debit"] for l in lines)
    total_credit = sum(l["credit"] for l in lines)
    assert total_debit == total_credit == Decimal("6000.00")


def test_vendor_bill_with_tax_posts_a_separate_input_tax_line(db_session):
    settings = _settings(db_session)
    vendor = _vendor(db_session)
    expense_account = _account(db_session, "5000")

    document = Document(
        doc_type=DocType.VENDOR_BILL, doc_number=sequence.next_number(db_session, "VENDOR_BILL"), partner_id=vendor.id,
        doc_date=date(2026, 2, 1), status=DocStatus.CONFIRMED,
        untaxed_amount=Decimal("1000.00"), tax_amount=Decimal("180.00"), total_amount=Decimal("1180.00"),
        created_by=1,
    )
    document.lines.append(DocumentLine(
        line_no=1, account_id=expense_account.id, quantity=Decimal("1"), unit_price=Decimal("1000.00"),
        tax_rate=Decimal("18"), tax_amount=Decimal("180.00"), subtotal=Decimal("1000.00"), total=Decimal("1180.00"),
    ))
    db_session.add(document)
    db_session.flush()

    lines = rules.build_document_lines(document, settings)
    input_tax = _account(db_session, "1900")
    by_account = {line["account_id"]: line for line in lines}
    assert by_account[input_tax.id]["debit"] == Decimal("180.00")

    total_debit = sum(l["debit"] for l in lines)
    total_credit = sum(l["credit"] for l in lines)
    assert total_debit == total_credit == Decimal("1180.00")


# ---------- posting rules: payments ----------

def test_bill_payment_posting_rule(db_session):
    vendor = _vendor(db_session)
    bank_journal = _journal(db_session, "BANK")
    settings = _settings(db_session)

    payment = Payment(
        payment_number=sequence.next_number(db_session, "PAYMENT"), payment_type=PaymentType.SEND, method=PaymentMethod.BANK,
        partner_id=vendor.id, journal_id=bank_journal.id, payment_date=date(2026, 2, 5),
        amount=Decimal("6000.00"), created_by=1,
    )
    db_session.add(payment)
    db_session.flush()

    lines = rules.build_payment_lines(payment, settings)
    creditors = _account(db_session, "2100")
    bank = _account(db_session, "1010")
    by_account = {line["account_id"]: line for line in lines}

    assert by_account[creditors.id]["debit"] == Decimal("6000.00")
    assert by_account[creditors.id]["partner_id"] == vendor.id
    assert by_account[bank.id]["credit"] == Decimal("6000.00")


def test_invoice_payment_posting_rule(db_session):
    customer = _customer(db_session)
    cash_journal = _journal(db_session, "CASH")
    settings = _settings(db_session)

    payment = Payment(
        payment_number=sequence.next_number(db_session, "PAYMENT"), payment_type=PaymentType.RECEIVE, method=PaymentMethod.CASH,
        partner_id=customer.id, journal_id=cash_journal.id, payment_date=date(2026, 2, 5),
        amount=Decimal("6000.00"), created_by=1,
    )
    db_session.add(payment)
    db_session.flush()

    lines = rules.build_payment_lines(payment, settings)
    debtors = _account(db_session, "1100")
    cash = _account(db_session, "1000")
    by_account = {line["account_id"]: line for line in lines}

    assert by_account[cash.id]["debit"] == Decimal("6000.00")
    assert by_account[debtors.id]["credit"] == Decimal("6000.00")
    assert by_account[debtors.id]["partner_id"] == customer.id


def test_purchase_order_does_not_post_to_the_ledger(db_session):
    """Design doc §3.2: PO/SO are commercial documents only."""
    vendor = _vendor(db_session)
    document = Document(
        doc_type=DocType.PURCHASE_ORDER, doc_number=sequence.next_number(db_session, "PURCHASE_ORDER"), partner_id=vendor.id,
        doc_date=date(2026, 2, 1), status=DocStatus.CONFIRMED, created_by=1,
    )
    with pytest.raises(ValueError):
        rules.build_document_lines(document, _settings(db_session))
