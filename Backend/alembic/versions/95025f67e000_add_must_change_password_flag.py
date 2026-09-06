"""add must change password flag

Revision ID: 95025f67e000
Revises: 506f5c09988f
Create Date: 2026-09-06 06:37:06.228334

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '95025f67e000'
down_revision: Union[str, None] = '506f5c09988f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user',
        sa.Column('must_change_password', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('user', 'must_change_password')
