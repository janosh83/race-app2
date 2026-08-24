"""lowercase user emails

Revision ID: c8a2d5f0e9b4
Revises: a6c4e2f1b9d3
Create Date: 2026-08-24 00:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'c8a2d5f0e9b4'
down_revision = 'a6c4e2f1b9d3'
branch_labels = None
depends_on = None


def upgrade():
    op.execute('UPDATE "user" SET email = LOWER(email) WHERE email IS NOT NULL')


def downgrade():
    # Email casing cannot be reliably restored after a lowercase migration.
    # This is intentionally a no-op to avoid destructive data changes.
    pass
