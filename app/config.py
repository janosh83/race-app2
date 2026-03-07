import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Single source of truth for env-backed defaults.
CONFIG_DEFAULTS = {
    "SECRET_KEY": "default-secret-key",
    "JWT_SECRET_KEY": "your_jwt_secret_key",
    "DATABASE_URL": "sqlite:///app.db",
    "CORS_ORIGINS": "http://localhost:5173",
    "MAIL_SERVER": "smtp-relay.brevo.com",
    "MAIL_PORT": "587",
    "MAIL_USE_TLS": "true",
    "MAIL_USERNAME": "",
    "MAIL_PASSWORD": "",
    "MAIL_DEFAULT_SENDER": "noreply@raceapp.com",
    "STRIPE_RESTRICTED_KEY": "",
    "STRIPE_PUBLISHABLE_KEY": "",
    "STRIPE_WEBHOOK_SECRET": "",
    "STRIPE_CURRENCY": "czk",
    "STRIPE_REGISTRATION_TEAM_AMOUNT": "50",
    "STRIPE_REGISTRATION_INDIVIDUAL_AMOUNT": "25",
    "LOG_LEVEL": "INFO",
    "LOG_REQUESTS": "true",
    "MAX_CONTENT_LENGTH": str(5 * 1024 * 1024),
}

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", CONFIG_DEFAULTS["SECRET_KEY"])
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', CONFIG_DEFAULTS["JWT_SECRET_KEY"])
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", CONFIG_DEFAULTS["DATABASE_URL"])
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    _raw_cors_origins = os.environ.get('CORS_ORIGINS', CONFIG_DEFAULTS["CORS_ORIGINS"])
    CORS_ORIGINS = [o.strip() for o in _raw_cors_origins.split(',') if o.strip()]
    # JWT lifetimes (override via environment if needed)
    # Access token valid for 30 minutes, refresh token for 30 days
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRES_SECONDS', str(30 * 60)))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        days=int(os.environ.get('JWT_REFRESH_TOKEN_EXPIRES_DAYS', '30'))
    )

    # Email Configuration (Brevo)
    MAIL_SERVER = os.environ.get('MAIL_SERVER', CONFIG_DEFAULTS["MAIL_SERVER"])
    MAIL_PORT = int(os.environ.get('MAIL_PORT', CONFIG_DEFAULTS["MAIL_PORT"]))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', CONFIG_DEFAULTS["MAIL_USE_TLS"]).lower() == 'true'
    MAIL_USE_SSL = False
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', CONFIG_DEFAULTS["MAIL_USERNAME"])
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', CONFIG_DEFAULTS["MAIL_PASSWORD"])
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', CONFIG_DEFAULTS["MAIL_DEFAULT_SENDER"])
    ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '').strip()
    REGISTRATION_ADMIN_EMAILS = [
        item.strip()
        for item in os.environ.get('REGISTRATION_ADMIN_EMAILS', '').replace(';', ',').split(',')
        if item.strip()
    ]
    FRONTEND_URL = CORS_ORIGINS[0] if CORS_ORIGINS else 'http://localhost:5173'
    IMAGE_UPLOAD_FOLDER = os.environ.get(
        'IMAGE_UPLOAD_FOLDER',
        os.path.join(BASE_DIR, 'static', 'images')
    )
    STRIPE_RESTRICTED_KEY = os.environ.get('STRIPE_RESTRICTED_KEY', CONFIG_DEFAULTS["STRIPE_RESTRICTED_KEY"])
    STRIPE_API_KEY = STRIPE_RESTRICTED_KEY
    STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', CONFIG_DEFAULTS["STRIPE_PUBLISHABLE_KEY"])
    STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', CONFIG_DEFAULTS["STRIPE_WEBHOOK_SECRET"])
    STRIPE_CURRENCY = os.environ.get('STRIPE_CURRENCY', CONFIG_DEFAULTS["STRIPE_CURRENCY"])
    _stripe_team_amount_units = os.environ.get('STRIPE_REGISTRATION_TEAM_AMOUNT')
    _stripe_team_amount_cents = os.environ.get('STRIPE_REGISTRATION_TEAM_AMOUNT_CENTS')
    STRIPE_REGISTRATION_TEAM_AMOUNT = int(_stripe_team_amount_units) if _stripe_team_amount_units else (
        max(int(_stripe_team_amount_cents) // 100, 1)
        if _stripe_team_amount_cents
        else int(CONFIG_DEFAULTS["STRIPE_REGISTRATION_TEAM_AMOUNT"])
    )
    _stripe_individual_amount_units = os.environ.get('STRIPE_REGISTRATION_INDIVIDUAL_AMOUNT')
    _stripe_individual_amount_cents = os.environ.get('STRIPE_REGISTRATION_INDIVIDUAL_AMOUNT_CENTS')
    STRIPE_REGISTRATION_INDIVIDUAL_AMOUNT = int(_stripe_individual_amount_units) if _stripe_individual_amount_units else (
        max(int(_stripe_individual_amount_cents) // 100, 1)
        if _stripe_individual_amount_cents
        else int(CONFIG_DEFAULTS["STRIPE_REGISTRATION_INDIVIDUAL_AMOUNT"])
    )
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', CONFIG_DEFAULTS["MAX_CONTENT_LENGTH"]))
    LOG_LEVEL = os.environ.get('LOG_LEVEL', CONFIG_DEFAULTS["LOG_LEVEL"])
    LOG_REQUESTS = os.environ.get('LOG_REQUESTS', CONFIG_DEFAULTS["LOG_REQUESTS"]).lower() == 'true'

class TestConfig(Config):
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"  # Použití in-memory databáze
    TESTING = True

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
