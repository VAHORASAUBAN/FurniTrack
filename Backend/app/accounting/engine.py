"""The accounting engine — design doc §3. The only writer of journal
entries anywhere in the codebase (design doc §1's architecture diagram: the
engine writes, the report layer only ever reads what it wrote). No
FastAPI, no HTTP — every function here takes and returns plain ORM objects,
so the whole engine is unit-testable with a bare SQLAlchemy session.

Two ways an entry comes into existence:
  * `build_entry()` alone, for a MANUAL entry — created as DRAFT, left for
    the user to edit and post later via a separate `validate_and_post()` call.
  * `build_entry()` immediately followed by `validate_and_post()`, for a
    Vendor Bill / Customer Invoice / Payment — design doc §3.2 says these
    post "as soon as [the document] is confirmed", so there's no draft
    stage from the user's point of view even though the same two engine
    primitives do the work underneath.
"""
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.accounting import sequence, validators
from app.core.exceptions import PostingError
from app.models import AnalyticAccount, ChartOfAccount, Contact, JournalEntry, JournalEntryLine
from app.models.enums import JournalEntryStatus


def build_entry(
    db: Session,
    *,
    journal_id: int,
    entry_date,
    reference: str | None,
    narration: str | None,
    source_type,
    line_specs: list[dict],
    source_document_id: int | None = None,
    source_payment_id: int | None = None,
) -> JournalEntry:
    """Allocates the entry number and constructs a DRAFT `JournalEntry` +
    its lines from `line_specs` (the dicts `rules.py`'s `build_*` functions
    return, or a manual entry's raw line input). Does not validate or post —
    call `validate_and_post()` next."""
    validators.validate_lines_present(len(line_specs))

    entry = JournalEntry(
        entry_number=sequence.next_number(db, "JOURNAL_ENTRY"),
        journal_id=journal_id,
        entry_date=entry_date,
        reference=reference,
        narration=narration,
        status=JournalEntryStatus.DRAFT,
        source_type=source_type,
        source_document_id=source_document_id,
        source_payment_id=source_payment_id,
        total_debit=Decimal("0"),
        total_credit=Decimal("0"),
    )
    for i, spec in enumerate(line_specs, start=1):
        entry.lines.append(
            JournalEntryLine(
                line_no=i,
                account_id=spec["account_id"],
                partner_id=spec.get("partner_id"),
                analytic_account_id=spec.get("analytic_account_id"),
                label=spec.get("label"),
                debit=spec.get("debit", Decimal("0")),
                credit=spec.get("credit", Decimal("0")),
            )
        )
    db.add(entry)
    db.flush()
    return entry


def _run_entry_validators(db: Session, entry: JournalEntry, settings) -> tuple[Decimal, Decimal]:
    """Rules 1-9 (design doc §3.4) — every entry must pass these regardless
    of what produced it. Returns (total_debit, total_credit) so the caller
    can stamp the header without re-summing."""
    validators.validate_lines_present(len(entry.lines))

    validators.validate_line_shape([{"debit": line.debit, "credit": line.credit} for line in entry.lines])

    total_debit = sum((line.debit for line in entry.lines), Decimal("0"))
    total_credit = sum((line.credit for line in entry.lines), Decimal("0"))
    validators.validate_balanced(total_debit, total_credit)

    account_ids = {line.account_id for line in entry.lines}
    accounts = db.query(ChartOfAccount).filter(ChartOfAccount.id.in_(account_ids)).all()
    validators.validate_accounts_active(accounts)

    partner_ids = {line.partner_id for line in entry.lines if line.partner_id is not None}
    if partner_ids:
        partners = db.query(Contact).filter(Contact.id.in_(partner_ids)).all()
        validators.validate_partners_active(partners)

    analytic_ids = {line.analytic_account_id for line in entry.lines if line.analytic_account_id is not None}
    if analytic_ids:
        analytics = db.query(AnalyticAccount).filter(AnalyticAccount.id.in_(analytic_ids)).all()
        validators.validate_analytics_active(analytics)

    validators.validate_period_open(entry.entry_date, settings)

    return total_debit, total_credit


def validate_and_post(db: Session, entry: JournalEntry, settings, *, posted_by_user_id: int) -> JournalEntry:
    """Runs the 1-9 validators and flips DRAFT -> POSTED. Works for any
    entry regardless of source (manual, bill, invoice, payment) — they all
    converge to a `JournalEntry` with lines by the time this is called."""
    validators.validate_not_already_posted(entry.status, JournalEntryStatus.POSTED)

    total_debit, total_credit = _run_entry_validators(db, entry, settings)

    entry.total_debit = total_debit
    entry.total_credit = total_credit
    entry.status = JournalEntryStatus.POSTED
    entry.posted_at = datetime.now(timezone.utc)
    entry.posted_by = posted_by_user_id
    db.flush()
    return entry


def reverse_entry(db: Session, entry: JournalEntry, settings, *, reversed_by_user_id: int) -> JournalEntry:
    """Cancellation never deletes ledger history (design doc §3.5) — this
    creates a new POSTED entry with every line's debit/credit swapped, dated
    today, and marks the original CANCELLED. Only valid on a POSTED entry."""
    if entry.status != JournalEntryStatus.POSTED:
        raise PostingError("Only a posted entry can be reversed.", code="NOT_POSTED")

    reversal_specs = [
        {
            "account_id": line.account_id,
            "debit": line.credit,
            "credit": line.debit,
            "partner_id": line.partner_id,
            "analytic_account_id": line.analytic_account_id,
            "label": f"Reversal of {entry.entry_number}",
        }
        for line in entry.lines
    ]

    reversal = build_entry(
        db,
        journal_id=entry.journal_id,
        entry_date=date.today(),
        reference=f"Reversal of {entry.entry_number}",
        narration=f"Automatic reversal of {entry.entry_number}.",
        source_type=entry.source_type,
        line_specs=reversal_specs,
    )
    validate_and_post(db, reversal, settings, posted_by_user_id=reversed_by_user_id)

    entry.status = JournalEntryStatus.CANCELLED
    db.flush()
    return reversal
