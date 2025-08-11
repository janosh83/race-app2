import pytest
from app import create_app, db
from app.models import Race, Team, Checkpoint, User

@pytest.fixture
def test_app():
    # Použití konfigurace pro testování
    app = create_app("app.config.TestConfig")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def test_client(test_app):
    # Vytvoření testovacího klienta
    return test_app.test_client()

@pytest.fixture
def add_test_data(test_app):
    # Vložení testovacích dat
    with test_app.app_context():
        race1 = Race(name="Jarní jízda", description="24 hodin objevování Česka")

        team1 = Team(name="Team1")
        team2 = Team(name="Team2")
        team3 = Team(name="Team3")

        user1 = User(name="User1", email="example1@example.com", is_administrator=True)
        user1.set_password("password")
        user2 = User(name="User2", email="example2@example.com")
        user2.set_password("password")
        team1.members = [user1, user2]

        user3 = User(name="User3", email="example3@example.com")
        user3.set_password("password")
        user4 = User(name="User4", email="example4@example.com")
        user4.set_password("password")
        team2.members = [user3, user4]

        user5 = User(name="User5", email="example5@example.com")
        user5.set_password("password")
        team3.members = [user5]

        checkpoint1 = Checkpoint(title="Checkpoint 1", latitude=50.0, longitude=14.0, description="Description", numOfPoints=1, race_id=1)
        checkpoint2 = Checkpoint(title="Checkpoint 2", latitude=50.0, longitude=14.5, description="Description", numOfPoints=2, race_id=1)
        checkpoint3 = Checkpoint(title="Checkpoint 3", latitude=50.5, longitude=15.0, description="Description", numOfPoints=1, race_id=1)

        race1.teams = [team1, team2, team3]

        db.session.add_all([race1, team1, team2, team3, checkpoint1, checkpoint2, checkpoint3])
        db.session.commit()

def test_log_visit(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}

    # Test logging of single visit (user is an admin)
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 1, "team_id": 1})
    assert response.status_code == 201
    assert response.json["checkpoint_id"] == 1
    assert response.json["team_id"] == 1
    assert response.json["race_id"] == 1

    # Test logging of single visit (user is member of the team)
    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers = {"Authorization": f"Bearer {response.json['access_token']}"}
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 1, "team_id": 1})
    assert response.status_code == 201
    assert response.json["checkpoint_id"] == 1
    assert response.json["team_id"] == 1
    assert response.json["race_id"] == 1

    # Test logging of visit with image
    with open("tests/test_image.jpg", "rb") as img:
        data = {"image": img, "checkpoint_id": 2, "team_id": 1}
        response = test_client.post(
            "/api/race/1/checkpoints/log/",
            headers=headers,
            data=data,
            content_type='multipart/form-data'
        )
    assert response.status_code == 201
    assert response.json["checkpoint_id"] == 2
    assert response.json["team_id"] == 1
    assert response.json["image_id"] == 1

    # test logging of checkpoint visit by non-existing team
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 2, "team_id": 4})
    assert response.status_code == 403

    # test logging of non-existing checkpoint team
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers, json={"checkpoint_id": 4, "team_id": 2})
    assert response.status_code == 403

def test_get_visits(test_client, add_test_data):
    # Test získání návštěv checkpointů
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    admin_header = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers1 = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/auth/login/", json={"email": "example3@example.com", "password": "password"})
    headers2 = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.get("/api/race/1/visits/", headers = admin_header)
    assert response.status_code == 200
    assert len(response.json) == 0

    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 1, "team_id": 1})
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers2, json={"checkpoint_id": 1, "team_id": 2})
    # total number of visists
    response = test_client.get("/api/race/1/visits/", headers = admin_header)
    assert response.status_code == 200
    assert len(response.json) == 2

    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 2, "team_id": 1})
    # visist by team 1
    response = test_client.get("/api/race/1/visits/1/", headers = headers1)
    assert response.status_code == 200
    assert len(response.json) == 2

    # visist by team 2
    response = test_client.get("/api/race/1/visits/2/", headers = headers2)
    assert response.status_code == 200
    assert len(response.json) == 1

def test_get_checkpoints_with_status(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers1 = {"Authorization": f"Bearer {response.json['access_token']}"}

    # 0 visits
    response = test_client.get("/api/race/1/checkpoints/1/status/", headers = headers1)
    assert response.status_code == 200
    assert len(response.json) == 3
    assert response.json[0]["visited"] == False
    assert response.json[1]["visited"] == False
    assert response.json[2]["visited"] == False

    # 1 visit
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 1, "team_id": 1})
    response = test_client.get("/api/race/1/checkpoints/1/status/", headers = headers1)
    assert response.status_code == 200
    assert len(response.json) == 3
    assert response.json[0]["visited"] == True
    assert response.json[1]["visited"] == False
    assert response.json[2]["visited"] == False

    # 2 visits
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 3, "team_id": 1})
    response = test_client.get("/api/race/1/checkpoints/1/status/", headers = headers1)
    assert response.status_code == 200
    assert len(response.json) == 3
    assert response.json[0]["visited"] == True
    assert response.json[1]["visited"] == False
    assert response.json[2]["visited"] == True
    
def test_unlog_visits(test_client, add_test_data):
    response = test_client.post("/auth/login/", json={"email": "example1@example.com", "password": "password"})
    admin_header = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/auth/login/", json={"email": "example2@example.com", "password": "password"})
    headers1 = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/auth/login/", json={"email": "example3@example.com", "password": "password"})
    headers2 = {"Authorization": f"Bearer {response.json['access_token']}"}

    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 1, "team_id": 1})
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 2, "team_id": 1})
    response = test_client.post("/api/race/1/checkpoints/log/", headers = headers2, json={"checkpoint_id": 1, "team_id": 2})
    # team 1 visits checkpoint 1 and 2
    # team 2 visits checkpoint 1

    # delete visit of checkpoint 2
    response = test_client.delete("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 2, "team_id": 1})
    assert response.status_code == 200
    response = test_client.get("/api/race/1/visits/1/", headers = headers1)
    assert response.status_code == 200
    assert len(response.json) == 1

    # test delete visit of non-existing visit
    response = test_client.delete("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 2, "team_id": 1})
    assert response.status_code == 404
    
    # delete visit of checkpoint 2 (no visits for team 1 logged)
    response = test_client.delete("/api/race/1/checkpoints/log/", headers = headers1, json={"checkpoint_id": 1, "team_id": 1})
    assert response.status_code == 200
    response = test_client.get("/api/race/1/visits/1/", headers = headers1)
    assert response.status_code == 200
    assert len(response.json) == 0