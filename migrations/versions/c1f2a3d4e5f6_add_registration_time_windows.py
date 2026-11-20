"""add registration time windows

Per-registration windows for showing and logging checkpoints/tasks. They are
filled in when a payment is confirmed for a race in 'registration_shift' mode
(added in d2a4b6c8e0f1). Existing races keep 'fixed' mode, where every team
uses the race's own windows, so existing registrations are left NULL: copying
or deriving windows for them would change when teams of running or past races
may log visits.

Revision ID: c1f2a3d4e5f6
Revises: 2b6048cd2232
Create Date: 2026-07-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c1f2a3d4e5f6'
down_revision = '2b6048cd2232'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('registration', schema=None) as batch_op:
        batch_op.add_column(sa.Column('start_showing_checkpoints_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('end_showing_checkpoints_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('start_logging_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('end_logging_at', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('registration', schema=None) as batch_op:
        batch_op.drop_column('end_logging_at')
        batch_op.drop_column('start_logging_at')
        batch_op.drop_column('end_showing_checkpoints_at')
        batch_op.drop_column('start_showing_checkpoints_at')
