"""Chart of Accounts — design doc §2.4.

`is_receivable` / `is_payable` are how the accounting engine finds Debtors
and Creditors without string-matching account names (§3.1 account
resolution). Exactly one account may carry each flag — enforced in
master_service, not the DB, since "at most one TRUE" isn't a plain CHECK.
"""
from sqlalchemy import Boolean, Enum, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.types import UBigInt
from app.models.enums import AccountType, sa_enum_values
from app.models.mixins import ArchiveMixin, TimestampMixin


class ChartOfAccount(Base, TimestampMixin, ArchiveMixin):
    __tablename__ = "chart_of_account"
    __table_args__ = (
        Index("ix_coa_type_active", "account_type", "is_active"),
        Index("ix_coa_active_name", "is_active", "name"),
    )

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(16), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(
        Enum(AccountType, name="account_type", values_callable=sa_enum_values), nullable=False
    )
    is_receivable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    is_payable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
