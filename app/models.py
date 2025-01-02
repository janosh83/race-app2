from app import db
from werkzeug.security import generate_password_hash, check_password_hash

team_members = db.Table(
    'team_members',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('team_id', db.Integer, db.ForeignKey('team.id'), primary_key=True)
)

race_teams = db.Table(
    'race_teams',
    db.Column('race_id', db.Integer, db.ForeignKey('race.id'), primary_key=True),
    db.Column('team_id', db.Integer, db.ForeignKey('team.id'), primary_key=True)
)

class Race(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    checkpoints = db.relationship('Checkpoint', backref='race', cascade="all, delete-orphan", lazy=True)
    teams = db.relationship('Team', secondary=race_teams, back_populates='races')

class Checkpoint(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    numOfPoints = db.Column(db.Integer, default=1)
    race_id = db.Column(db.Integer, db.ForeignKey('race.id'), nullable=False)

class CheckpointLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    checkpoint_id = db.Column(db.Integer, db.ForeignKey('checkpoint.id'), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    race_id = db.Column(db.Integer, db.ForeignKey('race.id'), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    members = db.relationship('User', secondary=team_members, back_populates='teams')
    races = db.relationship('Race', secondary=race_teams, back_populates='teams')

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    email = db.Column(db.String(128), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_administrator = db.Column(db.Boolean, default=False)
    teams = db.relationship('Team', secondary=team_members, back_populates='members')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)