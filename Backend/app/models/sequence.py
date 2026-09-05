"""DocSequence + CompanySetting — design doc §2.10 and §3.1.

DocSequence rows are allocated via SELECT ... FOR UPDATE inside the same
transaction as the document insert (see app/accounting/sequence.py) — never
via SELECT MAX(number)+1, which two concurrent requests can both read
before either writes (rejected in §2.10).

CompanySetting is a singleton (id is always 1, enforced by CHECK) holding
the default accounts the engine falls back to when nothing more specific
resolves (§3.1 account resolution, step 4).
"""
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UBigInt


class DocSequence(Base):
    __tablename__ = "doc_sequence"
    __table_args__ = (
        UniqueConstraint("code", "fiscal_year", name="uq_seq_code_year"),
    )

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    # e.g. 'PURCHASE_ORDER', 'VENDOR_BILL', 'SALES_ORDER', 'CUSTOMER_INVOICE',
    # 'PAYMENT_RECEIVE', 'PAYMENT_SEND', 'JOURNAL_ENTRY'
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    # PO/SO number sequences don't carry a year segment in their format
    # (P00001, not P00001/2026) — those rows use the sentinel year 0 so the
    # (code, fiscal_year) natural key stays uniform across all doc types.
    fiscal_year: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    padding: Mapped[int] = mapped_column(TINYINT(unsigned=True), nullable=False, default=4)
    next_number: Mapped[int] = mapped_column(UBigInt, nullable=False, default=1)


class CompanySetting(Base):
    __tablename__ = "company_setting"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_company_singleton"),
    )

    # autoincrement=False: MySQL 8+ rejects a CHECK constraint that references
    # an AUTO_INCREMENT column (error 3818), and this row is always inserted
    # with id=1 explicitly by the seed script — it never auto-generates.
    id: Mapped[int] = mapped_column(TINYINT(unsigned=True), primary_key=True, autoincrement=False, default=1)
    company_name: Mapped[str] = mapped_column(String(128), nullable=False, default="Urban Furniture")
    books_lock_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    receivable_account_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("chart_of_account.id"))
    payable_account_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("chart_of_account.id"))
    output_tax_account_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("chart_of_account.id"))
    input_tax_account_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("chart_of_account.id"))

    sales_journal_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("journal.id"))
    purchase_journal_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("journal.id"))
    bank_journal_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("journal.id"))
    cash_journal_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("journal.id"))

    receivable_account: Mapped["ChartOfAccount | None"] = relationship(foreign_keys=[receivable_account_id])
    payable_account: Mapped["ChartOfAccount | None"] = relationship(foreign_keys=[payable_account_id])
    output_tax_account: Mapped["ChartOfAccount | None"] = relationship(foreign_keys=[output_tax_account_id])
    input_tax_account: Mapped["ChartOfAccount | None"] = relationship(foreign_keys=[input_tax_account_id])
    sales_journal: Mapped["Journal | None"] = relationship(foreign_keys=[sales_journal_id])
    purchase_journal: Mapped["Journal | None"] = relationship(foreign_keys=[purchase_journal_id])
    bank_journal: Mapped["Journal | None"] = relationship(foreign_keys=[bank_journal_id])
    cash_journal: Mapped["Journal | None"] = relationship(foreign_keys=[cash_journal_id])
