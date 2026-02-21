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

# Optional image storage override
# IMAGE_UPLOAD_FOLDER=./app/static/images
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
```

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
