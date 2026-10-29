from flask import Blueprint, jsonify

from app import db
from app.models import Checkpoint, CheckpointLog, Race, Registration, Team
from app.routes.admin import admin_required

race_team_paths_bp = Blueprint('race_team_paths', __name__)


@race_team_paths_bp.route('/team-paths/', methods=['GET'])
@admin_required()
def get_race_team_paths(race_id):
    """
    Get the path of every registered team through the race checkpoints (admin only).
    Visits of each team are ordered chronologically.
    ---
    tags:
      - Races
    parameters:
      - in: path
        name: race_id
        schema:
          type: integer
        required: true
        description: ID of the race
    security:
      - BearerAuth: []
    responses:
      200:
        description: Checkpoints and chronologically ordered visits per team
        content:
          application/json:
            schema:
              type: object
              properties:
                race_id:
                  type: integer
                checkpoints:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: integer
                      title:
                        type: string
                      latitude:
                        type: number
                      longitude:
                        type: number
                      numOfPoints:
                        type: integer
                teams:
                  type: array
                  items:
                    type: object
                    properties:
                      team_id:
                        type: integer
                      team_name:
                        type: string
                      disqualified:
                        type: boolean
                      visits:
                        type: array
                        items:
                          type: object
                          properties:
                            checkpoint_id:
                              type: integer
                            created_at:
                              type: string
                              format: date-time
      404:
        description: Race not found
      403:
        description: Admins only
    """
    Race.query.filter_by(id=race_id).first_or_404()

    checkpoints = (
        Checkpoint.query
        .filter(Checkpoint.race_id == race_id)
        .order_by(Checkpoint.id.asc())
        .all()
    )

    registrations = (
        db.session.query(Team.id, Team.name, Registration.disqualified)
        .join(Registration, Registration.team_id == Team.id)
        .filter(Registration.race_id == race_id)
        .order_by(Team.name.asc(), Team.id.asc())
        .all()
    )

    logs = (
        db.session.query(CheckpointLog.team_id, CheckpointLog.checkpoint_id, CheckpointLog.created_at)
        .filter(CheckpointLog.race_id == race_id)
        .order_by(CheckpointLog.team_id.asc(), CheckpointLog.created_at.asc(), CheckpointLog.id.asc())
        .all()
    )

    visits_by_team = {}
    for log in logs:
        visits_by_team.setdefault(log.team_id, []).append(
            {
                'checkpoint_id': int(log.checkpoint_id),
                'created_at': log.created_at.isoformat() if log.created_at else None,
            }
        )

    return jsonify(
        {
            'race_id': race_id,
            'checkpoints': [
                {
                    'id': cp.id,
                    'title': cp.title,
                    'latitude': cp.latitude,
                    'longitude': cp.longitude,
                    'numOfPoints': cp.numOfPoints,
                }
                for cp in checkpoints
            ],
            'teams': [
                {
                    'team_id': int(team_id),
                    'team_name': team_name,
                    'disqualified': bool(disqualified),
                    'visits': visits_by_team.get(team_id, []),
                }
                for team_id, team_name, disqualified in registrations
            ],
        }
    )
