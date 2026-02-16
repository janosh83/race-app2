"""add race language settings

Revision ID: 4c2d3f9a1b10
Revises: 7f1d2b3c4e5a
Create Date: 2026-02-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4c2d3f9a1b10'
down_revision = '7f1d2b3c4e5a'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'supported_languages',
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'[\"en\", \"cs\", \"de\"]'"),
            )
        )
        batch_op.add_column(
            sa.Column(
                'default_language',
                sa.String(length=5),
                nullable=False,
                server_default='en',
            )
        )


def downgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.drop_column('default_language')
        batch_op.drop_column('supported_languages')
