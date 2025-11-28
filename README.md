# Race application

## How to install?

### Production
Python packages installation
    pip install -r requirements.txt

Front-end setup:
On Render, create a new Static Site:
   - Build Command: `npm run build`
   - Publish Directory: `build`

### Development
Python packages installation
    pip install -r requirements-dev.txt

Setup backend .env (root directory)file:
    FLASK_CONFIG=app.config.DevelopmentConfig
    SECRET_KEY=dev-secret-key
    DATABASE_URL=sqlite:///dev.db
    JWT_SECRET_KEY=dev-jwt-secret

Setup frontend .env (my-frontend directory) file
    REACT_APP_API_URL=http://localhost:5000

Note about macOS port 5000 conflict:
- On macOS, some system services (Control Center / AirPlay) may be bound to port 5000 and can intercept requests to `localhost:5000`, causing unexpected responses (you might see `Server: AirTunes` and `403` responses).
- If you encounter that, either:
    - Use 127.0.0.1 explicitly in your frontend env (e.g. `REACT_APP_API_URL=http://127.0.0.1:5000`) or
    - Run Flask on a different port (for example `FLASK_RUN_PORT=5001`) and update the frontend env accordingly.

Quick test to validate you hit the Flask app (preflight):
```bash
curl -i -X OPTIONS 'http://127.0.0.1:5000/api/race/' \
    -H 'Origin: http://localhost:3000' \
    -H 'Access-Control-Request-Method: POST' \
    -H 'Access-Control-Request-Headers: Authorization, Content-Type'
```

## How to run
TODO:

## How to deplow?
TODO:

http://localhost:5000/apidocs
Flasgger API documentation

## TODO:
add pytest into requirement.txt just for testing configuration
