"""Balance Sheet / P&L response shapes — design doc §4.1, §4.2."""
from datetime import date

from pydantic import BaseModel

from app.models.enums import DocType
from app.schemas.common import Money


class AccountBalanceOut(BaseModel):
    id: int
    code: str
    name: str
    balance: Money


class BalanceSheetOut(BaseModel):
    as_of: date
    assets: list[AccountBalanceOut]
    liabilities: list[AccountBalanceOut]
    equity: list[AccountBalanceOut]
    net_income: Money
    total_assets: Money
    total_liabilities: Money
    total_equity: Money
    is_balanced: bool
    difference: Money


class ProfitLossLineOut(BaseModel):
    id: int
    code: str
    name: str
    amount: Money


class ProfitLossOut(BaseModel):
    date_from: date
    date_to: date
    income: list[ProfitLossLineOut]
    expenses: list[ProfitLossLineOut]
    other_expenses: list[ProfitLossLineOut]
    total_income: Money
    total_expenses: Money
    total_other_expense: Money
    net_profit: Money


class DocTypeCounts(BaseModel):
    draft: int
    confirmed: int
    cancelled: int


class PostedDocSummary(BaseModel):
    draft_count: int
    posted_count: int
    unpaid_count: int
    partially_paid_count: int
    paid_count: int
    total_amount_due: Money


class DashboardBudgetSummary(BaseModel):
    active_count: int
    total_planned: Money
    total_achieved: Money


class RecentDocumentOut(BaseModel):
    id: int
    doc_type: DocType
    doc_number: str
    doc_date: date
    status: str
    partner_name: str
    total_amount: Money


class DashboardSummaryOut(BaseModel):
    sales_orders: DocTypeCounts
    purchase_orders: DocTypeCounts
    customer_invoices: PostedDocSummary
    vendor_bills: PostedDocSummary
    budgets: DashboardBudgetSummary
    recent_documents: list[RecentDocumentOut]


class BudgetDrillDownItem(BaseModel):
    """One posted journal line behind an analytic account's Achieved figure
    (design doc §4.3/§8.4) or its all-time activity — clicking either opens
    this trace. A Bill/Invoice/PO/SO-sourced line carries its document;
    a manual entry has none, and falls back to the line's own label."""

    line_id: int
    entry_id: int
    entry_number: str
    entry_date: date
    source_type: str
    entry_reference: str | None
    document_id: int | None
    doc_type: DocType | None
    doc_number: str | None
    partner_name: str | None
    total_amount: Money | None
    debit: Money
    credit: Money
    label: str | None
