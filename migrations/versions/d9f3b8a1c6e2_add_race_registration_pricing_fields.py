"""add race registration pricing fields

Revision ID: d9f3b8a1c6e2
Revises: c4e2a1d9b8f7
Create Date: 2026-02-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd9f3b8a1c6e2'
down_revision = 'c4e2a1d9b8f7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('registration_currency', sa.String(length=3), nullable=False, server_default='eur')
        )
        batch_op.add_column(
            sa.Column('registration_team_amount_cents', sa.Integer(), nullable=False, server_default='5000')
        )
        batch_op.add_column(
            sa.Column('registration_individual_amount_cents', sa.Integer(), nullable=False, server_default='2500')
        )


def downgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.drop_column('registration_individual_amount_cents')
        batch_op.drop_column('registration_team_amount_cents')
        batch_op.drop_column('registration_currency')
