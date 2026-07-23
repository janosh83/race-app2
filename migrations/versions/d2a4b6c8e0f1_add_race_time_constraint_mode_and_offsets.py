"""add race time constraint mode and offsets

Revision ID: d2a4b6c8e0f1
Revises: f9e8d7c6b5a4
Create Date: 2026-07-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd2a4b6c8e0f1'
down_revision = 'f9e8d7c6b5a4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.add_column(sa.Column('time_constraint_mode', sa.String(length=32), nullable=False, server_default='fixed'))
        batch_op.add_column(sa.Column('start_showing_offset_seconds', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('end_showing_offset_seconds', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('start_logging_offset_seconds', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('end_logging_offset_seconds', sa.Integer(), nullable=True))

    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.alter_column('time_constraint_mode', server_default=None)


def downgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.drop_column('end_logging_offset_seconds')
        batch_op.drop_column('start_logging_offset_seconds')
        batch_op.drop_column('end_showing_offset_seconds')
        batch_op.drop_column('start_showing_offset_seconds')
        batch_op.drop_column('time_constraint_mode')
