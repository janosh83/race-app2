"""add place names to race translation

Translated finish and bivak names for the race map.

Revision ID: 2b6048cd2232
Revises: c7d2e9a1b3f4
Create Date: 2026-11-01 12:11:03.122418

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2b6048cd2232'
down_revision = 'c7d2e9a1b3f4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('race_translation', schema=None) as batch_op:
        batch_op.add_column(sa.Column('finish_description', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('bivak_1_name', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('bivak_2_name', sa.String(length=100), nullable=True))


def downgrade():
    with op.batch_alter_table('race_translation', schema=None) as batch_op:
        batch_op.drop_column('bivak_2_name')
        batch_op.drop_column('bivak_1_name')
        batch_op.drop_column('finish_description')
