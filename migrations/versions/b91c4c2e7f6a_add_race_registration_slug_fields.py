"""add race registration slug fields

Revision ID: b91c4c2e7f6a
Revises: f2b7a9c41d3e
Create Date: 2026-02-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b91c4c2e7f6a'
down_revision = 'f2b7a9c41d3e'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.add_column(sa.Column('registration_slug', sa.String(length=120), nullable=True))
        batch_op.add_column(
            sa.Column('registration_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false'))
        )
        batch_op.create_unique_constraint('uq_race_registration_slug', ['registration_slug'])


def downgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.drop_constraint('uq_race_registration_slug', type_='unique')
        batch_op.drop_column('registration_enabled')
        batch_op.drop_column('registration_slug')
