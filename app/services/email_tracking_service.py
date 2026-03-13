from datetime import datetime

from app import db
from app.models import RegistrationEmailLog


def normalize_email_send_result(result):
    if isinstance(result, dict):
        return {
            'success': bool(result.get('success')),
            'error': result.get('error'),
            'provider': result.get('provider') or 'smtp',
            'provider_message_id': result.get('provider_message_id'),
        }
    return {
        'success': bool(result),
        'error': None if bool(result) else 'email send failed',
        'provider': 'smtp',
        'provider_message_id': None,
    }


def add_registration_email_log(registration, user_id, email_address, template_type, send_result):
    normalized = normalize_email_send_result(send_result)
    normalized_email = (email_address or '').strip().lower()

    attempt_count = (
        RegistrationEmailLog.query.filter_by(
            registration_id=registration.id,
            user_id=user_id,
            email_address=normalized_email,
            template_type=template_type,
        ).count() + 1
    )
    now = datetime.now()

    db.session.add(
        RegistrationEmailLog(
            registration_id=registration.id,
            user_id=user_id,
            email_address=normalized_email,
            template_type=template_type,
            provider=normalized['provider'],
            provider_message_id=normalized['provider_message_id'],
            status='sent' if normalized['success'] else 'failed',
            error_message=normalized['error'],
            attempt_count=attempt_count,
            last_attempted_at=now,
            delivered_at=now if normalized['success'] else None,
        )
    )
