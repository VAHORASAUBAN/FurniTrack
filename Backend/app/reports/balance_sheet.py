"""Balance Sheet — design doc §4.1.

The report most teams get wrong: no posting rule in §3.2 ever moves an
income/expense balance into a balance-sheet account, so summing Assets
against Liabilities + Capital alone leaves the sheet short by exactly the
net profit. `net_income` is computed here and folded into Equity as a
"Current Period Earnings" line — it is never a row in chart_of_account.
"""
from datetime import date
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.reports.queries import POSTED_LINES_BASE

_BALANCE_SHEET_SQL = f"""
    SELECT a.id, a.code, a.name, a.account_type,
           SUM(jel.debit) - SUM(jel.credit) AS net_debit
    {POSTED_LINES_BASE}
      AND je.entry_date <= :as_of
      AND a.account_type IN ('ASSET','BANK','CASH','LIABILITY','CAPITAL')
    GROUP BY a.id, a.code, a.name, a.account_type
    HAVING net_debit <> 0
    ORDER BY a.code
"""

_NET_INCOME_SQL = f"""
    SELECT COALESCE(SUM(jel.credit) - SUM(jel.debit), 0) AS net_income
    {POSTED_LINES_BASE}
      AND je.entry_date <= :as_of
      AND a.account_type IN ('INCOME','EXPENSE','OTHER_EXPENSE')
"""


def build_balance_sheet(db: Session, as_of: date) -> dict:
    rows = db.execute(text(_BALANCE_SHEET_SQL), {"as_of": as_of}).mappings().all()
    net_income = db.execute(text(_NET_INCOME_SQL), {"as_of": as_of}).scalar() or Decimal("0")

    assets, liabilities, equity = [], [], []
    for row in rows:
        net_debit = row["net_debit"]
        entry = {"id": row["id"], "code": row["code"], "name": row["name"]}
        if row["account_type"] in ("ASSET", "BANK", "CASH"):
            assets.append({**entry, "balance": net_debit})
        elif row["account_type"] == "LIABILITY":
            liabilities.append({**entry, "balance": -net_debit})
        elif row["account_type"] == "CAPITAL":
            equity.append({**entry, "balance": -net_debit})

    total_assets = sum((a["balance"] for a in assets), Decimal("0"))
    total_liabilities = sum((l["balance"] for l in liabilities), Decimal("0"))
    total_capital = sum((e["balance"] for e in equity), Decimal("0"))
    total_equity = total_capital + net_income
    difference = total_assets - (total_liabilities + total_equity)

    return {
        "as_of": as_of,
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "net_income": net_income,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "total_equity": total_equity,
        "is_balanced": difference == 0,
        "difference": difference,
    }
