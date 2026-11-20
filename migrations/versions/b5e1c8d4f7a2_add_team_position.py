"""add team_position table for live GPS trails

Revision ID: b5e1c8d4f7a2
Revises: a9d3e7c25b41
Create Date: 2026-10-31 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b5e1c8d4f7a2'
down_revision = 'a9d3e7c25b41'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'team_position',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('race_id', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('accuracy_m', sa.Float(), nullable=True),
        sa.Column('recorded_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['race_id'], ['race.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['team_id'], ['team.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_team_position_race_team_recorded', 'team_position', ['race_id', 'team_id', 'recorded_at'], unique=False)
    op.create_index('ix_team_position_user_race_created', 'team_position', ['user_id', 'race_id', 'created_at'], unique=False)


def downgrade():
    op.drop_index('ix_team_position_user_race_created', table_name='team_position')
    op.drop_index('ix_team_position_race_team_recorded', table_name='team_position')
    op.drop_table('team_position')
