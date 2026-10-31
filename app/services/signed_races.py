"""The races a user is signed up for (paid registrations of their teams).

Shared by login and GET /user/signed-races so both return the same shape.
"""
from app import db
from app.models import Race, RaceCategory, Registration, Team, User, team_members


def signed_races_for_user(user_id):
    """Return the user's paid registrations as dicts, with race timing, the
    team (name and members, names only) and the category."""
    rows = (
        db.session.query(
            Race.id.label("race_id"),
            Team.id.label("team_id"),
            Team.name.label("team_name"),
            Race.name.label("race_name"),
            Race.description.label("race_description"),
            RaceCategory.name.label("race_category"),
            Race.finish_description.label("finish_description"),
            Race.finish_latitude.label("finish_latitude"),
            Race.finish_longitude.label("finish_longitude"),
            Race.bivak_1_name.label("bivak_1_name"),
            Race.bivak_1_latitude.label("bivak_1_latitude"),
            Race.bivak_1_longitude.label("bivak_1_longitude"),
            Race.bivak_2_name.label("bivak_2_name"),
            Race.bivak_2_latitude.label("bivak_2_latitude"),
            Race.bivak_2_longitude.label("bivak_2_longitude"),
            Race.start_showing_checkpoints_at,
            Race.end_showing_checkpoints_at,
            Race.start_logging_at,
            Race.end_logging_at,
        )
        .select_from(Registration)
        .join(Race, Registration.race_id == Race.id)
        .join(Team, Registration.team_id == Team.id)
        .join(RaceCategory, Registration.race_category_id == RaceCategory.id)
        .join(team_members, team_members.c.team_id == Team.id)
        .filter(team_members.c.user_id == int(user_id))
        .filter(Registration.payment_confirmed.is_(True))
        .all()
    )

    # All members of the user's teams in one query.
    team_ids = {row.team_id for row in rows}
    members_by_team = {team_id: [] for team_id in team_ids}
    if team_ids:
        member_rows = (
            db.session.query(team_members.c.team_id, User.id, User.name)
            .join(User, User.id == team_members.c.user_id)
            .filter(team_members.c.team_id.in_(team_ids))
            .order_by(User.name)
            .all()
        )
        for team_id, member_id, member_name in member_rows:
            members_by_team[team_id].append({"id": member_id, "name": member_name})

    return [{
        "race_id": row.race_id,
        "team_id": row.team_id,
        "team_name": row.team_name,
        "team_members": members_by_team.get(row.team_id, []),
        "race_name": row.race_name,
        "race_category": row.race_category,
        "race_description": row.race_description,
        "finish_description": row.finish_description,
        "finish_latitude": row.finish_latitude,
        "finish_longitude": row.finish_longitude,
        "bivak_1_name": row.bivak_1_name,
        "bivak_1_latitude": row.bivak_1_latitude,
        "bivak_1_longitude": row.bivak_1_longitude,
        "bivak_2_name": row.bivak_2_name,
        "bivak_2_latitude": row.bivak_2_latitude,
        "bivak_2_longitude": row.bivak_2_longitude,
        "start_showing_checkpoints": row.start_showing_checkpoints_at,
        "end_showing_checkpoints": row.end_showing_checkpoints_at,
        "start_logging": row.start_logging_at,
        "end_logging": row.end_logging_at,
    } for row in rows]
