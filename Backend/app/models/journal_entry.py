"""JournalEntry + JournalEntryLine — the ledger itself (design doc §2.6).

Two details that carry real weight:
  * UNIQUE on source_document_id / source_payment_id — MySQL permits many
    NULLs in a unique index (manual entries are unaffected), but a given
    bill/payment can only ever have one journal entry, even if two requests
    race past the application-level status check (§3.5).
  * CHECK(total_debit = total_credit) — an unbalanced entry is physically
    unstorable; this is the last line of defence behind the engine's own
    validator (§3.4 rule 1).
"""
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import Money, UBigInt
from app.models.enums import JournalEntryStatus, JournalEntrySourceType, sa_enum_values
from app.models.mixins import TimestampMixin


class JournalEntry(Base, TimestampMixin):
    __tablename__ = "journal_entry"
    __table_args__ = (
        UniqueConstraint("entry_number", name="uq_je_number"),
        UniqueConstraint("source_document_id", name="uq_je_src_doc"),
        UniqueConstraint("source_payment_id", name="uq_je_src_pay"),
        Index("ix_je_status_date", "status", "entry_date"),  # every report leads with this
        CheckConstraint("total_debit = total_credit", name="ck_je_balanced"),
    )

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    entry_number: Mapped[str] = mapped_column(String(32), nullable=False)
    journal_id: Mapped[int] = mapped_column(UBigInt, ForeignKey("journal.id"), nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    narration: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[JournalEntryStatus] = mapped_column(
        Enum(JournalEntryStatus, name="journal_entry_status", values_callable=sa_enum_values),
        nullable=False,
        default=JournalEntryStatus.DRAFT,
    )
    source_type: Mapped[JournalEntrySourceType] = mapped_column(
        Enum(JournalEntrySourceType, name="journal_entry_source_type", values_callable=sa_enum_values),
        nullable=False,
        default=JournalEntrySourceType.MANUAL,
    )
    source_document_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("document.id"), nullable=True)
    source_payment_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("payment.id"), nullable=True)
    total_debit: Mapped[object] = mapped_column(Money, nullable=False, default=0)
    total_credit: Mapped[object] = mapped_column(Money, nullable=False, default=0)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    posted_by: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("user.id"), nullable=True)

    journal: Mapped["Journal"] = relationship()
    source_document: Mapped["Document | None"] = relationship()
    source_payment: Mapped["Payment | None"] = relationship(back_populates="journal_entry")
    lines: Mapped[list["JournalEntryLine"]] = relationship(
        back_populates="journal_entry", cascade="all, delete-orphan", order_by="JournalEntryLine.line_no"
    )


class JournalEntryLine(Base):
    __tablename__ = "journal_entry_line"
    __table_args__ = (
        Index("ix_jel_entry", "journal_entry_id"),
        Index("ix_jel_account", "account_id"),
        Index("ix_jel_analytic", "analytic_account_id"),
        CheckConstraint("debit >= 0 AND credit >= 0", name="ck_jel_nonneg"),
        CheckConstraint("NOT (debit > 0 AND credit > 0)", name="ck_jel_oneside"),
    )

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    journal_entry_id: Mapped[int] = mapped_column(
        UBigInt, ForeignKey("journal_entry.id", ondelete="CASCADE"), nullable=False
    )
    line_no: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    account_id: Mapped[int] = mapped_column(UBigInt, ForeignKey("chart_of_account.id"), nullable=False)
    partner_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("contact.id"), nullable=True)
    analytic_account_id: Mapped[int | None] = mapped_column(
        UBigInt, ForeignKey("analytic_account.id"), nullable=True
    )
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    debit: Mapped[object] = mapped_column(Money, nullable=False, default=0)
    credit: Mapped[object] = mapped_column(Money, nullable=False, default=0)

    journal_entry: Mapped["JournalEntry"] = relationship(back_populates="lines")
    account: Mapped["ChartOfAccount"] = relationship()
    partner: Mapped["Contact | None"] = relationship()
    analytic_account: Mapped["AnalyticAccount | None"] = relationship()
