"""add race registration config

Revision ID: f2b7a9c41d3e
Revises: 3e1c8a7f0d2a
Create Date: 2026-02-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f2b7a9c41d3e'
down_revision = '3e1c8a7f0d2a'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('min_team_size', sa.Integer(), nullable=False, server_default='1')
        )
        batch_op.add_column(
            sa.Column('max_team_size', sa.Integer(), nullable=False, server_default='2')
        )
        batch_op.add_column(
            sa.Column('allow_team_registration', sa.Boolean(), nullable=False, server_default=sa.text('1'))
        )
        batch_op.add_column(
            sa.Column('allow_individual_registration', sa.Boolean(), nullable=False, server_default=sa.text('0'))
        )


def downgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.drop_column('allow_individual_registration')
        batch_op.drop_column('allow_team_registration')
        batch_op.drop_column('max_team_size')
        batch_op.drop_column('min_team_size')
