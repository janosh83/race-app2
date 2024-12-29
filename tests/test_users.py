import pytest
from app import create_app, db

@pytest.fixture
def test_client():
    """Fixture pro testovací klient Flasku."""
    app = create_app("app.config.TestConfig")
    app.config["TESTING"] = True

    with app.test_client() as client:
        with app.app_context():
            db.create_all()
        yield client
        with app.app_context():
            db.drop_all()

def test_not_found(test_client):
    """Test, že neexistující endpoint vrací 404."""
    response = test_client.get("/api/nonexistent")
    assert response.status_code == 404

def test_auth_register(test_client):
    """Test registrace uživatele."""
    response = test_client.post("/auth/register/", json={"name": "test", "email": "test@example.com", "password": "test"})
    assert response.status_code == 201
    assert response.json == {"msg": "User created successfully"}

def test_auth_login(test_client):
    """Test přihlášení uživatele."""
    response = test_client.post("/auth/register/", json={"name": "test", "email": "test@example.com", "password": "test"})
    response = test_client.post("/auth/login/", json={"email": "test@example.com", "password": "test"})
    assert response.status_code == 200
    assert "access_token" in response.json

def test_auth_protected(test_client):
    """Test přístupu k chráněnému endpointu."""
    response = test_client.get("/auth/protected/")
    assert response.status_code == 401

    response = test_client.post("/auth/register/", json={"name": "test", "email": "test@example.com", "password": "test"})
    response = test_client.post("/auth/login/", json={"email": "test@example.com", "password": "test"})
    response = test_client.get("/auth/protected/", headers={"Authorization": f"Bearer {response.json['access_token']}"})
    assert response.status_code == 200
    assert "Hello, user" in response.json["msg"]