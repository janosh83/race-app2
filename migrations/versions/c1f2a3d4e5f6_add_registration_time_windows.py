# pyright: reportAttributeAccessIssue=false

"""add registration time windows

Revision ID: c1f2a3d4e5f6
Revises: a7c4e1b9d2f0
Create Date: 2026-07-23 00:00:00.000000

"""
from typing import Any, cast

from alembic import op as _op
import sqlalchemy as sa

alembic_op: Any = cast(Any, _op)


# revision identifiers, used by Alembic.
revision = 'c1f2a3d4e5f6'
down_revision = 'a7c4e1b9d2f0'
branch_labels = None
depends_on = None


def upgrade():
    with alembic_op.batch_alter_table('registration', schema=None) as batch_op:  # type: ignore[attr-defined]
        batch_op.add_column(sa.Column('start_showing_checkpoints_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('end_showing_checkpoints_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('start_logging_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('end_logging_at', sa.DateTime(), nullable=True))

    connection = alembic_op.get_bind()  # type: ignore[attr-defined]
    registration = sa.table(
        'registration',
        sa.column('id', sa.Integer()),
        sa.column('race_id', sa.Integer()),
        sa.column('payment_confirmed_at', sa.DateTime()),
        sa.column('start_showing_checkpoints_at', sa.DateTime()),
        sa.column('end_showing_checkpoints_at', sa.DateTime()),
        sa.column('start_logging_at', sa.DateTime()),
        sa.column('end_logging_at', sa.DateTime()),
    )
    race = sa.table(
        'race',
        sa.column('id', sa.Integer()),
        sa.column('start_showing_checkpoints_at', sa.DateTime()),
        sa.column('end_showing_checkpoints_at', sa.DateTime()),
        sa.column('start_logging_at', sa.DateTime()),
        sa.column('end_logging_at', sa.DateTime()),
    )

    rows = connection.execute(
        sa.select(
            registration.c.id,
            registration.c.payment_confirmed_at,
            race.c.start_showing_checkpoints_at,
            race.c.end_showing_checkpoints_at,
            race.c.start_logging_at,
            race.c.end_logging_at,
        )
        .select_from(registration.join(race, registration.c.race_id == race.c.id))
        .where(registration.c.payment_confirmed_at.isnot(None))
    ).mappings().all()

    for row in rows:
        confirmed_at = row['payment_confirmed_at']
        race_start_logging = row['start_logging_at']
        race_end_logging = row['end_logging_at']
        if not (confirmed_at and race_start_logging and race_end_logging):
            continue

        start_showing = row['start_showing_checkpoints_at']
        end_showing = row['end_showing_checkpoints_at']

        values = {
            'start_logging_at': confirmed_at,
            'end_logging_at': confirmed_at + (race_end_logging - race_start_logging),
            'start_showing_checkpoints_at': (
                confirmed_at + (start_showing - race_start_logging)
                if start_showing is not None
                else None
            ),
            'end_showing_checkpoints_at': (
                confirmed_at + (end_showing - race_start_logging)
                if end_showing is not None
                else None
            ),
        }

        connection.execute(
            registration.update()
            .where(registration.c.id == row['id'])
            .values(**values)
        )


def downgrade():
    with alembic_op.batch_alter_table('registration', schema=None) as batch_op:  # type: ignore[attr-defined]
        batch_op.drop_column('end_logging_at')
        batch_op.drop_column('start_logging_at')
        batch_op.drop_column('end_showing_checkpoints_at')
        batch_op.drop_column('start_showing_checkpoints_at')
