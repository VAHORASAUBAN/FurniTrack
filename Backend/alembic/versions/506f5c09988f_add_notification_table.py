"""add notification table

Revision ID: 506f5c09988f
Revises: b269085dfca2
Create Date: 2026-09-06 04:39:25.552884

Autogenerate also proposed the same cosmetic created_at/updated_at
server_default rewrite seen in b269085dfca2 - trimmed for the same reason.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = '506f5c09988f'
down_revision: Union[str, None] = 'b269085dfca2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'notification',
        sa.Column('id', mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('link', sa.String(length=255), nullable=True),
        sa.Column('created_by_user_id', mysql.BIGINT(unsigned=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['user.id'], name=op.f('fk_notification_created_by_user_id_user')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_notification')),
    )


def downgrade() -> None:
    op.drop_table('notification')
