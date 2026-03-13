from datetime import datetime

from app import db
from app.models import RegistrationEmailLog


STATUS_PRECEDENCE = {
    'pending': 0,
    'sent': 1,
    'delivered': 2,
    'opened': 3,
    'failed': 3,
    'bounced': 4,
    'blocked': 4,
}


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


def map_brevo_event_to_status(event_type):
    event_name = (event_type or '').strip().lower()
    if event_name in ('request', 'deferred', 'sent'):
        return 'sent'
    if event_name == 'delivered':
        return 'delivered'
    if event_name in ('opened', 'unique_opened', 'click', 'unique_click'):
        return 'opened'
    if event_name in ('blocked', 'spam', 'unsubscribed'):
        return 'blocked'
    if event_name in ('hard_bounce', 'soft_bounce', 'bounce', 'invalid_email', 'error'):
        return 'bounced'
    return None


def _parse_provider_time(raw_value):
    if raw_value is None:
        return None

    if isinstance(raw_value, (int, float)):
        return datetime.fromtimestamp(raw_value)

    value = str(raw_value).strip()
    if not value:
        return None

    if value.endswith('Z'):
        value = value[:-1] + '+00:00'

    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def apply_brevo_event(event):
    event_type = (event or {}).get('event') or (event or {}).get('event_type')
    mapped_status = map_brevo_event_to_status(event_type)
    if not mapped_status:
        return {'updated': 0, 'skipped': 1, 'reason': 'unsupported_event'}

    message_id = (
        (event or {}).get('message-id')
        or (event or {}).get('message_id')
        or (event or {}).get('messageId')
        or (event or {}).get('smtp-id')
        or (event or {}).get('smtp_id')
    )
    recipient = ((event or {}).get('email') or (event or {}).get('recipient') or '').strip().lower()

    query = RegistrationEmailLog.query
    if message_id:
        logs = query.filter(RegistrationEmailLog.provider_message_id == message_id).all()
    elif recipient:
        logs = (
            query
            .filter(RegistrationEmailLog.email_address == recipient)
            .order_by(RegistrationEmailLog.created_at.desc(), RegistrationEmailLog.id.desc())
            .limit(1)
            .all()
        )
    else:
        return {'updated': 0, 'skipped': 1, 'reason': 'missing_identity'}

    if not logs:
        return {'updated': 0, 'skipped': 1, 'reason': 'log_not_found'}

    occurred_at = _parse_provider_time((event or {}).get('date') or (event or {}).get('ts')) or datetime.now()
    updated = 0
    for log in logs:
        current_status = (log.status or 'pending').lower()
        if STATUS_PRECEDENCE.get(mapped_status, 0) < STATUS_PRECEDENCE.get(current_status, 0):
            continue

        log.status = mapped_status
        log.provider = 'brevo'
        if message_id:
            log.provider_message_id = message_id
        log.provider_event_payload = event
        log.last_attempted_at = occurred_at
        if mapped_status == 'delivered':
            log.delivered_at = occurred_at
        elif mapped_status == 'opened':
            log.opened_at = occurred_at
        elif mapped_status == 'bounced':
            log.bounced_at = occurred_at
            log.error_message = (event or {}).get('reason') or (event or {}).get('description') or log.error_message
        elif mapped_status == 'blocked':
            log.blocked_at = occurred_at
            log.error_message = (event or {}).get('reason') or (event or {}).get('description') or log.error_message
        updated += 1

    return {'updated': updated, 'skipped': 0, 'reason': None}
