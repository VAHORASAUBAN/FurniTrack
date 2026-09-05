"""Budget Report — design doc §4.3. Achieved is summed over POSTED journal
lines carrying the matching analytic account, never over document lines
directly — that's what lets a manual journal entry tagged with an analytic
count toward a budget, which a document-line-only computation would miss.

The sign convention (why `analytic_type` is read per-line rather than
assumed): an EXPENSE analytic accumulates debits (a vendor bill's expense
line), an INCOME analytic accumulates credits (an invoice's income line) —
matching the wireframe's note that invoice lines map to Income and
Bill/PO lines map to Expense.
"""
from datetime import date
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.orm import Session

_BUDGET_LINES_SQL = """
    SELECT
      bl.id AS budget_line_id, aa.id AS analytic_account_id, aa.name AS analytic_name,
      bl.analytic_type, bl.planned_amount,
      COALESCE((
        SELECT SUM(CASE WHEN bl.analytic_type = 'EXPENSE'
                        THEN jel.debit - jel.credit
                        ELSE jel.credit - jel.debit
                   END)
        FROM journal_entry_line jel
        JOIN journal_entry je ON je.id = jel.journal_entry_id
        WHERE jel.analytic_account_id = bl.analytic_account_id
          AND je.status = 'POSTED'
          AND je.entry_date BETWEEN b.start_date AND b.end_date
      ), 0) AS achieved_amount
    FROM budget_line bl
    JOIN budget b ON b.id = bl.budget_id
    JOIN analytic_account aa ON aa.id = bl.analytic_account_id
    WHERE b.id = :budget_id
    ORDER BY aa.name
"""

_DRILL_DOWN_SQL = """
    SELECT DISTINCT d.id, d.doc_type, d.doc_number, d.doc_date,
           c.name AS partner_name, d.total_amount
    FROM journal_entry_line jel
    JOIN journal_entry je ON je.id = jel.journal_entry_id
    JOIN document d ON d.id = je.source_document_id
    JOIN contact c ON c.id = d.partner_id
    WHERE jel.analytic_account_id = :analytic_id
      AND je.status = 'POSTED'
      AND je.entry_date BETWEEN :start_date AND :end_date
    ORDER BY d.doc_date DESC
"""


def compute_achieved_by_analytic(db: Session, budget_id: int) -> dict[int, dict]:
    """Returns {analytic_account_id: {achieved_amount, achieved_pct, remaining}}
    for every line on this budget — the shape `budget_service.attach_achieved`
    stamps onto each (transient, non-mapped) BudgetLine ORM object."""
    rows = db.execute(text(_BUDGET_LINES_SQL), {"budget_id": budget_id}).mappings().all()
    result: dict[int, dict] = {}
    for row in rows:
        planned = row["planned_amount"]
        achieved = row["achieved_amount"]
        achieved_pct = Decimal("0") if planned == 0 else (achieved / planned * 100)
        remaining = planned - achieved
        result[row["analytic_account_id"]] = {
            "achieved_amount": achieved,
            "achieved_pct": achieved_pct,
            "remaining": remaining,
        }
    return result


def build_drill_down(db: Session, analytic_id: int, start_date: date, end_date: date) -> list[dict]:
    rows = db.execute(
        text(_DRILL_DOWN_SQL), {"analytic_id": analytic_id, "start_date": start_date, "end_date": end_date}
    ).mappings().all()
    return [dict(r) for r in rows]
