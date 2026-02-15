"""add preferred language to user

Revision ID: 7f1d2b3c4e5a
Revises: 67c6913a8bca
Create Date: 2026-02-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7f1d2b3c4e5a'
down_revision = '67c6913a8bca'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('preferred_language', sa.String(length=5), nullable=True))


def downgrade():
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('preferred_language')
