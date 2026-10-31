"""add favourite_checkpoint table

Revision ID: c7d2e9a1b3f4
Revises: b5e1c8d4f7a2
Create Date: 2026-10-31 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c7d2e9a1b3f4'
down_revision = 'b5e1c8d4f7a2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'favourite_checkpoint',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('checkpoint_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['checkpoint_id'], ['checkpoint.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['team_id'], ['team.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('team_id', 'checkpoint_id', name='uq_favourite_checkpoint_team'),
    )
    op.create_index(op.f('ix_favourite_checkpoint_checkpoint_id'), 'favourite_checkpoint', ['checkpoint_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_favourite_checkpoint_checkpoint_id'), table_name='favourite_checkpoint')
    op.drop_table('favourite_checkpoint')
