"""
Email service for sending transactional emails.
"""
import secrets
import smtplib

from flask_mail import Message
from flask import current_app, render_template
from app import mail
from app.constants import SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE


class EmailService:
    """Service for handling all email operations."""

    @staticmethod
    def _get_template_language(language=None):
        """
        Resolve the language for email templates.

        Args:
            language: Requested language code

        Returns:
            str: Valid language code, defaults to DEFAULT_LANGUAGE
        """
        if language and language in SUPPORTED_LANGUAGES:
            return language
        return DEFAULT_LANGUAGE

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
        except (smtplib.SMTPException, ConnectionError, OSError, KeyError, ValueError, RuntimeError) as err:
            current_app.logger.error("Failed to send email to %s: %s", recipient, err)
            return False

    @staticmethod
    def send_password_reset_email(user_email, reset_token, language=None):
        """
        Send password reset email to user.

        Args:
            user_email: User's email address
            reset_token: Secure reset token
            language: User's preferred language (en/cs/de)

        Returns:
            bool: True if email sent successfully
        """
        lang = EmailService._get_template_language(language)
        frontend_url = current_app.config['FRONTEND_URL']
        reset_link = f"{frontend_url}/reset-password?token={reset_token}"

        # Translate subject based on language
        subjects = {
            'en': 'Password Reset Request',
            'cs': 'Žádost o obnovení hesla',
            'de': 'Anfrage zum Zurücksetzen des Passworts'
        }
        subject = subjects.get(lang, subjects['en'])

        body_html = render_template(f'emails/{lang}/password_reset.html', reset_link=reset_link)

        return EmailService._send_email(subject, user_email, None, body_html)

    @staticmethod
    def send_registration_confirmation_email(
        user_email,
        user_name,
        race_name,
        team_name,
        race_category,
        reset_token,
        language=None,
        payment_amount_cents=None,
        payment_currency=None,
        payment_reference=None,
        payment_confirmed_at=None,
        payment_receipt_url=None,
        race_greeting=None,
    ):
        """
        Send race registration confirmation email.

        Args:
            user_email: User's email address
            user_name: User's name
            race_name: Name of the race
            team_name: Name of the team
            race_category: Race category name
            reset_token: Password reset token for user
            language: User's preferred language (en/cs/de)

        Returns:
            bool: True if email sent successfully
        """
        lang = EmailService._get_template_language(language)
        frontend_url = current_app.config['FRONTEND_URL']
        reset_link = f"{frontend_url}/reset-password?token={reset_token}"

        # Translate subject based on language
        subjects = {
            'en': f'Call me {race_name}',
            'cs': f'Říkejte mi {race_name}',
            'de': f'Nennen Sie mich {race_name}'
        }
        subject = subjects.get(lang, subjects['en'])

        default_greetings = {
            'en': f'Hello {user_name},',
            'cs': f'Ahoj {user_name},',
            'de': f'Hallo {user_name},',
        }
        resolved_race_greeting = (race_greeting or default_greetings.get(lang, default_greetings['en'])).strip()
        resolved_race_greeting = resolved_race_greeting.replace('{user_name}', user_name)

        body_html = render_template(
            f'emails/{lang}/registration_confirmation.html',
            user_name=user_name,
            race_name=race_name,
            team_name=team_name,
            race_category=race_category,
            reset_link=reset_link,
            payment_amount_cents=payment_amount_cents,
            payment_currency=(payment_currency or '').upper() if payment_currency else None,
            payment_reference=payment_reference,
            payment_confirmed_at=payment_confirmed_at,
            payment_receipt_url=payment_receipt_url,
            race_greeting=resolved_race_greeting,
        )

        return EmailService._send_email(subject, user_email, None, body_html)

    @staticmethod
    def send_admin_registration_completed_email(
        admin_email,
        race_name,
        team_name,
        registration_mode,
        registration_id,
        race_id,
        team_id,
        language=None,
        payment_type=None,
        payment_amount_cents=None,
        payment_currency=None,
        payment_reference=None,
        payment_confirmed_at=None,
    ):
        """Send an admin notification when registration payment is confirmed."""
        lang = EmailService._get_template_language(language)
        mode_display = registration_mode or "unknown"
        amount_display = (
            f"{(payment_amount_cents or 0) / 100:.2f} {(payment_currency or '').upper()}".strip()
            if payment_amount_cents is not None
            else "N/A"
        )

        subjects = {
            'en': f'Registration completed: {team_name} / {race_name}',
            'cs': f'Registrace dokoncena: {team_name} / {race_name}',
            'de': f'Registrierung abgeschlossen: {team_name} / {race_name}',
        }
        subject = subjects.get(lang, subjects['en'])
        template_context = {
            "race_name": race_name,
            "team_name": team_name,
            "mode_display": mode_display,
            "registration_id": registration_id,
            "race_id": race_id,
            "team_id": team_id,
            "payment_type": payment_type,
            "amount_display": amount_display,
            "payment_reference": payment_reference,
            "payment_confirmed_at": payment_confirmed_at,
        }
        body_html = render_template(f"emails/{lang}/admin_registration_completed.html", **template_context)

        return EmailService._send_email(subject, admin_email, None, body_html)


def generate_reset_token():
    """Generate a secure random token for password reset."""
    return secrets.token_urlsafe(32)
