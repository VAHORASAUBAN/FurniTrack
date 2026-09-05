"""Payment service — design doc §2.7, §3.2, §3.5. A payment is created and
posted in one atomic step (unlike documents/manual entries, which have a
Draft stage) — matching the wireframe's single-action Pay dialog.

Row-locking each allocated document (`with_for_update`) before checking its
outstanding balance is what makes the over-allocation check correct under
concurrency: without it, two payments racing against the same invoice could
both read the same `amount_due` and both pass (design doc §3.5's worked
example on exactly this race).
"""
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.accounting import engine, resolver, rules, sequence, validators
from app.core.exceptions import PostingError
from app.models import Document, JournalEntry, Payment, PaymentAllocation
from app.models.enums import DocStatus, JournalEntrySourceType, PaymentStatus


def _locked_amount_due(db: Session, document_id: int) -> tuple[Document, Decimal]:
    document = db.execute(
        select(Document).where(Document.id == document_id).with_for_update()
    ).scalar_one_or_none()
    if document is None:
        raise PostingError(f"Document {document_id} not found.", code="NOT_FOUND")

    validators.validate_document_posted(document.status, DocStatus.POSTED)

    row = db.execute(
        text("SELECT amount_due FROM v_document_balance WHERE document_id = :id"), {"id": document_id}
    ).mappings().one()
    return document, row["amount_due"]


def create_and_post_payment(db: Session, data: dict, *, created_by_user_id: int) -> Payment:
    allocations_in = data["allocations"]

    total_allocated = sum((a["amount_allocated"] for a in allocations_in), Decimal("0"))
    validators.validate_allocation_within_payment(total_allocated, data["amount"])

    payment = Payment(
        payment_number=sequence.next_number(db, "PAYMENT"),
        payment_type=data["payment_type"],
        method=data["method"],
        partner_id=data["partner_id"],
        journal_id=data["journal_id"],
        payment_date=data["payment_date"],
        amount=data["amount"],
        note=data.get("note"),
        status=PaymentStatus.DRAFT,
        created_by=created_by_user_id,
    )
    db.add(payment)
    db.flush()

    for alloc in allocations_in:
        document, amount_due = _locked_amount_due(db, alloc["document_id"])
        validators.validate_allocation_within_document(alloc["amount_allocated"], amount_due)
        db.add(PaymentAllocation(
            payment_id=payment.id, document_id=document.id, amount_allocated=alloc["amount_allocated"]
        ))
    db.flush()

    settings = resolver.get_company_settings(db)
    line_specs = rules.build_payment_lines(payment, settings)
    entry = engine.build_entry(
        db,
        journal_id=payment.journal_id,
        entry_date=payment.payment_date,
        reference=payment.payment_number,
        narration=f"Payment against {len(allocations_in)} document(s).",
        source_type=JournalEntrySourceType.PAYMENT,
        source_payment_id=payment.id,
        line_specs=line_specs,
    )
    engine.validate_and_post(db, entry, settings, posted_by_user_id=created_by_user_id)

    payment.status = PaymentStatus.POSTED
    db.flush()
    return payment


def cancel_payment(db: Session, payment: Payment, *, cancelled_by_user_id: int) -> Payment:
    if payment.status != PaymentStatus.POSTED:
        raise PostingError("Only a posted payment can be cancelled.", code="NOT_POSTED")

    entry = db.query(JournalEntry).filter_by(source_payment_id=payment.id).one_or_none()
    if entry is None:
        raise PostingError("No journal entry found for this payment.", code="NOT_FOUND")

    settings = resolver.get_company_settings(db)
    engine.reverse_entry(db, entry, settings, reversed_by_user_id=cancelled_by_user_id)

    payment.status = PaymentStatus.CANCELLED
    db.flush()
    return payment
