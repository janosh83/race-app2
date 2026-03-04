"""add race_greeting to race_translation

Revision ID: 6c3d9e1a4b2f
Revises: f7a2c1d4e6b9
Create Date: 2026-03-04 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6c3d9e1a4b2f'
down_revision = 'f7a2c1d4e6b9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('race_translation', sa.Column('race_greeting', sa.String(length=255), nullable=True))


def downgrade():
    op.drop_column('race_translation', 'race_greeting')
