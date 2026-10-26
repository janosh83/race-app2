"""
Run the full Alembic migration chain on a fresh SQLite database.

Production runs on PostgreSQL but local development uses SQLite, so every
migration must work on both (e.g. no PostgreSQL-only SQL such as NOW()).
"""
import os

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from flask_migrate import downgrade, upgrade

from app import create_app, db
from app.config import TestConfig

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), '..', 'migrations')


@pytest.fixture
def migration_app(tmp_path):
    class MigrationTestConfig(TestConfig):
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{(tmp_path / 'migrations.db').as_posix()}"

    app = create_app(MigrationTestConfig)
    with app.app_context():
        yield app
        db.engine.dispose()


def test_upgrade_from_empty_database_matches_models(migration_app):
    upgrade(directory=MIGRATIONS_DIR)

    with db.engine.connect() as connection:
        diff = compare_metadata(MigrationContext.configure(connection), db.metadata)
    assert diff == []


def test_downgrade_to_base_and_upgrade_again(migration_app):
    upgrade(directory=MIGRATIONS_DIR)
    downgrade(directory=MIGRATIONS_DIR, revision='base')
    upgrade(directory=MIGRATIONS_DIR)
