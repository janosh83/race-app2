from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager

# database initialization
db = SQLAlchemy()
migrate = Migrate()

def create_app(config_class="app.config.Config"):
    app = Flask(__name__, static_folder='../frontend')
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    JWTManager(app)

    # Serve the index.html file
    @app.route('/')
    def serve_index():
        return send_from_directory(app.static_folder, 'index.html')

    # Serve other static files (CSS, JS, etc.)
    @app.route('/<path:path>')
    def serve_static_files(path):
        return send_from_directory(app.static_folder, path)

    # blueprint registration
    from app.routes.races import race_bp
    from app.routes.auth import auth_bp
    from app.routes.teams import team_bp
    app.register_blueprint(race_bp, url_prefix="/api/race")
    app.register_blueprint(team_bp, url_prefix="/api/team")
    app.register_blueprint(auth_bp, url_prefix='/auth')

    return app
