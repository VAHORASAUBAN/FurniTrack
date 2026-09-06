"""Dashboard summary — design doc §5.8: "One /dashboard/summary call backs
the whole landing screen." Every figure here is read fresh on each request,
same derive-don't-store philosophy as the rest of the report layer -
there is nothing to keep in sync.
"""
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import Budget
from app.models.enums import BudgetStatus, DocType
from app.reports.budget_report import compute_achieved_by_analytic

_ORDER_COUNTS_SQL = """
    SELECT status, COUNT(*) AS cnt
    FROM document
    WHERE doc_type = :doc_type
    GROUP BY status
"""

_POSTED_DOC_SUMMARY_SQL = """
    SELECT
      COALESCE(SUM(CASE WHEN d.status = 'DRAFT' THEN 1 ELSE 0 END), 0) AS draft_count,
      COALESCE(SUM(CASE WHEN d.status = 'POSTED' THEN 1 ELSE 0 END), 0) AS posted_count,
      COALESCE(SUM(CASE WHEN d.status = 'POSTED' AND vb.payment_status = 'UNPAID' THEN 1 ELSE 0 END), 0) AS unpaid_count,
      COALESCE(SUM(CASE WHEN d.status = 'POSTED' AND vb.payment_status = 'PARTIALLY_PAID' THEN 1 ELSE 0 END), 0) AS partially_paid_count,
      COALESCE(SUM(CASE WHEN d.status = 'POSTED' AND vb.payment_status = 'PAID' THEN 1 ELSE 0 END), 0) AS paid_count,
      COALESCE(SUM(CASE WHEN d.status = 'POSTED' THEN vb.amount_due ELSE 0 END), 0) AS total_amount_due
    FROM document d
    LEFT JOIN v_document_balance vb ON vb.document_id = d.id
    WHERE d.doc_type = :doc_type
"""

_RECENT_DOCUMENTS_SQL = """
    SELECT d.id, d.doc_type, d.doc_number, d.doc_date, d.status, d.total_amount, d.updated_at, c.name AS partner_name
    FROM document d
    JOIN contact c ON c.id = d.partner_id
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT :limit
"""


def _order_counts(db: Session, doc_type: DocType) -> dict:
    rows = db.execute(text(_ORDER_COUNTS_SQL), {"doc_type": doc_type.value}).mappings().all()
    counts = {"draft": 0, "confirmed": 0, "cancelled": 0}
    for row in rows:
        key = {"DRAFT": "draft", "CONFIRMED": "confirmed", "CANCELLED": "cancelled"}.get(row["status"])
        if key:
            counts[key] = row["cnt"]
    return counts


def _posted_doc_summary(db: Session, doc_type: DocType) -> dict:
    row = db.execute(text(_POSTED_DOC_SUMMARY_SQL), {"doc_type": doc_type.value}).mappings().one()
    return dict(row)


def _budget_summary(db: Session) -> dict:
    budgets = db.query(Budget).filter(Budget.status == BudgetStatus.CONFIRMED).all()
    total_planned = sum((line.planned_amount for b in budgets for line in b.lines), start=0) or 0
    total_achieved = 0
    for budget in budgets:
        achieved_by_analytic = compute_achieved_by_analytic(db, budget.id)
        total_achieved += sum(stats["achieved_amount"] for stats in achieved_by_analytic.values())
    return {"active_count": len(budgets), "total_planned": total_planned, "total_achieved": total_achieved}


def _recent_documents(db: Session, limit: int = 8) -> list[dict]:
    rows = db.execute(text(_RECENT_DOCUMENTS_SQL), {"limit": limit}).mappings().all()
    return [dict(r) for r in rows]


def build_dashboard_summary(db: Session) -> dict:
    return {
        "sales_orders": _order_counts(db, DocType.SALES_ORDER),
        "purchase_orders": _order_counts(db, DocType.PURCHASE_ORDER),
        "customer_invoices": _posted_doc_summary(db, DocType.CUSTOMER_INVOICE),
        "vendor_bills": _posted_doc_summary(db, DocType.VENDOR_BILL),
        "budgets": _budget_summary(db),
        "recent_documents": _recent_documents(db),
    }
