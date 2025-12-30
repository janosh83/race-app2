"""
Email service for sending transactional emails.
"""
from flask_mail import Message
from flask import current_app, render_template
from app import mail
import secrets


class EmailService:
    """Service for handling all email operations."""
    
    @staticmethod
    def _send_email(subject, recipient, body_text, body_html=None):
        """
        Send an email using Flask-Mail.
        
        Args:
            subject: Email subject line
            recipient: Recipient email address
            body_text: Plain text email body
            body_html: Optional HTML email body
            
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        try:
            msg = Message(
                subject=subject,
                recipients=[recipient],
                body=body_text,
                html=body_html,
                sender=current_app.config['MAIL_DEFAULT_SENDER']
            )
            mail.send(msg)
            return True
        except Exception as e:
            current_app.logger.error(f"Failed to send email to {recipient}: {e}")
            return False
    
    @staticmethod
    def send_password_reset_email(user_email, reset_token):
        """
        Send password reset email to user.
        
        Args:
            user_email: User's email address
            reset_token: Secure reset token
            
        Returns:
            bool: True if email sent successfully
        """
        frontend_url = current_app.config['FRONTEND_URL']
        reset_link = f"{frontend_url}/reset-password?token={reset_token}"
        
        subject = "Password Reset Request"
        
        body_html = render_template('emails/password_reset.html', reset_link=reset_link)
        
        return EmailService._send_email(subject, user_email, None, body_html)
    
    @staticmethod
    def send_registration_confirmation_email(user_email, user_name, race_name, team_name, race_category, reset_token):
        """
        Send race registration confirmation email.
        
        Args:
            user_email: User's email address
            user_name: User's name
            race_name: Name of the race
            team_name: Name of the team
            race_category: Race category name
            reset_token: Password reset token for user
            
        Returns:
            bool: True if email sent successfully
        """
        frontend_url = current_app.config['FRONTEND_URL']
        reset_link = f"{frontend_url}/reset-password?token={reset_token}"
        subject = f"Registration Confirmed: {race_name}"
        
        body_html = render_template(
            'emails/registration_confirmation.html',
            user_name=user_name,
            race_name=race_name,
            team_name=team_name,
            race_category=race_category,
            reset_link=reset_link
        )
        
        return EmailService._send_email(subject, user_email, None, body_html)
    

def generate_reset_token():
    """Generate a secure random token for password reset."""
    return secrets.token_urlsafe(32)
