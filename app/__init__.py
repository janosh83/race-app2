from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

# database initialization
db = SQLAlchemy()
migrate = Migrate()

def create_app(config_class="app.config.Config"):
    """Vytvoří instanci aplikace Flask."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)

    # blueprint registration
    from app.routes.users import users_bp
    from app.routes.races import race_bp
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(race_bp, url_prefix="/api/race")
    #app.register_blueprint(teams_bp, url_prefix="/api/teams")

    # basic route
    @app.route("/")
    def index():
        return {"message": "Welcome to the API!"}

    return app
