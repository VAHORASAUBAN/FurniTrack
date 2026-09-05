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


class BudgetDrillDownItem(BaseModel):
    """One posted document behind a budget line's Achieved figure — design
    doc §4.3/§8.4: clicking Achieved opens the list of source documents."""

    id: int
    doc_type: DocType
    doc_number: str
    doc_date: date
    partner_name: str
    total_amount: Money
