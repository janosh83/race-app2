def test_endpoint_not_found(test_client):
    """Test that non-existing endpoint returns 404"""
    response = test_client.get("/api/nonexistent")
    assert response.status_code == 404