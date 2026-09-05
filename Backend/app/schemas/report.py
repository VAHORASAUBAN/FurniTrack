"""Balance Sheet / P&L response shapes — design doc §4.1, §4.2."""
from datetime import date

from pydantic import BaseModel

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
