from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flasgger import Swagger

# database initialization
db = SQLAlchemy()
migrate = Migrate()

def create_app(config_class="app.config.Config"):
    app = Flask(__name__)
    app.config.from_object(config_class)

    swagger_template = {
        "components": {
            "schemas": {
                "TeamObject": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "integer",
                            "description": "The team ID"
                        },
                        "name": {
                            "type": "string",
                            "description": "The name of the team"
                        }
                    }
                },
                "UserObject": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "integer",
                            "description": "The user ID"
                        },
                        "name": {
                            "type": "string",
                            "description": "The name of the user"
                        },
                        "email": {
                            "type": "string",
                            "description": "The email of the user. Used also as username for login."
                        }
                    }
                }
            }
        }
    }

    db.init_app(app)
    migrate.init_app(app, db)
    JWTManager(app)
    Swagger(app, template=swagger_template)

    # blueprint registration
    from app.routes.races import race_bp
    from app.routes.auth import auth_bp
    from app.routes.teams import team_bp
    app.register_blueprint(race_bp, url_prefix="/api/race")
    app.register_blueprint(team_bp, url_prefix="/api/team")
    app.register_blueprint(auth_bp, url_prefix='/auth')

    return app
