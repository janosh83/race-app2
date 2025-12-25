import pytest
from app import create_app, db

@pytest.fixture
def test_client():
    # make a test client for Flask app
    app = create_app("app.config.TestConfig")
    app.config["TESTING"] = True

    with app.test_client() as client:
        with app.app_context():
            db.create_all()
        yield client
        with app.app_context():
            db.drop_all()

def test_not_found(test_client):
    # test that non-existing endpoint returns 404
    response = test_client.get("/api/nonexistent")
    assert response.status_code == 404