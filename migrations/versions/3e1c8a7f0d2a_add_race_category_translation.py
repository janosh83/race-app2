"""add race category translation

Revision ID: 3e1c8a7f0d2a
Revises: 2a9d4c6f8b12
Create Date: 2026-02-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3e1c8a7f0d2a'
down_revision = '2a9d4c6f8b12'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'race_category_translation',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('race_category_id', sa.Integer(), nullable=False),
        sa.Column('language', sa.String(length=5), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['race_category_id'], ['race_category.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('race_category_id', 'language', name='uq_race_category_translation_language'),
    )


def downgrade():
    op.drop_table('race_category_translation')
