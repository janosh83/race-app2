"""add race pricing strategy fields

Revision ID: e5c1a2b7f9d4
Revises: d9f3b8a1c6e2
Create Date: 2026-02-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e5c1a2b7f9d4'
down_revision = 'd9f3b8a1c6e2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('registration_pricing_strategy', sa.String(length=32), nullable=False, server_default='team_flat')
        )
        batch_op.add_column(
            sa.Column('registration_driver_amount_cents', sa.Integer(), nullable=False, server_default='2500')
        )
        batch_op.add_column(
            sa.Column('registration_codriver_amount_cents', sa.Integer(), nullable=False, server_default='1500')
        )


def downgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.drop_column('registration_codriver_amount_cents')
        batch_op.drop_column('registration_driver_amount_cents')
        batch_op.drop_column('registration_pricing_strategy')
