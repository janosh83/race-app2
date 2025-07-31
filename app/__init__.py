from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flasgger import Swagger
from flask_cors import CORS
import os

# database initialization
db = SQLAlchemy()
migrate = Migrate()

def create_app(config_class=None):
    if config_class is None:
        config_class = os.environ.get('FLASK_CONFIG', 'app.config.DevelopmentConfig')
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
                        },
                        "is_administrator": {
                            "type": "boolean",
                            "description": "Indicates if the user is an administrator"
                        }
                    }
                },
                "RaceObject": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "integer",
                            "description": "The race ID."
                        },
                        "name": {
                            "type": "string",
                            "description": "The name of the race."
                        },
                        "description": {
                            "type": "string",
                            "description": "A description of the race."
                        }
                    }
                },
                "VisitObject": {
                    "type": "object",
                    "properties": {
                        "checkpoint_id": {
                            "type": "integer",
                            "description": "The ID of the checkpoint visited."
                        },
                        "team_id": {
                            "type": "integer",
                            "description": "The ID of the team that made the visit."
                        },
                        "created_at": {
                            "type": "string",
                            "format": "date-time",
                            "description": "The timestamp of the visit."
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
    CORS(app, origins=["http://localhost:3000"], supports_credentials=True)

    # blueprint registration
    from app.routes.races import race_bp
    from app.routes.auth import auth_bp
    from app.routes.teams import team_bp
    app.register_blueprint(race_bp, url_prefix="/api/race")
    app.register_blueprint(team_bp, url_prefix="/api/team")
    app.register_blueprint(auth_bp, url_prefix='/auth')

    return app
