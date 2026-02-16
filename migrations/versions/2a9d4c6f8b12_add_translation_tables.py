"""add translation tables

Revision ID: 2a9d4c6f8b12
Revises: 4c2d3f9a1b10
Create Date: 2026-02-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2a9d4c6f8b12'
down_revision = '4c2d3f9a1b10'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'race_translation',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('race_id', sa.Integer(), nullable=False),
        sa.Column('language', sa.String(length=5), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['race_id'], ['race.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('race_id', 'language', name='uq_race_translation_language'),
    )

    op.create_table(
        'checkpoint_translation',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('checkpoint_id', sa.Integer(), nullable=False),
        sa.Column('language', sa.String(length=5), nullable=False),
        sa.Column('title', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['checkpoint_id'], ['checkpoint.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('checkpoint_id', 'language', name='uq_checkpoint_translation_language'),
    )

    op.create_table(
        'task_translation',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False),
        sa.Column('language', sa.String(length=5), nullable=False),
        sa.Column('title', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['task_id'], ['task.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('task_id', 'language', name='uq_task_translation_language'),
    )


def downgrade():
    op.drop_table('task_translation')
    op.drop_table('checkpoint_translation')
    op.drop_table('race_translation')
