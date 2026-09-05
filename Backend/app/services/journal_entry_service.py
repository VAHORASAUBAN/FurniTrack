"""Manual Journal Entry service — design doc §5.4. Create/update only ever
touch a DRAFT entry's own fields and lines directly; post/cancel/reset
delegate to the accounting engine, which is the only thing in the codebase
allowed to flip status or treat a set of lines as a real posting.
"""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.accounting import engine, resolver
from app.core.exceptions import ConflictError
from app.models import JournalEntry, JournalEntryLine
from app.models.enums import JournalEntrySourceType, JournalEntryStatus
from app.services import notification_service


def create_draft(db: Session, data: dict) -> JournalEntry:
    return engine.build_entry(
        db,
        journal_id=data["journal_id"],
        entry_date=data["entry_date"],
        reference=data.get("reference"),
        narration=data.get("narration"),
        source_type=JournalEntrySourceType.MANUAL,
        line_specs=data["lines"],
    )


def update_draft(db: Session, entry: JournalEntry, data: dict) -> JournalEntry:
    if entry.status != JournalEntryStatus.DRAFT:
        raise ConflictError("Only a draft entry can be edited.", code="NOT_DRAFT")

    lines = data.pop("lines", None)
    for key, value in data.items():
        setattr(entry, key, value)

    if lines is not None:
        entry.lines.clear()
        db.flush()  # let the ON DELETE CASCADE-backed clear land before re-inserting line_no 1..N
        for i, spec in enumerate(lines, start=1):
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
    db.flush()
    return entry


def post(db: Session, entry: JournalEntry, *, posted_by_user_id: int) -> JournalEntry:
    settings = resolver.get_company_settings(db)
    posted = engine.validate_and_post(db, entry, settings, posted_by_user_id=posted_by_user_id)
    notification_service.notify(
        db,
        f"Journal entry {posted.entry_number} was posted for {posted.total_debit:,.2f}.",
        link=f"/journal-entries/{posted.id}",
        actor_user_id=posted_by_user_id,
    )
    return posted


def cancel(db: Session, entry: JournalEntry, *, cancelled_by_user_id: int) -> JournalEntry:
    """Reversal, not deletion (design doc §3.5) — the original stays in
    history as CANCELLED and a new POSTED entry undoes its ledger effect."""
    settings = resolver.get_company_settings(db)
    reversal = engine.reverse_entry(db, entry, settings, reversed_by_user_id=cancelled_by_user_id)
    notification_service.notify(
        db,
        f"Journal entry {entry.entry_number} was cancelled (reversed by {reversal.entry_number}).",
        link=f"/journal-entries/{reversal.id}",
        actor_user_id=cancelled_by_user_id,
    )
    return reversal


def reset_to_draft(db: Session, entry: JournalEntry) -> JournalEntry:
    """Admin-only correction tool, distinct from cancel: unlocks a posted
    entry for editing with no reversal/audit trail. Reports simply stop
    counting it the moment status leaves POSTED, since they only ever read
    posted lines (design doc §4)."""
    if entry.status != JournalEntryStatus.POSTED:
        raise ConflictError("Only a posted entry can be reset to draft.", code="NOT_POSTED")
    entry.status = JournalEntryStatus.DRAFT
    entry.posted_at = None
    entry.posted_by = None
    db.flush()
    return entry
