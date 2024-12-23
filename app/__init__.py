from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from .config import Config

# database initialization
db = SQLAlchemy()

def create_app():
    """Vytvoří instanci aplikace Flask."""
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)

    # blueprint registration
    #from app.routes.users import users_bp
    #from app.routes.teams import teams_bp
    #app.register_blueprint(users_bp, url_prefix="/api/users")
    #app.register_blueprint(teams_bp, url_prefix="/api/teams")

    # basic route
    @app.route("/")
    def index():
        return {"message": "Welcome to the API!"}

    return app
