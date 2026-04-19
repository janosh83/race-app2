"""add finish description to race

Revision ID: a6c4e2f1b9d3
Revises: f4c8b2d1a9e6
Create Date: 2026-04-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a6c4e2f1b9d3'
down_revision = 'f4c8b2d1a9e6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.add_column(sa.Column('finish_description', sa.String(length=255), nullable=True))


def downgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.drop_column('finish_description')