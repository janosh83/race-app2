import pytest
from datetime import datetime, timedelta
from app import create_app, db
from app.models import User
from app.services.email_service import EmailService

@pytest.fixture
def test_client():
    app = create_app("app.config.TestConfig")
    app.config["TESTING"] = True

    with app.test_client() as client:
        with app.app_context():
            db.create_all()
        yield client
        with app.app_context():
            db.drop_all()


def test_auth_register(test_client):
    # test user registration
    response = test_client.post("/auth/register/", json={"name": "test", "email": "test@example.com", "password": "test"})
    assert response.status_code == 201
    assert response.json == {"msg": "User created successfully"}

def test_auth_login(test_client):
    # test user login
    response = test_client.post("/auth/register/", json={"name": "test", "email": "test@example.com", "password": "test"})
    response = test_client.post("/auth/login/", json={"email": "test@example.com", "password": "test"})
    assert response.status_code == 200
    assert "access_token" in response.json

def test_auth_protected(test_client):
    # test access to protected endpoint
    response = test_client.get("/auth/protected/")
    assert response.status_code == 401

    response = test_client.post("/auth/register/", json={"name": "test", "email": "test@example.com", "password": "test"})
    response = test_client.post("/auth/login/", json={"email": "test@example.com", "password": "test"})
    response = test_client.get("/auth/protected/", headers={"Authorization": f"Bearer {response.json['access_token']}"})
    assert response.status_code == 200
    assert "Hello, user" in response.json["msg"]

def test_auth_admin_required(test_client):
    # test that protected endpoint requires admin rights
    response = test_client.get("/auth/protected/")
    assert response.status_code == 401

    response = test_client.post("/auth/register/", json={"name": "test", "email": "test@example.com", "password": "test", "is_administrator": True})
    response = test_client.post("/auth/login/", json={"email": "test@example.com", "password": "test"})
    access_token = response.json["access_token"]
    response = test_client.get("/auth/protected/", headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 200
    assert "Hello, user" in response.json["msg"]

    response = test_client.get("/auth/admin/", headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 200
    assert "Hello, admin " in response.json["msg"]


def test_request_password_reset_missing_email(test_client):
    # missing email should return 400
    response = test_client.post("/auth/request-password-reset/", json={})
    assert response.status_code == 400
    assert response.json["msg"] == "Email is required"


def test_request_password_reset_nonexistent_email(test_client, monkeypatch):
    # stub email sending to avoid external calls
    monkeypatch.setattr(EmailService, "send_password_reset_email", lambda *args, **kwargs: True)

    response = test_client.post("/auth/request-password-reset/", json={"email": "noone@example.com"})
    assert response.status_code == 200
    assert "msg" in response.json
    # ensure no user exists, hence no token set
    assert User.query.filter_by(email="noone@example.com").first() is None


def test_request_password_reset_existing_user_sets_token(test_client, monkeypatch):
    # stub email sending
    monkeypatch.setattr(EmailService, "send_password_reset_email", lambda *args, **kwargs: True)

    # create a user
    resp = test_client.post("/auth/register/", json={"name": "U", "email": "u@example.com", "password": "pass"})
    assert resp.status_code == 201

    # request reset
    resp = test_client.post("/auth/request-password-reset/", json={"email": "u@example.com"})
    assert resp.status_code == 200

    # verify token and expiry set
    user = User.query.filter_by(email="u@example.com").first()
    assert user is not None
    assert user.reset_token is not None
    assert user.reset_token_expiry is not None


def test_reset_password_invalid_token(test_client):
    # attempt reset with invalid token
    resp = test_client.post("/auth/reset-password/", json={"token": "invalid", "new_password": "new"})
    assert resp.status_code == 400
    assert resp.json["msg"] in ["Invalid or expired token", "Token and new password are required"]


def test_reset_password_expired_token(test_client):
    # create user and set expired token
    resp = test_client.post("/auth/register/", json={"name": "E", "email": "e@example.com", "password": "old"})
    assert resp.status_code == 201

    user = User.query.filter_by(email="e@example.com").first()
    user.reset_token = "expired-token"
    user.reset_token_expiry = datetime.now() - timedelta(hours=1)
    db.session.commit()

    # try to reset using expired token
    resp = test_client.post("/auth/reset-password/", json={"token": "expired-token", "new_password": "new"})
    assert resp.status_code == 400
    assert resp.json["msg"] == "Token has expired"

    # token should be cleared
    user = User.query.filter_by(email="e@example.com").first()
    assert user.reset_token is None
    assert user.reset_token_expiry is None


def test_reset_password_success(test_client):
    # create user
    resp = test_client.post("/auth/register/", json={"name": "S", "email": "s@example.com", "password": "old"})
    assert resp.status_code == 201

    # set valid token
    user = User.query.filter_by(email="s@example.com").first()
    user.reset_token = "valid-token"
    user.reset_token_expiry = datetime.now() + timedelta(hours=1)
    db.session.commit()

    # reset password
    resp = test_client.post("/auth/reset-password/", json={"token": "valid-token", "new_password": "newpass"})
    assert resp.status_code == 200
    assert resp.json["msg"] == "Password reset successfully"

    # token cleared and password updated
    user = User.query.filter_by(email="s@example.com").first()
    assert user.reset_token is None
    assert user.reset_token_expiry is None
    assert user.check_password("newpass")

