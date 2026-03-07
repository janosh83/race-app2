"""add checkpoint_log race/team composite index

Revision ID: 8e4a9c2d1f0b
Revises: 6c3d9e1a4b2f
Create Date: 2026-03-07 12:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '8e4a9c2d1f0b'
down_revision = '6c3d9e1a4b2f'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        'ix_checkpoint_log_race_team',
        'checkpoint_log',
        ['race_id', 'team_id'],
        unique=False,
    )


def downgrade():
    op.drop_index('ix_checkpoint_log_race_team', table_name='checkpoint_log')
