"""add registration email logs table

Revision ID: d2a8c9f4e7b1
Revises: 5f3c1a9b2d4e
Create Date: 2026-03-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd2a8c9f4e7b1'
down_revision = '5f3c1a9b2d4e'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'registration_email_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('registration_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('email_address', sa.String(length=128), nullable=False),
        sa.Column('template_type', sa.String(length=64), nullable=False),
        sa.Column('provider', sa.String(length=32), nullable=False, server_default='smtp'),
        sa.Column('provider_message_id', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('attempt_count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('first_attempted_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('last_attempted_at', sa.DateTime(), nullable=True),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.Column('opened_at', sa.DateTime(), nullable=True),
        sa.Column('bounced_at', sa.DateTime(), nullable=True),
        sa.Column('blocked_at', sa.DateTime(), nullable=True),
        sa.Column('provider_event_payload', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['registration_id'], ['registration.id']),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_registration_email_log_registration_id', 'registration_email_log', ['registration_id'])
    op.create_index('ix_registration_email_log_status', 'registration_email_log', ['status'])
    op.create_index('ix_registration_email_log_email_address', 'registration_email_log', ['email_address'])
    op.create_index('ix_registration_email_log_provider_message_id', 'registration_email_log', ['provider_message_id'])


def downgrade():
    op.drop_index('ix_registration_email_log_provider_message_id', table_name='registration_email_log')
    op.drop_index('ix_registration_email_log_email_address', table_name='registration_email_log')
    op.drop_index('ix_registration_email_log_status', table_name='registration_email_log')
    op.drop_index('ix_registration_email_log_registration_id', table_name='registration_email_log')
    op.drop_table('registration_email_log')
