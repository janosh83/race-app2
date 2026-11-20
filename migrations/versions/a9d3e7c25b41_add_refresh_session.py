"""add refresh session table, drop user.refresh_token_jti

Revision ID: a9d3e7c25b41
Revises: f3d8b4a11c22
Create Date: 2026-10-26 20:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a9d3e7c25b41'
down_revision = 'f3d8b4a11c22'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'refresh_session',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('current_jti', sa.String(length=64), nullable=False),
        sa.Column('previous_jti', sa.String(length=64), nullable=True),
        sa.Column('rotated_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_refresh_session_user_id'), 'refresh_session', ['user_id'], unique=False)

    # Existing refresh tokens carry no session id and are rejected after this
    # migration, so users log in once more.
    op.drop_index(op.f('ix_user_refresh_token_jti'), table_name='user')
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('refresh_token_jti')


def downgrade():
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('refresh_token_jti', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_user_refresh_token_jti'), 'user', ['refresh_token_jti'], unique=True)

    op.drop_index(op.f('ix_refresh_session_user_id'), table_name='refresh_session')
    op.drop_table('refresh_session')
