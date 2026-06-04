def _to_plain_mapping(value):
    if isinstance(value, dict):
        return {key: _to_plain_mapping(item) for key, item in value.items()}

    if isinstance(value, (list, tuple)):
        return [_to_plain_mapping(item) for item in value]

    data = getattr(value, '_data', None)
    if isinstance(data, dict):
        return {key: _to_plain_mapping(item) for key, item in data.items()}

    if hasattr(value, 'items'):
        try:
            return {key: _to_plain_mapping(item) for key, item in value.items()}
        except (TypeError, ValueError):
            return value

    return value


def create_registration_checkout_session(
    *,
    secret_key,
    success_url,
    cancel_url,
    currency,
    amount_cents,
    race_name,
    registration_slug,
    team_name,
    mode,
    members_count,
    race_id,
    team_id,
    payment_type=None,
    customer_email=None,
    customer_name=None,
):
    if not secret_key:
        raise ValueError("Stripe is not configured")

    try:
        import stripe
    except ImportError as exc:
        raise ValueError("Stripe SDK is not installed") from exc

    stripe.api_key = secret_key

    metadata = {
        "registration_slug": registration_slug,
        "race_id": str(race_id),
        "team_id": str(team_id),
        "team_name": team_name,
        "mode": mode,
        "members_count": str(members_count),
        "payment_type": payment_type or ('team' if mode == 'team' else 'driver'),
    }
    if customer_name:
        metadata["customer_name"] = customer_name

    session_payload = {
        "mode": "payment",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "line_items": [
            {
                "price_data": {
                    "currency": currency,
                    "unit_amount": amount_cents,
                    "product_data": {
                        "name": f"Race registration: {race_name}",
                        "description": f"Registration slug: {registration_slug}",
                    },
                },
                "quantity": 1,
            }
        ],
        "metadata": metadata,
    }
    if customer_email:
        session_payload["customer_email"] = customer_email

    session = stripe.checkout.Session.create(**session_payload)

    return {
        "session_id": session.id,
        "checkout_url": session.url,
    }


def construct_stripe_event(*, payload, signature, webhook_secret, secret_key=None):
    if not webhook_secret:
        raise ValueError("Stripe webhook is not configured")

    try:
        import stripe
    except ImportError as exc:
        raise ValueError("Stripe SDK is not installed") from exc

    if secret_key:
        stripe.api_key = secret_key

    try:
        return stripe.Webhook.construct_event(payload, signature, webhook_secret)
    except ValueError:
        raise
    except Exception as exc:
        raise TypeError("Stripe webhook signature verification failed") from exc


def get_checkout_receipt_url(*, session_object, secret_key):
    if not secret_key:
        return None

    session_object = _to_plain_mapping(session_object)
    if not isinstance(session_object, dict):
        return None

    payment_intent = session_object.get("payment_intent")
    if isinstance(payment_intent, dict):
        payment_intent = payment_intent.get("id")
    if not payment_intent:
        return None

    try:
        import stripe
    except ImportError:
        return None

    stripe.api_key = secret_key

    try:
        payment_intent_obj = stripe.PaymentIntent.retrieve(payment_intent, expand=["latest_charge"])
        payment_intent_obj = _to_plain_mapping(payment_intent_obj)
        if not isinstance(payment_intent_obj, dict):
            return None

        latest_charge = payment_intent_obj.get("latest_charge")
        if isinstance(latest_charge, dict):
            return latest_charge.get("receipt_url")
        if latest_charge:
            charge_obj = stripe.Charge.retrieve(latest_charge)
            charge_obj = _to_plain_mapping(charge_obj)
            if isinstance(charge_obj, dict):
                return charge_obj.get("receipt_url")
            return None
    except stripe.error.StripeError:
        return None
    except (AttributeError, TypeError, ValueError):
        return None

    return None


def get_checkout_session_payment_state(*, session_id, secret_key):
    if not secret_key:
        raise ValueError("Stripe is not configured")
    if not session_id:
        raise ValueError("session_id is required")

    try:
        import stripe
    except ImportError as exc:
        raise ValueError("Stripe SDK is not installed") from exc

    stripe.api_key = secret_key

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as exc:
        raise RuntimeError("Unable to retrieve checkout session") from exc

    session = _to_plain_mapping(session)

    return {
        "session_id": session.get("id"),
        "payment_status": session.get("payment_status"),
        "status": session.get("status"),
        "payment_intent": session.get("payment_intent"),
    }
