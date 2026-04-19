import pytest
from datetime import datetime, timedelta
from app import db
from app.models import User, Race, Team, RaceCategory, Registration
from app.services.email_service import EmailService


def test_auth_register(test_client):
    # test user registration
    response = test_client.post("/auth/register/", json={"name": "test", "email": "test@example.com", "password": "test"})
    assert response.status_code == 201
    assert response.json == {"msg": "User created successfully"}

def test_auth_register_with_preferred_language(test_client):
    # test user registration with preferred language
    response = test_client.post("/auth/register/", json={
        "name": "test_lang",
        "email": "test_lang@example.com",
        "password": "test",
        "preferred_language": "cs"
    })
    assert response.status_code == 201

    # Login and verify preferred_language was set
    login_response = test_client.post("/auth/login/", json={
        "email": "test_lang@example.com",
        "password": "test"
    })
    assert login_response.status_code == 200
    assert login_response.json["user"]["preferred_language"] == "cs"

def test_auth_register_invalid_language(test_client):
    # test that invalid language code is rejected
    response = test_client.post("/auth/register/", json={
        "name": "test",
        "email": "test_invalid@example.com",
        "password": "test",
        "preferred_language": "invalid"
    })
    assert response.status_code == 400

def test_auth_login(test_client):
    # test user login
    response = test_client.post("/auth/register/", json={"name": "test", "email": "test@example.com", "password": "test"})
    response = test_client.post("/auth/login/", json={"email": "test@example.com", "password": "test"})
    assert response.status_code == 200
    assert "access_token" in response.json
    assert "user" in response.json
    assert "preferred_language" in response.json["user"]


def test_auth_refresh_success(test_client):
    test_client.post("/auth/register/", json={"name": "refresh", "email": "refresh@example.com", "password": "test"})
    login = test_client.post("/auth/login/", json={"email": "refresh@example.com", "password": "test"})
    assert login.status_code == 200

    refresh_token = login.json["refresh_token"]
    response = test_client.post("/auth/refresh/", headers={"Authorization": f"Bearer {refresh_token}"})
    assert response.status_code == 200
    assert "access_token" in response.json


def test_auth_refresh_deleted_user_returns_401(test_client, test_app):
    test_client.post("/auth/register/", json={"name": "refresh2", "email": "refresh2@example.com", "password": "test"})
    login = test_client.post("/auth/login/", json={"email": "refresh2@example.com", "password": "test"})
    assert login.status_code == 200

    refresh_token = login.json["refresh_token"]

    with test_app.app_context():
        user = User.query.filter_by(email="refresh2@example.com").first()
        assert user is not None
        db.session.delete(user)
        db.session.commit()

    response = test_client.post("/auth/refresh/", headers={"Authorization": f"Bearer {refresh_token}"})
    assert response.status_code == 401
    assert response.json["msg"] == "User not found"


def test_auth_login_signed_races_excludes_unpaid_registration(test_client, test_app):
    """Login payload should include only payment-confirmed signed races."""
    with test_app.app_context():
        now = datetime.now()
        later = now + timedelta(hours=2)

        race_paid = Race(
            name="Paid Race",
            description="Visible after payment",
            finish_description="Paid finish",
            finish_latitude=48.1234,
            finish_longitude=17.5678,
            bivak_1_name="Paid Camp",
            bivak_1_latitude=48.2234,
            bivak_1_longitude=17.6678,
            start_showing_checkpoints_at=now,
            end_showing_checkpoints_at=later,
            start_logging_at=now,
            end_logging_at=later,
        )
        race_unpaid = Race(
            name="Unpaid Race",
            description="Hidden until payment",
            start_showing_checkpoints_at=now,
            end_showing_checkpoints_at=later,
            start_logging_at=now,
            end_logging_at=later,
        )

        category = RaceCategory(name="General", description="General category")
        user = User(name="Login User", email="signed-races@example.com")
        user.set_password("pass")

        team_paid = Team(name="Paid Team")
        team_paid.members.append(user)
        team_unpaid = Team(name="Unpaid Team")
        team_unpaid.members.append(user)

        db.session.add_all([race_paid, race_unpaid, category, user, team_paid, team_unpaid])
        db.session.flush()

        paid_registration = Registration(
            race_id=race_paid.id,
            team_id=team_paid.id,
            race_category_id=category.id,
            payment_confirmed=True,
        )
        unpaid_registration = Registration(
            race_id=race_unpaid.id,
            team_id=team_unpaid.id,
            race_category_id=category.id,
            payment_confirmed=False,
        )
        db.session.add_all([paid_registration, unpaid_registration])
        db.session.commit()

        expected_paid_race_id = race_paid.id

    login_response = test_client.post(
        "/auth/login/",
        json={"email": "signed-races@example.com", "password": "pass"},
    )

    assert login_response.status_code == 200
    signed_races = login_response.json["signed_races"]
    assert len(signed_races) == 1
    assert signed_races[0]["race_id"] == expected_paid_race_id
    assert signed_races[0]["race_name"] == "Paid Race"
    assert signed_races[0]["finish_description"] == "Paid finish"
    assert signed_races[0]["finish_latitude"] == pytest.approx(48.1234)
    assert signed_races[0]["finish_longitude"] == pytest.approx(17.5678)
    assert signed_races[0]["bivak_1_name"] == "Paid Camp"

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

    response = test_client.post("/auth/register/", json={"name": "test", "email": "test@example.com", "password": "test"})
    response = test_client.post("/auth/login/", json={"email": "test@example.com", "password": "test"})
    access_token = response.json["access_token"]
    response = test_client.get("/auth/protected/", headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 200
    assert "Hello, user" in response.json["msg"]

    response = test_client.get("/auth/admin/", headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 403


def test_auth_register_cannot_self_assign_admin(test_client):
    response = test_client.post(
        "/auth/register/",
        json={
            "name": "test",
            "email": "noadmin@example.com",
            "password": "test",
            "is_administrator": True,
        },
    )
    assert response.status_code == 400

    # Ensure user was not created despite attempted privilege field injection.
    assert User.query.filter_by(email="noadmin@example.com").first() is None


def test_auth_register_admin_requires_admin_role(test_client):
    # Non-admin user should be rejected from admin registration endpoint.
    test_client.post("/auth/register/", json={"name": "user", "email": "user@example.com", "password": "test"})
    login = test_client.post("/auth/login/", json={"email": "user@example.com", "password": "test"})
    access_token = login.json["access_token"]

    response = test_client.post(
        "/auth/register-admin/",
        json={"name": "new admin", "email": "newadmin@example.com", "password": "test"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 403


def test_auth_register_admin_success(test_client, test_app):
    with test_app.app_context():
        admin = User(name="root", email="root@example.com", is_administrator=True)
        admin.set_password("test")
        db.session.add(admin)
        db.session.commit()

    login = test_client.post("/auth/login/", json={"email": "root@example.com", "password": "test"})
    access_token = login.json["access_token"]

    response = test_client.post(
        "/auth/register-admin/",
        json={"name": "second admin", "email": "admin2@example.com", "password": "test", "preferred_language": "cs"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == 201
    assert response.json == {"msg": "Administrator created successfully"}

    created = User.query.filter_by(email="admin2@example.com").first()
    assert created is not None
    assert created.is_administrator is True
    assert created.preferred_language == "cs"


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

