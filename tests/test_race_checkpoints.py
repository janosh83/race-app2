

def test_get_race_checkpoints(test_client, add_test_data):
    """Test endpoint GET /api/race/race_id/checkpoints/checkpoint_id """
    response = test_client.get("/api/race/1/checkpoints/1/") # get first checkpoint
    assert response.status_code == 200
    assert response.json == {
        "id": 1, 
        "title": "Praha", 
        "latitude": 50.0755381, 
        "longitude": 14.4378005, 
        "description": "Hlavní město České republiky", 
        "numOfPoints": 1
    }

    response = test_client.get("/api/race/1/checkpoints/2/") # get second checkpoint
    assert response.status_code == 200
    assert response.json == {
        "id": 2, 
        "title": "Brno", 
        "latitude": 49.1950602, 
        "longitude": 16.6068371, 
        "description": "Město na jihu Moravy", 
        "numOfPoints": 1
    }

    response = test_client.get("/api/race/1/checkpoints/3/") # non existing checkpoint
    assert response.status_code == 404

    response = test_client.get("/api/race/2/checkpoints/1/") # non existing race
    assert response.status_code == 404

    response = test_client.get("/api/race/1/checkpoints/") # get all checkpoints for race
    assert response.status_code == 200
    assert response.json == [
        {
            "id": 1, 
            "title": "Praha", 
            "latitude": 50.0755381, 
            "longitude": 14.4378005, 
            "description": "Hlavní město České republiky", 
            "numOfPoints": 1
        },
        {
            "id": 2, 
            "title": "Brno", 
            "latitude": 49.1950602, 
            "longitude": 16.6068371, 
            "description": "Město na jihu Moravy", 
            "numOfPoints": 1
        }
    ]
