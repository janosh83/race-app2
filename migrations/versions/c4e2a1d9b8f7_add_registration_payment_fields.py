"""add registration payment fields

Revision ID: c4e2a1d9b8f7
Revises: b91c4c2e7f6a
Create Date: 2026-02-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c4e2a1d9b8f7'
down_revision = 'b91c4c2e7f6a'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('registration', schema=None) as batch_op:
        batch_op.add_column(sa.Column('payment_confirmed', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('payment_confirmed_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('stripe_session_id', sa.String(length=255), nullable=True))
        batch_op.create_unique_constraint('uq_registration_stripe_session_id', ['stripe_session_id'])


def downgrade():
    with op.batch_alter_table('registration', schema=None) as batch_op:
        batch_op.drop_constraint('uq_registration_stripe_session_id', type_='unique')
        batch_op.drop_column('stripe_session_id')
        batch_op.drop_column('payment_confirmed_at')
        batch_op.drop_column('payment_confirmed')
