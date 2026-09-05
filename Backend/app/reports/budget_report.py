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

_TRACE_SQL_BASE = """
    SELECT jel.id AS line_id, je.id AS entry_id, je.entry_number, je.entry_date,
           je.source_type, je.reference AS entry_reference,
           d.id AS document_id, d.doc_type, d.doc_number, d.total_amount,
           COALESCE(c.name, pc.name) AS partner_name,
           jel.debit, jel.credit, jel.label
    FROM journal_entry_line jel
    JOIN journal_entry je ON je.id = jel.journal_entry_id
    LEFT JOIN document d ON d.id = je.source_document_id
    LEFT JOIN contact c ON c.id = d.partner_id
    LEFT JOIN contact pc ON pc.id = jel.partner_id
    WHERE jel.analytic_account_id = :analytic_id
      AND je.status = 'POSTED'
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


def build_drill_down(
    db: Session, analytic_id: int, start_date: date | None = None, end_date: date | None = None
) -> list[dict]:
    """Every posted journal line tagged with this analytic, newest first -
    a Bill/Invoice/PO/SO-sourced line carries its document's number and
    partner; a manual entry (no source document) falls back to the line's
    own partner/label so it's traceable too, not silently dropped. Date
    bounds are optional: the Budget drill-down passes the budget's own
    period, the Analytic Account page's own "what's under this account"
    view passes none, for its whole history."""
    sql = _TRACE_SQL_BASE
    params: dict = {"analytic_id": analytic_id}
    if start_date is not None:
        sql += " AND je.entry_date >= :start_date"
        params["start_date"] = start_date
    if end_date is not None:
        sql += " AND je.entry_date <= :end_date"
        params["end_date"] = end_date
    sql += " ORDER BY je.entry_date DESC, je.id DESC"

    rows = db.execute(text(sql), params).mappings().all()
    return [dict(r) for r in rows]
