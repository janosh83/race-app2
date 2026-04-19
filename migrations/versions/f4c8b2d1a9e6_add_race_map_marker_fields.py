"""add race map marker fields

Revision ID: f4c8b2d1a9e6
Revises: d2a8c9f4e7b1
Create Date: 2026-04-18 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f4c8b2d1a9e6'
down_revision = 'd2a8c9f4e7b1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.add_column(sa.Column('finish_latitude', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('finish_longitude', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('bivak_1_name', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('bivak_1_latitude', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('bivak_1_longitude', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('bivak_2_name', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('bivak_2_latitude', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('bivak_2_longitude', sa.Float(), nullable=True))


def downgrade():
    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.drop_column('bivak_2_longitude')
        batch_op.drop_column('bivak_2_latitude')
        batch_op.drop_column('bivak_2_name')
        batch_op.drop_column('bivak_1_longitude')
        batch_op.drop_column('bivak_1_latitude')
        batch_op.drop_column('bivak_1_name')
        batch_op.drop_column('finish_longitude')
        batch_op.drop_column('finish_latitude')