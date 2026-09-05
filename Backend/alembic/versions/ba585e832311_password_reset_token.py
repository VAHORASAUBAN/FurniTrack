"""password reset token

Revision ID: ba585e832311
Revises: 445466128c47
Create Date: 2026-09-05 20:09:52.656718

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = 'ba585e832311'
down_revision: Union[str, None] = '445466128c47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('password_reset_token',
    sa.Column('id', mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
    sa.Column('user_id', mysql.BIGINT(unsigned=True), nullable=False),
    sa.Column('token_hash', sa.String(length=255), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('used_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], name=op.f('fk_password_reset_token_user_id_user')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_password_reset_token')),
    sa.UniqueConstraint('token_hash', name=op.f('uq_password_reset_token_token_hash'))
    )


def downgrade() -> None:
    op.drop_table('password_reset_token')
