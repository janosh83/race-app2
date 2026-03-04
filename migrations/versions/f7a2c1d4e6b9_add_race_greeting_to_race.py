"""add race_greeting to race

Revision ID: f7a2c1d4e6b9
Revises: b1f4e2d9a7c3
Create Date: 2026-03-04 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f7a2c1d4e6b9'
down_revision = 'b1f4e2d9a7c3'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('race', sa.Column('race_greeting', sa.String(length=255), nullable=True))


def downgrade():
    op.drop_column('race', 'race_greeting')
