import pytest

from app import create_app
from app.config import CONFIG_DEFAULTS, Config


def test_production_config_rejects_default_signing_secrets():
    """Production config must not start with default signing secrets."""
    class ProductionConfig(Config):
        SECRET_KEY = CONFIG_DEFAULTS["SECRET_KEY"]
        JWT_SECRET_KEY = CONFIG_DEFAULTS["JWT_SECRET_KEY"]
        STRIPE_RESTRICTED_KEY = "rk_test_123"

    with pytest.raises(RuntimeError, match="Unsafe production signing secrets"):
        create_app(ProductionConfig)


def test_production_config_rejects_weak_signing_secrets():
    """Production config must reject signing secrets that are too short or obviously weak."""
    class ProductionConfig(Config):
        SECRET_KEY = "short-secret"
        JWT_SECRET_KEY = "another-weak-secret"
        STRIPE_RESTRICTED_KEY = "rk_test_123"

    with pytest.raises(RuntimeError, match="strong values"):
        create_app(ProductionConfig)


def test_production_config_allows_strong_signing_secrets():
    """Production config starts when signing secrets and Stripe key are configured."""
    class ProductionConfig(Config):
        SECRET_KEY = "x7P7YNj5jHk5M5Q2aD6nL9sWmB8vC1uT"
        JWT_SECRET_KEY = "g7qT2xFz9mVnL4cP8sR6dK1wH3jY5nQx"
        STRIPE_RESTRICTED_KEY = "rk_test_123"

    app = create_app(ProductionConfig)
    assert app is not None
