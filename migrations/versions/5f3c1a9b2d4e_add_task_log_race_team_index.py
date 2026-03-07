"""add task_log race/team composite index

Revision ID: 5f3c1a9b2d4e
Revises: 8e4a9c2d1f0b
Create Date: 2026-03-07 12:15:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '5f3c1a9b2d4e'
down_revision = '8e4a9c2d1f0b'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        'ix_task_log_race_team',
        'task_log',
        ['race_id', 'team_id'],
        unique=False,
    )


def downgrade():
    op.drop_index('ix_task_log_race_team', table_name='task_log')
