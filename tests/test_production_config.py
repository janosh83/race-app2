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


def test_production_config_allows_strong_signing_secrets():
    """Production config starts when signing secrets and Stripe key are configured."""
    class ProductionConfig(Config):
        SECRET_KEY = "strong-production-secret"
        JWT_SECRET_KEY = "strong-production-jwt-secret"
        STRIPE_RESTRICTED_KEY = "rk_test_123"

    app = create_app(ProductionConfig)
    assert app is not None
