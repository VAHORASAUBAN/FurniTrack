"""Profit & Loss — design doc §4.2. `signed_amount` is credit-positive, so
Income rows come out positive naturally; Expense/Other Expense are negated
here for display so they read as positive figures, matching the wireframe.
"""
from datetime import date
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.reports.queries import POSTED_LINES_BASE

_PROFIT_LOSS_SQL = f"""
    SELECT a.account_type, a.id, a.code, a.name,
           SUM(jel.credit) - SUM(jel.debit) AS signed_amount
    {POSTED_LINES_BASE}
      AND je.entry_date BETWEEN :date_from AND :date_to
      AND a.account_type IN ('INCOME','EXPENSE','OTHER_EXPENSE')
    GROUP BY a.account_type, a.id, a.code, a.name
    HAVING signed_amount <> 0
    ORDER BY FIELD(a.account_type,'INCOME','EXPENSE','OTHER_EXPENSE'), a.code
"""


def build_profit_loss(db: Session, date_from: date, date_to: date) -> dict:
    rows = db.execute(text(_PROFIT_LOSS_SQL), {"date_from": date_from, "date_to": date_to}).mappings().all()

    income, expenses, other_expenses = [], [], []
    for row in rows:
        entry = {"id": row["id"], "code": row["code"], "name": row["name"]}
        if row["account_type"] == "INCOME":
            income.append({**entry, "amount": row["signed_amount"]})
        elif row["account_type"] == "EXPENSE":
            expenses.append({**entry, "amount": -row["signed_amount"]})
        else:
            other_expenses.append({**entry, "amount": -row["signed_amount"]})

    total_income = sum((e["amount"] for e in income), Decimal("0"))
    total_expenses = sum((e["amount"] for e in expenses), Decimal("0"))
    total_other_expense = sum((e["amount"] for e in other_expenses), Decimal("0"))
    net_profit = total_income - total_expenses - total_other_expense

    return {
        "date_from": date_from,
        "date_to": date_to,
        "income": income,
        "expenses": expenses,
        "other_expenses": other_expenses,
        "total_income": total_income,
        "total_expenses": total_expenses,
        "total_other_expense": total_other_expense,
        "net_profit": net_profit,
    }
