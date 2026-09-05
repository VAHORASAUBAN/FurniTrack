"""add product image url

Revision ID: b269085dfca2
Revises: ba585e832311
Create Date: 2026-09-06 03:09:41.625079

Autogenerate also proposed rewriting every table's created_at/updated_at
server_default from CURRENT_TIMESTAMP to now() - MySQL treats those as the
same function, reflected back differently than SQLAlchemy renders
func.now(); a cosmetic diff, not a real change, so trimmed to just the one
actual column addition this migration is for.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b269085dfca2'
down_revision: Union[str, None] = 'ba585e832311'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('product', sa.Column('image_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('product', 'image_url')
