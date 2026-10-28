"""
Backend for the Playwright end-to-end tests (my-frontend/e2e).

Recreates a throwaway SQLite database from the migrations, seeds a fixed set
of users and races, and serves the API. Started automatically by
`npm run test:e2e`; it only ever touches .e2e/e2e.db.

Each E2E scenario logs in as its own user (see USERS), so tests don't
interfere with each other and need no reset between them. Keep USERS in sync
with my-frontend/e2e/fixtures.js.
"""
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from flask_migrate import upgrade  # noqa: E402

from app import create_app, db  # noqa: E402
from app.config import DevelopmentConfig  # noqa: E402
from app.models import Checkpoint, Race, RaceCategory, Registration, Team, User  # noqa: E402

E2E_DIR = REPO_ROOT / '.e2e'
DB_PATH = E2E_DIR / 'e2e.db'
PORT = int(os.environ.get('E2E_BACKEND_PORT', '5055'))
FRONTEND_ORIGIN = os.environ.get('E2E_FRONTEND_ORIGIN', 'http://127.0.0.1:5175')
PASSWORD = 'e2e-password'

RUNNING_A = 'Running Race A'
RUNNING_B = 'Running Race B'
FUTURE = 'Future Race'

# user key -> races the user's team is registered (and paid) for
USERS = {
    'solo': [RUNNING_A, FUTURE],      # exactly one running race -> auto-selected
    'multi': [RUNNING_A, RUNNING_B],  # two running races -> must choose
    'checkpoint': [RUNNING_A],
    'expiry': [RUNNING_A],
    'tabs': [RUNNING_A],
    'devices': [RUNNING_A],
}


class E2EConfig(DevelopmentConfig):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{DB_PATH.as_posix()}"
    CORS_ORIGINS = [FRONTEND_ORIGIN]
    FRONTEND_URL = FRONTEND_ORIGIN
    MAIL_SUPPRESS_SEND = True


def _race(name, start, end):
    # Showing and logging windows are identical and generous: the API sends
    # naive datetimes as GMT, so a +/- 1 day window absorbs any local offset.
    return Race(
        name=name,
        description=f'{name} (E2E)',
        start_showing_checkpoints_at=start,
        end_showing_checkpoints_at=end,
        start_logging_at=start,
        end_logging_at=end,
    )


def seed():
    now = datetime.now()
    category = RaceCategory(name='Open')
    db.session.add(category)
    db.session.flush()  # Registration needs category.id
    races = {
        RUNNING_A: _race(RUNNING_A, now - timedelta(days=1), now + timedelta(days=1)),
        RUNNING_B: _race(RUNNING_B, now - timedelta(days=1), now + timedelta(days=1)),
        FUTURE: _race(FUTURE, now + timedelta(days=5), now + timedelta(days=7)),
    }
    for race in races.values():
        race.categories.append(category)
        db.session.add(race)

    races[RUNNING_A].checkpoints.extend([
        Checkpoint(title='Old Mill', latitude=49.1951, longitude=16.6068, numOfPoints=2),
        Checkpoint(title='Lookout Tower', latitude=49.2002, longitude=16.6101, numOfPoints=1),
    ])

    for key, race_names in USERS.items():
        user = User(name=f'E2E {key}', email=f'{key}@e2e.test', preferred_language='en')
        user.set_password(PASSWORD)
        team = Team(name=f'Team {key}')
        team.members.append(user)
        db.session.add_all([user, team])
        for race_name in race_names:
            db.session.add(Registration(
                race=races[race_name],
                team=team,
                race_category_id=category.id,
                payment_confirmed=True,
                payment_confirmed_at=now,
            ))
    db.session.commit()


def main():
    E2E_DIR.mkdir(exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()

    app = create_app(E2EConfig)
    with app.app_context():
        upgrade(directory=str(REPO_ROOT / 'migrations'))
        seed()

    print(f'E2E backend ready on http://127.0.0.1:{PORT} (db: {DB_PATH})', flush=True)
    app.run(host='127.0.0.1', port=PORT, debug=False, use_reloader=False)


if __name__ == '__main__':
    main()
