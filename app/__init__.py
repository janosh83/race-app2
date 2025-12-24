from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flasgger import Swagger
from flask_cors import CORS
from flask_mail import Mail
import os

# database initialization
db = SQLAlchemy()
migrate = Migrate()
mail = Mail()

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
    mail.init_app(app)
    JWTManager(app)
    Swagger(app, template=swagger_template)
    # Configure CORS explicitly for API endpoints. We allow the origins
    # defined in CORS_ORIGINS and enable credentials support when needed.
    # We also explicitly allow typical headers and methods used by the
    # frontend (Authorization, Content-Type) so preflight (OPTIONS)
    # requests are handled correctly.
    # Make sure CORS applies to both API endpoints and auth endpoints
    CORS(app,
         resources={
             r"/api/*": {"origins": app.config['CORS_ORIGINS']},
             r"/auth/*": {"origins": app.config['CORS_ORIGINS']},
             r"/static/images/*": {"origins": app.config['CORS_ORIGINS']}
         },
         supports_credentials=True,
         expose_headers=["Content-Type", "Authorization"],
         allow_headers=["Authorization", "Content-Type", "X-Requested-With", "Accept"],
         methods=["GET", "HEAD", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"]
         )

    # blueprint registration
    from app.routes.race import race_bp
    from app.routes.auth import auth_bp
    from app.routes.team import team_bp
    from app.routes.checkpoint import checkpoint_bp
    from app.routes.race_category import race_category_bp
    app.register_blueprint(race_bp, url_prefix="/api/race")
    app.register_blueprint(team_bp, url_prefix="/api/team")
    app.register_blueprint(checkpoint_bp, url_prefix="/api/checkpoint")
    app.register_blueprint(race_category_bp, url_prefix="/api/race-category")
    app.register_blueprint(auth_bp, url_prefix='/auth')

    # Serve static images with CORS support
    from flask import send_from_directory
    
    images_folder = os.path.join(os.path.dirname(__file__), 'static', 'images')
    os.makedirs(images_folder, exist_ok=True)
    
    @app.route('/static/images/<filename>')
    def serve_image(filename):
        """Serve uploaded checkpoint images with CORS headers"""
        return send_from_directory(images_folder, filename)

    return app
