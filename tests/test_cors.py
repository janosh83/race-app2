from app import create_app


def test_cors_preflight_allows_origin_and_authorization():
    # Create app with TestConfig so we don't require DB files
    app = create_app('app.config.TestConfig')

    with app.test_client() as client:
        headers = {
            'Origin': 'http://localhost:3000',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Authorization, Content-Type'
        }
        res = client.options('/api/race/', headers=headers)

        # Preflight should respond with a CORS header exposing the origin
        assert res.status_code in (200, 204)
        assert res.headers.get('Access-Control-Allow-Origin') == 'http://localhost:3000'

        # Ensure Authorization header is allowed on preflight responses
        allow_headers = res.headers.get('Access-Control-Allow-Headers') or ''
        assert 'Authorization' in allow_headers or '*' in allow_headers


def test_cors_preflight_auth_login_allows_origin_and_headers():
    app = create_app('app.config.TestConfig')
    with app.test_client() as client:
        headers = {
            'Origin': 'http://localhost:3000',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Authorization, Content-Type'
        }
        res = client.options('/auth/login/', headers=headers)
        assert res.status_code in (200, 204)
        assert res.headers.get('Access-Control-Allow-Origin') == 'http://localhost:3000'
        allow_headers = res.headers.get('Access-Control-Allow-Headers') or ''
        assert 'Authorization' in allow_headers or '*' in allow_headers
