from datetime import datetime, timezone
from flask_mail import Message
from app import mail
from flask import current_app
import secrets

def parse_datetime(s: str) -> datetime:
    """Parse common datetime string formats into a timezone-aware UTC datetime."""
    if s is None:
        raise ValueError("empty string")

    # handle ISO 8601 with trailing Z
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        # accepts "YYYY-MM-DDTHH:MM:SS" and with timezone offset
        dt = datetime.fromisoformat(s)
        # make tz-aware UTC if naive
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        pass

    # try common fixed formats
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%d.%m.%Y %H:%M:%S",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(s, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

    # fallback: use dateutil if available (more flexible)
    try:
        from dateutil import parser
        dt = parser.parse(s)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        raise ValueError(f"unrecognized datetime format: {s}")

# Email utilities
def send_email(subject, recipient, body_text, body_html=None):
    """Send an email using Flask-Mail"""
    msg = Message(
        subject=subject,
        recipients=[recipient],
        body=body_text,
        html=body_html,
        sender=current_app.config['MAIL_DEFAULT_SENDER']
    )
    try:
        mail.send(msg)
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

def send_password_reset_email(user_email, reset_token):
    """Send password reset email to user"""
    frontend_url = current_app.config['FRONTEND_URL']
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    subject = "Password Reset Request"
    
    body_text = f"""
Hello,

You have requested to reset your password. Click the link below to reset it:

{reset_link}

This link will expire in 1 hour.

If you did not request this, please ignore this email.

Best regards,
Race App Team
"""
    
    body_html = f"""
<html>
  <body>
    <h2>Password Reset Request</h2>
    <p>Hello,</p>
    <p>You have requested to reset your password. Click the link below to reset it:</p>
    <p><a href="{reset_link}">Reset Password</a></p>
    <p>This link will expire in 1 hour.</p>
    <p>If you did not request this, please ignore this email.</p>
    <br>
    <p>Best regards,<br>Race App Team</p>
  </body>
</html>
"""
    
    return send_email(subject, user_email, body_text, body_html)

def send_registration_confirmation_email(user_email, user_name, race_name, team_name):
    """Send race registration confirmation email"""
    subject = f"Registration Confirmed: {race_name}"
    
    body_text = f"""
Hello {user_name},

Your team "{team_name}" has been successfully registered for the race "{race_name}".

Good luck!

Best regards,
Race App Team
"""
    
    body_html = f"""
<html>
  <body>
    <h2>Registration Confirmed</h2>
    <p>Hello {user_name},</p>
    <p>Your team "<strong>{team_name}</strong>" has been successfully registered for the race "<strong>{race_name}</strong>".</p>
    <p>Good luck!</p>
    <br>
    <p>Best regards,<br>Race App Team</p>
  </body>
</html>
"""
    
    return send_email(subject, user_email, body_text, body_html)

def generate_reset_token():
    """Generate a secure random token for password reset"""
    return secrets.token_urlsafe(32)