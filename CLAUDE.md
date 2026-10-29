# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A race management application with:
- **Backend:** Flask + SQLAlchemy + JWT + Marshmallow + Flask-Migrate + Flask-Mail + Stripe
- **Frontend:** React 19 + Vite + React Router v7 + i18next + Leaflet maps
- **Database:** SQLite locally, PostgreSQL in production

## Commands

### Backend (run from repo root)

```bash
pip install -r requirements-dev.txt   # install deps (dev includes aiosmtpd)
flask db upgrade                       # apply migrations
python run.py                          # start dev server at http://localhost:5000
pytest                                 # run all backend tests
pytest tests/test_auth.py             # run a single test file
```

API docs available at `http://localhost:5000/apidocs` (Flasgger/Swagger).

### Frontend (run from `my-frontend/`)

```bash
npm install
npm run dev          # start dev server at http://localhost:5173
npm test             # run tests with Vitest
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run build        # production build → dist/
```

### Local email testing

```bash
python -m aiosmtpd -n -l localhost:1025   # SMTP sink in a separate terminal
```

## Architecture

### Backend structure

```
app/
  __init__.py        # App factory (create_app), extension init, CORS, logging
  models.py          # All SQLAlchemy models
  schemas.py         # Marshmallow schemas for serialization/validation
  config.py          # Config classes (DevelopmentConfig, ProductionConfig)
  constants.py       # SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, etc.
  utils.py           # Shared helpers
  routes/
    auth.py          # /auth — login, logout, refresh, password reset
    race.py          # /api/race — race CRUD
    checkpoint.py    # /api/checkpoint
    task.py          # /api/task
    team.py          # /api/team
    user.py          # /api/user
    race_category.py # /api/race-category
    race_api/        # Sub-module for race-scoped endpoints
      registration.py   # public registration + Stripe checkout
      visits.py         # checkpoint/task visit logging
      results.py        # standings/results
      statistics.py     # race statistics (admin)
      checkpoints.py    # checkpoint management
      tasks.py          # task management
      race_categories.py
      team_payment.py
  services/
    email_service.py          # Flask-Mail wrappers
    email_tracking_service.py # Brevo webhook processing
    stripe_service.py         # Stripe checkout session creation/webhook
  templates/emails/           # Localized email templates (en/cs/de)
```

### Data model relationships

- **Race** has Checkpoints, Tasks, Registrations, and RaceCategories (M2M)
- **Team** has members (User M2M) and Registrations
- **Registration** links Race + Team + RaceCategory; tracks Stripe payment via `stripe_session_id` and `RegistrationPaymentAttempt` rows
- **CheckpointLog / TaskLog** — one log per (checkpoint/task, team, race); stores image + GPS coords
- Translation tables follow a consistent pattern: `Race→RaceTranslation`, `Checkpoint→CheckpointTranslation`, etc., each with a unique constraint on `(parent_id, language)`

### Authentication

- JWT: short-lived access token stored in `localStorage`, long-lived refresh token in HttpOnly cookie
- `refreshAccessToken()` is called silently on focus/storage events in `App.jsx`
- Admin routes are gated by `is_administrator` flag on the `User` model

### Frontend structure

```
my-frontend/src/
  App.jsx             # Router setup, auth state management
  components/
    Pages/            # Route-level page components
    Admin/            # Admin dashboard sub-components
    Layouts/          # AdminLayout, RaceLayout (shared nav wrappers)
  services/           # API call modules: authApi, raceApi, adminApi, userApi
  contexts/
    TimeContext.jsx   # Shared server time sync
  utils/
    api.js            # Base fetch wrapper, token refresh logic
    logger.js         # Debug logger (controlled by VITE_DEBUG_MODE)
    image.js          # Image resize/EXIF strip before upload
    checkpointStatus.js
    navigation.js
    activeRaceUtils.js
    registrationImport.js
  locales/            # i18n translation files (en/cs/de)
```

### Key frontend patterns

- All API calls go through `utils/api.js`, which handles token injection and silent refresh on 401
- i18n via `i18next`; language is detected from browser and stored in user profile
- Maps use Leaflet with Mapy.com tiles (requires `VITE_MAPY_API_KEY`)
- Image uploads strip EXIF data client-side (`piexifjs`) before sending to backend
- HTML in checkpoint/task descriptions is sanitized with DOMPurify before rendering

## Environment variables

Root `.env` for backend, `my-frontend/.env` for frontend. See README.md section 3 for full templates.

Key backend vars: `FLASK_CONFIG`, `SECRET_KEY`, `JWT_SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS`, `STRIPE_RESTRICTED_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`.

Key frontend vars: `VITE_API_URL`, `VITE_MAPY_API_KEY`, `VITE_DEBUG_MODE`.

## Database migrations

After changing `models.py`, generate and apply a migration:

```bash
flask db migrate -m "description"
flask db upgrade
```
