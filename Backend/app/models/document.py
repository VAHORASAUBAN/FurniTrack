"""Document + DocumentLine — the one polymorphic table for PO / Vendor Bill /
SO / Customer Invoice (design doc §2.2). Deliberately absent: no `is_paid`,
no `amount_paid` column — payment status is derived (§2.4 `v_document_balance`,
§3.3), never stored.
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
from app.db.types import Money, Qty, Rate, UBigInt
from app.models.enums import DocStatus, DocType, sa_enum_values
from app.models.mixins import TimestampMixin


class Document(Base, TimestampMixin):
    __tablename__ = "document"
    __table_args__ = (
        UniqueConstraint("doc_type", "doc_number", name="uq_doc_number"),
        Index("ix_doc_partner", "partner_id", "doc_type", "status"),  # portal scoping + list filters
        Index("ix_doc_type_status_date", "doc_type", "status", "doc_date"),
        Index("ix_doc_source", "source_document_id"),
        CheckConstraint("total_amount >= 0 AND untaxed_amount >= 0", name="ck_doc_totals"),
        CheckConstraint(
            "due_date IS NULL OR doc_type IN ('VENDOR_BILL','CUSTOMER_INVOICE')",
            name="ck_doc_duedate",
        ),
    )

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    doc_type: Mapped[DocType] = mapped_column(
        Enum(DocType, name="document_doc_type", values_callable=sa_enum_values), nullable=False
    )
    doc_number: Mapped[str] = mapped_column(String(32), nullable=False)
    partner_id: Mapped[int] = mapped_column(UBigInt, ForeignKey("contact.id"), nullable=False)
    journal_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("journal.id"), nullable=True)
    source_document_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("document.id"), nullable=True)
    doc_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    reference: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[DocStatus] = mapped_column(
        Enum(DocStatus, name="document_status", values_callable=sa_enum_values),
        nullable=False,
        default=DocStatus.DRAFT,
    )
    untaxed_amount: Mapped[object] = mapped_column(Money, nullable=False, default=0)
    tax_amount: Mapped[object] = mapped_column(Money, nullable=False, default=0)
    total_amount: Mapped[object] = mapped_column(Money, nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(UBigInt, ForeignKey("user.id"), nullable=False)

    partner: Mapped["Contact"] = relationship(foreign_keys=[partner_id])
    journal: Mapped["Journal | None"] = relationship()
    source_document: Mapped["Document | None"] = relationship(remote_side=[id])
    lines: Mapped[list["DocumentLine"]] = relationship(
        back_populates="document", cascade="all, delete-orphan", order_by="DocumentLine.line_no"
    )


class DocumentLine(Base):
    __tablename__ = "document_line"
    __table_args__ = (
        UniqueConstraint("document_id", "line_no", name="uq_docline_no"),
        Index("ix_docline_analytic", "analytic_account_id"),
        CheckConstraint("quantity > 0 AND unit_price >= 0 AND tax_rate >= 0", name="ck_dl_qty"),
    )

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(
        UBigInt, ForeignKey("document.id", ondelete="CASCADE"), nullable=False
    )
    line_no: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    product_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("product.id"), nullable=True)
    account_id: Mapped[int] = mapped_column(UBigInt, ForeignKey("chart_of_account.id"), nullable=False)
    analytic_account_id: Mapped[int | None] = mapped_column(
        UBigInt, ForeignKey("analytic_account.id"), nullable=True
    )
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quantity: Mapped[object] = mapped_column(Qty, nullable=False, default=1)
    unit_price: Mapped[object] = mapped_column(Money, nullable=False, default=0)
    tax_rate: Mapped[object] = mapped_column(Rate, nullable=False, default=0)
    tax_amount: Mapped[object] = mapped_column(Money, nullable=False, default=0)
    subtotal: Mapped[object] = mapped_column(Money, nullable=False, default=0)  # quantity * unit_price
    total: Mapped[object] = mapped_column(Money, nullable=False, default=0)  # subtotal + tax_amount

    document: Mapped["Document"] = relationship(back_populates="lines")
    product: Mapped["Product | None"] = relationship()
    account: Mapped["ChartOfAccount"] = relationship()
    analytic_account: Mapped["AnalyticAccount | None"] = relationship()
