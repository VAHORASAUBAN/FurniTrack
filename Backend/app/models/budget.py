"""AnalyticAccount + Budget + BudgetLine — design doc §3 Master Data Modules
items 6-7, and §2.2 decision: revision workflow is schema-now / UI-later
(`status` + `revises_budget_id`).
"""
from datetime import date

from sqlalchemy import CheckConstraint, Date, Enum, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import Money, UBigInt
from app.models.enums import AnalyticType, BudgetStatus, sa_enum_values
from app.models.mixins import ArchiveMixin, TimestampMixin


class AnalyticAccount(Base, TimestampMixin, ArchiveMixin):
    __tablename__ = "analytic_account"

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    analytic_type: Mapped[AnalyticType] = mapped_column(
        Enum(AnalyticType, name="analytic_type", values_callable=sa_enum_values), nullable=False
    )


class Budget(Base, TimestampMixin, ArchiveMixin):
    __tablename__ = "budget"
    __table_args__ = (
        Index("ix_budget_period", "start_date", "end_date"),
        Index("ix_budget_status", "status", "is_active"),
        CheckConstraint("end_date >= start_date", name="ck_budget_dates"),
    )

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    responsible_contact_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("contact.id"), nullable=True)
    status: Mapped[BudgetStatus] = mapped_column(
        Enum(BudgetStatus, name="budget_status", values_callable=sa_enum_values),
        nullable=False,
        default=BudgetStatus.DRAFT,
    )
    # Points at the budget THIS one supersedes. Set by POST /budgets/{id}/revise
    # (nice-to-have UI; the column exists from day one per the design decision).
    revises_budget_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("budget.id"), nullable=True)

    responsible_contact: Mapped["Contact | None"] = relationship()
    revises_budget: Mapped["Budget | None"] = relationship(remote_side=[id])
    lines: Mapped[list["BudgetLine"]] = relationship(back_populates="budget", cascade="all, delete-orphan")


class BudgetLine(Base):
    __tablename__ = "budget_line"
    __table_args__ = (
        UniqueConstraint("budget_id", "analytic_account_id", name="uq_bl"),
        CheckConstraint("planned_amount >= 0", name="ck_bl_planned"),
    )

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    budget_id: Mapped[int] = mapped_column(UBigInt, ForeignKey("budget.id"), nullable=False)
    analytic_account_id: Mapped[int] = mapped_column(UBigInt, ForeignKey("analytic_account.id"), nullable=False)
    # Denormalised copy of analytic_account.analytic_type at the time the
    # line was added — sign convention for achieved-amount SQL (§4.3) reads
    # this column directly rather than joining back to analytic_account.
    analytic_type: Mapped[AnalyticType] = mapped_column(
        Enum(AnalyticType, name="budget_line_analytic_type", values_callable=sa_enum_values), nullable=False
    )
    planned_amount: Mapped[object] = mapped_column(Money, nullable=False, default=0)

    budget: Mapped["Budget"] = relationship(back_populates="lines")
    analytic_account: Mapped["AnalyticAccount"] = relationship()
