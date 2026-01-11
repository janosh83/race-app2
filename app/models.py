from app import db
from werkzeug.security import generate_password_hash, check_password_hash

team_members = db.Table(
    'team_members',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('team_id', db.Integer, db.ForeignKey('team.id'), primary_key=True)
)

race_categories_in_race = db.Table(
    'race_racecategories',
    db.Column('race_id', db.Integer, db.ForeignKey('race.id'), primary_key=True),
    db.Column('race_category_id', db.Integer, db.ForeignKey('race_category.id'), primary_key=True)
)

class Race(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    checkpoints = db.relationship('Checkpoint', backref='race', cascade="all, delete-orphan", lazy=True)
    tasks = db.relationship('Task', backref='race', cascade="all, delete-orphan", lazy=True)
    registrations = db.relationship('Registration', backref='race', cascade="all, delete-orphan", lazy=True)
    categories = db.relationship('RaceCategory', secondary=race_categories_in_race, back_populates='races')
    start_showing_checkpoints_at = db.Column(db.DateTime, nullable=False)
    end_showing_checkpoints_at = db.Column(db.DateTime, nullable=False)
    start_logging_at = db.Column(db.DateTime, nullable=False)
    end_logging_at = db.Column(db.DateTime, nullable=False)

class Registration(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    race_id = db.Column(db.Integer, db.ForeignKey('race.id'), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    race_category_id = db.Column(db.Integer, db.ForeignKey('race_category.id'), nullable=False)
    email_sent = db.Column(db.Boolean, default=False, nullable=False)

    __table_args__ = (
        db.UniqueConstraint('race_id', 'team_id', name='uq_race_team'),
    )

class RaceCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text)
    races = db.relationship('Race', secondary=race_categories_in_race, back_populates='categories')

class Checkpoint(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    numOfPoints = db.Column(db.Integer, default=1)
    race_id = db.Column(db.Integer, db.ForeignKey('race.id'), nullable=False)

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    numOfPoints = db.Column(db.Integer, default=1)
    race_id = db.Column(db.Integer, db.ForeignKey('race.id'), nullable=False)

class CheckpointLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    checkpoint_id = db.Column(db.Integer, db.ForeignKey('checkpoint.id'), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    race_id = db.Column(db.Integer, db.ForeignKey('race.id'), nullable=False)
    image_id = db.Column(db.Integer, db.ForeignKey('image.id'), nullable=True)
    image_latitude = db.Column(db.Float, nullable=True)
    image_longitude = db.Column(db.Float, nullable=True)
    image_distance_km = db.Column(db.Float, nullable=True)
    user_latitude = db.Column(db.Float, nullable=True)
    user_longitude = db.Column(db.Float, nullable=True)
    user_distance_km = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    __table_args__ = (
        db.UniqueConstraint('checkpoint_id', 'team_id', 'race_id', name='uq_checkpoint_team_race'),
    )

class TaskLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey('task.id'), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    race_id = db.Column(db.Integer, db.ForeignKey('race.id'), nullable=False)
    image_id = db.Column(db.Integer, db.ForeignKey('image.id'), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    __table_args__ = (
        db.UniqueConstraint('task_id', 'team_id', 'race_id', name='uq_task_team_race'),
    )

class Image(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(256), nullable=False)

class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    members = db.relationship('User', secondary=team_members, back_populates='teams')
    registrations = db.relationship('Registration', backref='team', cascade="all, delete-orphan", lazy=True)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    email = db.Column(db.String(128), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_administrator = db.Column(db.Boolean, default=False)
    reset_token = db.Column(db.String(100), nullable=True, unique=True)
    reset_token_expiry = db.Column(db.DateTime, nullable=True)
    teams = db.relationship('Team', secondary=team_members, back_populates='members')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def set_reset_token(self, token, expiry):
        self.reset_token = token
        self.reset_token_expiry = expiry
    
    def clear_reset_token(self):
        self.reset_token = None
        self.reset_token_expiry = None