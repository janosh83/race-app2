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

    payment_intent = (session_object or {}).get("payment_intent")
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
        latest_charge = payment_intent_obj.get("latest_charge")
        if isinstance(latest_charge, dict):
            return latest_charge.get("receipt_url")
        if latest_charge:
            charge_obj = stripe.Charge.retrieve(latest_charge)
            return charge_obj.get("receipt_url")
    except Exception:
        return None

    return None
