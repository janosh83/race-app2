# Race Application

Unified project documentation for backend, frontend, local development (Windows + macOS), deployment on Render, email setup, and external APIs.

## 1) Project Overview

This repository contains:
- **Backend:** Flask + SQLAlchemy + JWT + Marshmallow + Flask-Migrate + Flask-Mail
- **Frontend:** React + Vite + Vitest + ESLint
- **Database:** SQLite locally (default), PostgreSQL in production (recommended on Render)

## 2) Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- Git

Optional for local email testing:
- `aiosmtpd` (already in `requirements-dev.txt`)

## 3) Development Setup

### 3.1 Backend setup (root folder)

Install backend dependencies:

```bash
pip install -r requirements-dev.txt
```

Create `.env` in the repository root:

```env
FLASK_CONFIG=app.config.DevelopmentConfig
SECRET_KEY=dev-secret-key
JWT_SECRET_KEY=dev-jwt-secret
DATABASE_URL=sqlite:///app.db

# Comma-separated list of allowed frontend origins
CORS_ORIGINS=http://localhost:5173

# Local SMTP sink (recommended for local testing)
MAIL_SERVER=localhost
MAIL_PORT=1025
MAIL_USE_TLS=false
MAIL_USE_SSL=false
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_DEFAULT_SENDER=noreply@localhost.dev
# Admin notification recipients for completed registrations
# Use one or both settings below.
ADMIN_EMAIL=admin@example.com
REGISTRATION_ADMIN_EMAILS=admin1@example.com,admin2@example.com

# Optional image storage override
# IMAGE_UPLOAD_FOLDER=./app/static/images

# Stripe (registration payments)
# Per-race currency/pricing is configured in Admin UI.
# Variables below are fallback defaults for races without explicit pricing.
# Restricted key with Checkout Session permissions.
STRIPE_RESTRICTED_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CURRENCY=czk
STRIPE_REGISTRATION_TEAM_AMOUNT=50
STRIPE_REGISTRATION_INDIVIDUAL_AMOUNT=25

# Logging
LOG_LEVEL=INFO
LOG_REQUESTS=true

# Upload safety (bytes)
# Default is 5242880 (5 MB)
MAX_CONTENT_LENGTH=5242880
```

Run database migrations:

```bash
flask db upgrade
```

Start backend:

```bash
python run.py
```

Backend default URL: `http://localhost:5000`

API docs (Flasgger): `http://localhost:5000/apidocs`

### 3.2 Frontend setup (`my-frontend` folder)

```bash
cd my-frontend
npm install
```

Create `my-frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_MAPY_API_KEY=your-mapy-api-key
VITE_DEBUG_MODE=true
```

Start frontend:

```bash
npm run dev
```

Frontend default URL: `http://localhost:5173`

### 3.3 Windows quick commands

Backend:

```powershell
pip install -r requirements-dev.txt
flask db upgrade
python run.py
```

Frontend:

```powershell
cd my-frontend
npm install
npm run dev
```

### 3.4 macOS quick commands

Backend:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
flask db upgrade
python run.py
```

Frontend:

```bash
cd my-frontend
npm install
npm run dev
```

### 3.5 macOS port 5000 conflict note

On macOS, AirPlay/Control Center may bind port `5000`.

If needed:
- Use `VITE_API_URL=http://127.0.0.1:5000`, or
- Run Flask on a different port and update `VITE_API_URL` accordingly.

Quick CORS preflight check:

```bash
curl -i -X OPTIONS 'http://127.0.0.1:5000/api/race/' \
  -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Authorization, Content-Type'
```

## 4) Email Setup

### 4.1 Local development (SMTP sink)

Start local SMTP sink in a separate terminal:

```bash
python -m aiosmtpd -n -l localhost:1025
```

With the `.env` values above, password reset and registration emails are captured locally and printed to terminal.

Test endpoint:

```bash
curl -X POST http://localhost:5000/auth/request-password-reset/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### 4.2 Production email (Brevo SMTP)

Set in backend environment:

```env
MAIL_SERVER=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-brevo-email@example.com
MAIL_PASSWORD=your-brevo-smtp-key
MAIL_DEFAULT_SENDER=noreply@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
REGISTRATION_ADMIN_EMAILS=admin1@yourdomain.com,admin2@yourdomain.com
```

### 4.3 Stripe payments (registration checkout)

Backend uses Stripe Checkout for registration payments.

Set backend environment variables:

```env
# Restricted key with Checkout Session write permissions.
STRIPE_RESTRICTED_KEY=rk_test_or_live_...
STRIPE_PUBLISHABLE_KEY=pk_test_or_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
# fallback defaults if a race has no pricing configured
STRIPE_CURRENCY=czk
STRIPE_REGISTRATION_TEAM_AMOUNT=50
STRIPE_REGISTRATION_INDIVIDUAL_AMOUNT=25
```

Backend key selection:
- `STRIPE_RESTRICTED_KEY`

Required permissions for `STRIPE_RESTRICTED_KEY`:
- `Checkout Sessions: Write` (required; backend creates sessions)
- `Checkout Sessions: Read` (recommended; useful for operational checks)
- `Payment Intents: Read` (required for resolving receipt URL in confirmation emails)
- `Charges: Read` (required fallback for resolving receipt URL)
- `Webhooks: not required on API key` (signature validation uses `STRIPE_WEBHOOK_SECRET`)

How to configure restricted key in Stripe Dashboard:
1. Open `Developers -> API keys`.
2. Create or edit a Restricted key.
3. Enable the permissions listed above.
4. Use that key value as `STRIPE_RESTRICTED_KEY` in backend environment.
5. Repeat for both Test mode and Live mode (permissions are configured separately).

Webhook endpoint in backend:

```text
POST /api/race/registration/stripe/webhook/
```

Behavior summary:
- Public registration creates checkout session via backend.
- Race-level pricing strategy supports `team_flat` and `driver_codriver`.
- Stripe webhook `checkout.session.completed` confirms payment for the registration.
- Duplicate webhook deliveries are handled idempotently (no duplicate side effects).
- Team activation/race actions are gated by confirmed payment.

Note: For local webhook testing, use Stripe CLI and forward events to your local backend.

### 4.4 Stripe CLI local testing

Use Stripe CLI to forward test webhooks to local backend.

1) Install Stripe CLI:
- macOS: `brew install stripe/stripe-cli/stripe`
- Windows: install from Stripe docs, then verify with `stripe --version`

2) Authenticate CLI:

```bash
stripe login
```

3) Start local backend (`http://localhost:5000`) and listen/forward events:

```bash
stripe listen --forward-to localhost:5000/api/race/registration/stripe/webhook/
```

CLI prints a webhook signing secret like `whsec_...`.
Copy it into backend `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

4) Trigger a test event:

```bash
stripe trigger checkout.session.completed
```

5) Verify behavior:
- backend logs contain webhook processing with `request_id`,
- payment for matching registration is marked confirmed,
- duplicate deliveries remain idempotent.

Optional (resend an event by id):

```bash
stripe events resend <event_id> --webhook-endpoint=<webhook_endpoint_id>
```

### 4.5 Admin registration-completed notifications

When Stripe confirms a registration payment (`checkout.session.completed`), backend sends an admin notification email.

Configuration:
- `REGISTRATION_ADMIN_EMAILS` supports comma- or semicolon-separated addresses.
- `ADMIN_EMAIL` is used as fallback when `REGISTRATION_ADMIN_EMAILS` is empty.

Delivery details:
- Admin notification email is HTML-only (no plain text part).
- Email language is resolved from race default language (`race.default_language`) with fallback to app default language.
- Localized templates are used from:
  - `app/templates/emails/en/admin_registration_completed.html`
  - `app/templates/emails/cs/admin_registration_completed.html`
  - `app/templates/emails/de/admin_registration_completed.html`

### 4.6 Upload validation and limits

Image uploads for checkpoint/task logging are validated by:
- extension allowlist,
- MIME type allowlist,
- binary signature verification via Pillow.

Oversized upload requests are rejected with `413` and invalid image payloads are rejected with `400`.

Configuration:
- `MAX_CONTENT_LENGTH` (bytes), default `5242880` (5 MB).

## 5) Deployment on Render

Use **two services**: backend web service + frontend static site.

### 5.1 Backend (Render Web Service)

- **Root Directory:** repository root
- **Build Command:**

```bash
pip install -r requirements.txt
```

- **Start Command:**

```bash
gunicorn run:app
```

- **Recommended Environment Variables:**

```env
FLASK_CONFIG=app.config.ProductionConfig
SECRET_KEY=strong-random-secret
JWT_SECRET_KEY=strong-random-jwt-secret
DATABASE_URL=<Render PostgreSQL connection string>
CORS_ORIGINS=https://your-frontend.onrender.com

MAIL_SERVER=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-brevo-email@example.com
MAIL_PASSWORD=your-brevo-smtp-key
MAIL_DEFAULT_SENDER=noreply@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
REGISTRATION_ADMIN_EMAILS=admin1@yourdomain.com,admin2@yourdomain.com

STRIPE_RESTRICTED_KEY=rk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
# fallback defaults if a race has no pricing configured
STRIPE_CURRENCY=czk
STRIPE_REGISTRATION_TEAM_AMOUNT=50
STRIPE_REGISTRATION_INDIVIDUAL_AMOUNT=25

LOG_LEVEL=INFO
LOG_REQUESTS=true
MAX_CONTENT_LENGTH=5242880
```

After deploy, run migrations:

```bash
flask db upgrade
```

### 5.2 Frontend (Render Static Site)

- **Root Directory:** `my-frontend`
- **Build Command:**

```bash
npm install && npm run build
```

- **Publish Directory:**

```bash
dist
```

- **Environment Variables:**

```env
VITE_API_URL=https://your-backend.onrender.com
VITE_MAPY_API_KEY=your-mapy-api-key
VITE_DEBUG_MODE=false
```

SPA routing fallback is already configured via `static.json`.

## 6) External APIs and Services Used

### 6.1 Mapy.com Map Tiles API

- Used in frontend map components for base map rendering.
- Configured via `VITE_MAPY_API_KEY`.
- Endpoint pattern used by frontend:

```text
https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=<API_KEY>
```

### 6.2 Brevo SMTP (Email Delivery)

- Used by backend (`Flask-Mail`) for password reset and registration confirmation emails.
- SMTP relay host: `smtp-relay.brevo.com`.

### 6.3 Browser Geolocation API

- Used in frontend map flow to capture user location during checkpoint/task logging.
- Depends on browser permissions and HTTPS in production.

### 6.4 Stripe API (Checkout + Webhooks)

- Used by backend registration flow to create checkout sessions and verify webhook signatures.
- Checkout confirmation source of truth is persisted in backend registration payment fields.
- Webhook endpoint: `/api/race/registration/stripe/webhook/`.
- Restricted key must allow `Checkout Sessions: Write`, `Payment Intents: Read`, and `Charges: Read` for receipt URL enrichment.

## 7) Quality and Testing

Backend tests:

```bash
pytest
```

Frontend tests:

```bash
cd my-frontend
npm test
```

Frontend static analysis:

```bash
cd my-frontend
npm run lint
npm run lint:fix
```

## 8) Troubleshooting

- **CORS issues:** verify `CORS_ORIGINS` exactly matches frontend origin (including protocol and domain).
- **Auth redirect loops:** verify `VITE_API_URL` points to the correct backend URL.
- **Emails not sending:** verify SMTP credentials, sender identity, and backend logs.
- **Map not loading:** verify `VITE_MAPY_API_KEY` is present and valid.
- **Stripe checkout fails:** verify `STRIPE_RESTRICTED_KEY` has `Checkout Sessions: Write` and frontend/backend URLs for return links.
- **Receipt URL missing in confirmation email:** verify restricted key has `Payment Intents: Read` and `Charges: Read`.
- **Stripe webhook rejected:** verify `STRIPE_WEBHOOK_SECRET` and request signature source.
- **Missing request logs:** verify `LOG_REQUESTS=true` and suitable `LOG_LEVEL` (e.g., `INFO`).

## 9) Logging and Request Tracing

Backend logging now supports request correlation IDs and request timing.

- Incoming `X-Request-ID` is reused if provided; otherwise backend generates one.
- Response includes `X-Request-ID` for client-side correlation.
- Request completion logs include method, path, status, duration, and remote address.

Environment variables:

```env
LOG_LEVEL=INFO
LOG_REQUESTS=true
```

Example log format:

```text
[2026-02-23 10:12:34,567] INFO in app [request_id=5db4...]: request_completed method=POST path=/api/race/registration/stripe/webhook/ status=200 duration_ms=32.17 remote_addr=127.0.0.1
```
