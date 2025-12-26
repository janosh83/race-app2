"""
Shared pytest fixtures for all tests.

This module contains fixtures that are automatically available to all test files
without needing to import them explicitly.
"""
import pytest
from app import create_app, db


@pytest.fixture(scope="function")
def test_app():
    """
    Create and configure a test application instance.
    
    Uses the TestConfig to ensure test database isolation.
    Database is created at the start and dropped at the end of each test.
    
    Yields:
        Flask application configured for testing
    """
    app = create_app("app.config.TestConfig")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture(scope="function")
def test_client(test_app):
    """
    Create a test client for the application.
    
    Args:
        test_app: The test application fixture
        
    Returns:
        Flask test client for making HTTP requests
    """
    return test_app.test_client()


# Common test utilities
@pytest.fixture
def admin_auth_headers(test_client, test_app):
    """
    Get authentication headers for an admin user.
    
    Creates an admin user if needed and returns headers with JWT token.
    This is a convenience fixture for tests that need admin authentication.
    
    Args:
        test_client: The test client fixture
        test_app: The test application fixture
        
    Returns:
        dict: Authorization headers with Bearer token
    """
    from app.models import User
    
    with test_app.app_context():
        # Check if admin user exists, create if not
        admin = User.query.filter_by(email="admin@test.com").first()
        if not admin:
            admin = User(name="Admin User", email="admin@test.com", is_administrator=True)
            admin.set_password("admin_password")
            db.session.add(admin)
            db.session.commit()
    
    response = test_client.post("/auth/login/", json={
        "email": "admin@test.com",
        "password": "admin_password"
    })
    return {"Authorization": f"Bearer {response.json['access_token']}"}


@pytest.fixture
def regular_user_auth_headers(test_client, test_app):
    """
    Get authentication headers for a regular (non-admin) user.
    
    Creates a regular user if needed and returns headers with JWT token.
    This is a convenience fixture for tests that need non-admin authentication.
    
    Args:
        test_client: The test client fixture
        test_app: The test application fixture
        
    Returns:
        dict: Authorization headers with Bearer token
    """
    from app.models import User
    
    with test_app.app_context():
        # Check if regular user exists, create if not
        user = User.query.filter_by(email="user@test.com").first()
        if not user:
            user = User(name="Regular User", email="user@test.com", is_administrator=False)
            user.set_password("user_password")
            db.session.add(user)
            db.session.commit()
    
    response = test_client.post("/auth/login/", json={
        "email": "user@test.com",
        "password": "user_password"
    })
    return {"Authorization": f"Bearer {response.json['access_token']}"}


# Pytest configuration
def pytest_configure(config):
    """
    Configure pytest with custom markers.
    """
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "unit: marks tests as unit tests"
    )
