"""add refresh token jti to user

Revision ID: f3d8b4a11c22
Revises: c8a2d5f0e9b4
Create Date: 2026-08-24 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f3d8b4a11c22'
down_revision = 'c8a2d5f0e9b4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('refresh_token_jti', sa.String(length=64), nullable=True))

    op.create_index(op.f('ix_user_refresh_token_jti'), 'user', ['refresh_token_jti'], unique=True)


def downgrade():
    op.drop_index(op.f('ix_user_refresh_token_jti'), table_name='user')
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('refresh_token_jti')
