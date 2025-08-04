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

## How to run
TODO:

## How to deplow?
TODO:

http://localhost:5000/apidocs
Flasgger API documentation

## TODO:
add pytest into requirement.txt just for testing configuration
