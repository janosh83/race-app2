import logging
import sys
import os
import time
import uuid
from flask import Flask, jsonify, g, has_request_context, request
from flask import send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flasgger import Swagger
from flask_cors import CORS
from flask_mail import Mail
from marshmallow import ValidationError

# database initialization
db = SQLAlchemy()
migrate = Migrate()
mail = Mail()


class RequestContextFilter(logging.Filter):
    """Inject request correlation id into all log records."""

    def filter(self, record):
        if has_request_context():
            record.request_id = getattr(g, 'request_id', '-')
        else:
            record.request_id = '-'
        return True


def configure_logging(app):
    """Configure application logging with request correlation support."""
    log_level_name = app.config.get('LOG_LEVEL', 'INFO')
    log_level = getattr(logging, str(log_level_name).upper(), logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s in %(name)s [request_id=%(request_id)s]: %(message)s'
    )
    request_context_filter = RequestContextFilter()

    if not any(isinstance(handler, logging.StreamHandler) for handler in root_logger.handlers):
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setLevel(log_level)
        stream_handler.setFormatter(formatter)
        stream_handler.addFilter(request_context_filter)
        root_logger.addHandler(stream_handler)
    else:
        for handler in root_logger.handlers:
            handler.setLevel(log_level)
            if isinstance(handler, logging.StreamHandler):
                handler.setFormatter(formatter)
                if not any(isinstance(active_filter, RequestContextFilter) for active_filter in handler.filters):
                    handler.addFilter(request_context_filter)

    logging.getLogger('werkzeug').setLevel(log_level)


def register_request_logging(app):
    """Register per-request logging hooks with request id and duration."""

    @app.before_request
    def start_request_logging_context():
        incoming_request_id = request.headers.get('X-Request-ID', '').strip()
        g.request_id = incoming_request_id or uuid.uuid4().hex
        g.request_started_at = time.perf_counter()

    @app.after_request
    def log_request_completion(response):
        response.headers['X-Request-ID'] = getattr(g, 'request_id', '-')

        if app.config.get('LOG_REQUESTS', True):
            started_at = getattr(g, 'request_started_at', None)
            duration_ms = ((time.perf_counter() - started_at) * 1000.0) if started_at is not None else 0.0

            app.logger.info(
                'request_completed method=%s path=%s status=%s duration_ms=%.2f remote_addr=%s',
                request.method,
                request.path,
                response.status_code,
                duration_ms,
                request.remote_addr,
            )

        return response

def create_app(config_class=None):
    if config_class is None:
        config_class = os.environ.get('FLASK_CONFIG', 'app.config.DevelopmentConfig')
    app = Flask(__name__)
    app.config.from_object(config_class)

    is_production_config = (
        (isinstance(config_class, str) and config_class.endswith('ProductionConfig'))
        or (not isinstance(config_class, str) and getattr(config_class, '__name__', '') == 'ProductionConfig')
    )
    if is_production_config and not str(app.config.get('STRIPE_API_KEY', '')).strip():
        raise RuntimeError('Missing required STRIPE_RESTRICTED_KEY for ProductionConfig.')

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

    configure_logging(app)
    register_request_logging(app)

    # Import blueprints here to avoid circular imports
    from app.routes.auth import auth_bp
    from app.routes.checkpoint import checkpoint_bp
    from app.routes.race import race_bp
    from app.routes.race_category import race_category_bp
    from app.routes.task import task_bp
    from app.routes.team import team_bp
    from app.routes.user import user_bp

    # blueprint registration
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(checkpoint_bp, url_prefix="/api/checkpoint")
    app.register_blueprint(race_bp, url_prefix="/api/race")
    app.register_blueprint(race_category_bp, url_prefix="/api/race-category")
    app.register_blueprint(task_bp, url_prefix="/api/task")
    app.register_blueprint(team_bp, url_prefix="/api/team")
    app.register_blueprint(user_bp, url_prefix="/api/user")

    @app.errorhandler(ValidationError)
    def handle_validation_error(err):
        return jsonify({"errors": err.messages}), 400

    # Serve static images with CORS support
    images_folder = app.config['IMAGE_UPLOAD_FOLDER']
    os.makedirs(images_folder, exist_ok=True)

    @app.route('/static/images/<filename>')
    def serve_image(filename):
        """Serve uploaded checkpoint images with CORS headers"""
        return send_from_directory(images_folder, filename)

    return app
