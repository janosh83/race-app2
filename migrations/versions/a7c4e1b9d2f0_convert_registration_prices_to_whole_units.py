"""convert registration prices to whole units

Revision ID: a7c4e1b9d2f0
Revises: e5c1a2b7f9d4
Create Date: 2026-02-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a7c4e1b9d2f0'
down_revision = 'e5c1a2b7f9d4'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()

    connection.execute(sa.text(
        """
        UPDATE race
        SET registration_team_amount_cents = CASE
            WHEN registration_team_amount_cents >= 100 THEN CAST(registration_team_amount_cents / 100 AS INTEGER)
            ELSE registration_team_amount_cents
        END,
        registration_individual_amount_cents = CASE
            WHEN registration_individual_amount_cents >= 100 THEN CAST(registration_individual_amount_cents / 100 AS INTEGER)
            ELSE registration_individual_amount_cents
        END,
        registration_driver_amount_cents = CASE
            WHEN registration_driver_amount_cents >= 100 THEN CAST(registration_driver_amount_cents / 100 AS INTEGER)
            ELSE registration_driver_amount_cents
        END,
        registration_codriver_amount_cents = CASE
            WHEN registration_codriver_amount_cents >= 100 THEN CAST(registration_codriver_amount_cents / 100 AS INTEGER)
            ELSE registration_codriver_amount_cents
        END
        """
    ))

    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.alter_column('registration_currency', server_default='czk')


def downgrade():
    connection = op.get_bind()

    connection.execute(sa.text(
        """
        UPDATE race
        SET registration_team_amount_cents = registration_team_amount_cents * 100,
            registration_individual_amount_cents = registration_individual_amount_cents * 100,
            registration_driver_amount_cents = registration_driver_amount_cents * 100,
            registration_codriver_amount_cents = registration_codriver_amount_cents * 100
        """
    ))

    with op.batch_alter_table('race', schema=None) as batch_op:
        batch_op.alter_column('registration_currency', server_default='eur')
