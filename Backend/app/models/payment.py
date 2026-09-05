"""Payment + PaymentAllocation — design doc §2.7.

`payment` is the money movement (one amount, one method, one date);
`payment_allocation` is the settlement against one or more documents. That
split is what supports partial payment, multi-document settlement and
advances without a mutable `is_paid` flag anywhere (rejected in §2.7).
"""
from datetime import date

from sqlalchemy import CheckConstraint, Date, Enum, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import Money, UBigInt
from app.models.enums import PaymentMethod, PaymentStatus, PaymentType, sa_enum_values
from app.models.mixins import TimestampMixin


class Payment(Base, TimestampMixin):
    __tablename__ = "payment"
    __table_args__ = (
        UniqueConstraint("payment_number", name="uq_pay_number"),
        Index("ix_pay_partner", "partner_id", "status"),
        CheckConstraint("amount > 0", name="ck_pay_amount"),
    )

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    payment_number: Mapped[str] = mapped_column(String(32), nullable=False)
    payment_type: Mapped[PaymentType] = mapped_column(
        Enum(PaymentType, name="payment_type", values_callable=sa_enum_values), nullable=False
    )
    method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod, name="payment_method", values_callable=sa_enum_values),
        nullable=False,
        default=PaymentMethod.BANK,
    )
    partner_id: Mapped[int] = mapped_column(UBigInt, ForeignKey("contact.id"), nullable=False)
    journal_id: Mapped[int] = mapped_column(UBigInt, ForeignKey("journal.id"), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[object] = mapped_column(Money, nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_header_status", values_callable=sa_enum_values),
        nullable=False,
        default=PaymentStatus.DRAFT,
    )
    created_by: Mapped[int] = mapped_column(UBigInt, ForeignKey("user.id"), nullable=False)

    partner: Mapped["Contact"] = relationship()
    journal: Mapped["Journal"] = relationship()
    journal_entry: Mapped["JournalEntry | None"] = relationship(back_populates="source_payment")
    allocations: Mapped[list["PaymentAllocation"]] = relationship(
        back_populates="payment", cascade="all, delete-orphan"
    )


class PaymentAllocation(Base):
    __tablename__ = "payment_allocation"
    __table_args__ = (
        UniqueConstraint("payment_id", "document_id", name="uq_alloc"),
        Index("ix_alloc_doc", "document_id"),
        CheckConstraint("amount_allocated > 0", name="ck_alloc_amt"),
    )

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    payment_id: Mapped[int] = mapped_column(
        UBigInt, ForeignKey("payment.id", ondelete="CASCADE"), nullable=False
    )
    document_id: Mapped[int] = mapped_column(UBigInt, ForeignKey("document.id"), nullable=False)
    amount_allocated: Mapped[object] = mapped_column(Money, nullable=False)

    payment: Mapped["Payment"] = relationship(back_populates="allocations")
    document: Mapped["Document"] = relationship()
