from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS

# database initialization
db = SQLAlchemy()
migrate = Migrate()

def create_app(config_class="app.config.Config"):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    JWTManager(app)
    CORS(app, origins=["http://localhost:3000"], supports_credentials=True)

    # blueprint registration
    from app.routes.races import race_bp
    from app.routes.auth import auth_bp
    from app.routes.teams import team_bp
    app.register_blueprint(race_bp, url_prefix="/api/race")
    app.register_blueprint(team_bp, url_prefix="/api/team")
    app.register_blueprint(auth_bp, url_prefix='/auth')

    return app
