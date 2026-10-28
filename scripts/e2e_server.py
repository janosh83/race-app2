"""
Backend for the Playwright end-to-end tests (my-frontend/e2e).

Recreates a throwaway SQLite database from the migrations, seeds a fixed set
of users and races, and serves the API. Uploaded photos go to .e2e/images. Started automatically by
`npm run test:e2e`; it only ever touches .e2e/e2e.db.

Each E2E scenario logs in as its own user (see USERS), so tests don't
interfere with each other and need no reset between them. Keep USERS in sync
with my-frontend/e2e/fixtures.js.
"""
import os
import shutil
import sys
from datetime import datetime, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from flask_migrate import upgrade  # noqa: E402

from app import create_app, db  # noqa: E402
from app.config import DevelopmentConfig  # noqa: E402
from app.models import (  # noqa: E402
    Checkpoint, CheckpointLog, Race, RaceCategory, Registration, Task, TaskLog, Team, User,
)

E2E_DIR = REPO_ROOT / '.e2e'
DB_PATH = E2E_DIR / 'e2e.db'
IMAGES_DIR = E2E_DIR / 'images'
PORT = int(os.environ.get('E2E_BACKEND_PORT', '5055'))
FRONTEND_ORIGIN = os.environ.get('E2E_FRONTEND_ORIGIN', 'http://127.0.0.1:5175')
PASSWORD = 'e2e-password'

RUNNING_A = 'Running Race A'
RUNNING_B = 'Running Race B'
FUTURE = 'Future Race'
# One race per time phase (see timeStateForRace in the frontend).
NOT_STARTED = 'Not Started Race'   # before showing
PREVIEW = 'Preview Race'           # shown, logging not open yet
LOGGING_CLOSED = 'Logging Closed Race'  # logging ended, still shown
FINISHED = 'Finished Race'         # showing ended

# user key -> races the user's team is registered (and paid) for
USERS = {
    'solo': [RUNNING_A, FUTURE],      # exactly one running race -> auto-selected
    'multi': [RUNNING_A, RUNNING_B],  # two running races -> must choose
    'checkpoint': [RUNNING_A],
    'task': [RUNNING_A],
    'expiry': [RUNNING_A],
    'tabs': [RUNNING_A],
    'devices': [RUNNING_A],
    'before': [NOT_STARTED],
    'preview': [PREVIEW],
    'closed': [LOGGING_CLOSED],
    'finished': [FINISHED],
}
# Users whose team already visited 'North Gate' and completed 'Phase Task'
# while logging was open (seeded directly, the API would refuse it now).
PRE_LOGGED = {'closed': LOGGING_CLOSED, 'finished': FINISHED}
# Admin without a team, for tests that look things up behind the UI.
ADMIN_EMAIL = 'admin@e2e.test'


class E2EConfig(DevelopmentConfig):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{DB_PATH.as_posix()}"
    CORS_ORIGINS = [FRONTEND_ORIGIN]
    IMAGE_UPLOAD_FOLDER = str(IMAGES_DIR)
    FRONTEND_URL = FRONTEND_ORIGIN
    MAIL_SUPPRESS_SEND = True


def _race(name, show, log=None):
    # Windows are (start, end) pairs; logging defaults to the showing window.
    # Every boundary is at least a day away from now: the API sends naive
    # datetimes as GMT, so a day absorbs any local offset.
    log = log or show
    return Race(
        name=name,
        description=f'{name} (E2E)',
        start_showing_checkpoints_at=show[0],
        end_showing_checkpoints_at=show[1],
        start_logging_at=log[0],
        end_logging_at=log[1],
    )


def seed():
    now = datetime.now()
    category = RaceCategory(name='Open')
    db.session.add(category)
    db.session.flush()  # Registration needs category.id
    def days(n):
        return now + timedelta(days=n)

    races = {
        RUNNING_A: _race(RUNNING_A, (days(-1), days(1))),
        RUNNING_B: _race(RUNNING_B, (days(-1), days(1))),
        FUTURE: _race(FUTURE, (days(5), days(7))),
        NOT_STARTED: _race(NOT_STARTED, (days(2), days(4)), (days(2), days(3))),
        PREVIEW: _race(PREVIEW, (days(-1), days(3)), (days(2), days(3))),
        LOGGING_CLOSED: _race(LOGGING_CLOSED, (days(-3), days(2)), (days(-3), days(-1))),
        FINISHED: _race(FINISHED, (days(-4), days(-2)), (days(-4), days(-3))),
    }
    for race in races.values():
        race.categories.append(category)
        db.session.add(race)

    races[RUNNING_A].checkpoints.extend([
        Checkpoint(title='Old Mill', latitude=49.1951, longitude=16.6068, numOfPoints=2),
        Checkpoint(title='Lookout Tower', latitude=49.2002, longitude=16.6101, numOfPoints=1),
    ])
    races[RUNNING_A].tasks.extend([
        Task(title='Team Photo', description='Take a photo of the whole team.', numOfPoints=2),
        Task(title='Sing a Song', description='Sing the race anthem.', numOfPoints=1),
    ])
    for name in (NOT_STARTED, PREVIEW, LOGGING_CLOSED, FINISHED):
        races[name].checkpoints.extend([
            Checkpoint(title='North Gate', latitude=49.21, longitude=16.60, numOfPoints=3),
            Checkpoint(title='South Gate', latitude=49.18, longitude=16.61, numOfPoints=1),
        ])
        races[name].tasks.append(
            Task(title='Phase Task', description='Do something together.', numOfPoints=2))

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
        if key in PRE_LOGGED:
            race = races[PRE_LOGGED[key]]
            db.session.flush()  # ids for the logs
            checkpoint = next(c for c in race.checkpoints if c.title == 'North Gate')
            db.session.add_all([
                CheckpointLog(checkpoint_id=checkpoint.id, team_id=team.id, race_id=race.id),
                TaskLog(task_id=race.tasks[0].id, team_id=team.id, race_id=race.id),
            ])
    admin = User(name='E2E admin', email=ADMIN_EMAIL, preferred_language='en', is_administrator=True)
    admin.set_password(PASSWORD)
    db.session.add(admin)
    db.session.commit()


def main():
    E2E_DIR.mkdir(exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()
    shutil.rmtree(IMAGES_DIR, ignore_errors=True)
    IMAGES_DIR.mkdir()

    app = create_app(E2EConfig)
    with app.app_context():
        upgrade(directory=str(REPO_ROOT / 'migrations'))
        seed()

    print(f'E2E backend ready on http://127.0.0.1:{PORT} (db: {DB_PATH})', flush=True)
    app.run(host='127.0.0.1', port=PORT, debug=False, use_reloader=False)


if __name__ == '__main__':
    main()
