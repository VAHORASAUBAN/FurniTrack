"""document balance view

Revision ID: 445466128c47
Revises: 490f719d4d16
Create Date: 2026-09-05 15:34:40.679758

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '445466128c47'
down_revision: Union[str, None] = '490f719d4d16'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Design doc §2.4 / §3.3 — paid status is derived, never stored. Every
    # document list/detail read joins this view rather than each service
    # re-deriving amount_paid/payment_status from payment_allocation itself.
    op.execute("""
        CREATE OR REPLACE VIEW v_document_balance AS
        SELECT
          d.id AS document_id, d.doc_type, d.status AS doc_status, d.total_amount,
          COALESCE(SUM(CASE WHEN p.status='POSTED' THEN pa.amount_allocated END), 0) AS amount_paid,
          COALESCE(SUM(CASE WHEN p.status='POSTED' AND p.method='CASH' THEN pa.amount_allocated END), 0) AS paid_via_cash,
          COALESCE(SUM(CASE WHEN p.status='POSTED' AND p.method='BANK' THEN pa.amount_allocated END), 0) AS paid_via_bank,
          d.total_amount - COALESCE(SUM(CASE WHEN p.status='POSTED' THEN pa.amount_allocated END), 0) AS amount_due,
          CASE
            WHEN d.status IN ('DRAFT','CANCELLED') THEN d.status
            WHEN COALESCE(SUM(CASE WHEN p.status='POSTED' THEN pa.amount_allocated END), 0) = 0 THEN 'UNPAID'
            WHEN COALESCE(SUM(CASE WHEN p.status='POSTED' THEN pa.amount_allocated END), 0) < d.total_amount THEN 'PARTIALLY_PAID'
            ELSE 'PAID'
          END AS payment_status
        FROM document d
        LEFT JOIN payment_allocation pa ON pa.document_id = d.id
        LEFT JOIN payment p ON p.id = pa.payment_id
        GROUP BY d.id, d.doc_type, d.status, d.total_amount
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_document_balance")
