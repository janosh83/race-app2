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
):
    if not secret_key:
        raise ValueError("Stripe is not configured")

    try:
        import stripe
    except ImportError as exc:
        raise ValueError("Stripe SDK is not installed") from exc

    stripe.api_key = secret_key

    session = stripe.checkout.Session.create(
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        line_items=[
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
        metadata={
            "registration_slug": registration_slug,
            "race_id": str(race_id),
            "team_id": str(team_id),
            "team_name": team_name,
            "mode": mode,
            "members_count": str(members_count),
            "payment_type": payment_type or ('team' if mode == 'team' else 'driver'),
        },
    )

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

    return stripe.Webhook.construct_event(payload, signature, webhook_secret)
