# Email Configuration for Password Recovery

## Brevo (SendInBlue) Setup

This application uses Brevo for sending transactional emails (password reset, registration confirmation, etc.).

### Setup Instructions:

1. **Create a Brevo Account** (if you don't have one):
   - Go to https://www.brevo.com
   - Sign up for a free account (300 emails/day)

2. **Get Your SMTP Credentials**:
   - Log in to your Brevo dashboard
   - Go to **Settings → SMTP & API**
   - Click **SMTP** tab
   - Note your:
     - SMTP Server: `smtp-relay.brevo.com`
     - Port: `587`
     - Login: Your Brevo account email
     - SMTP Key: Click "Generate new SMTP key" or use existing

3. **Configure Environment Variables**:

### Local Development (.env file):

Create or update your `.env` file in the project root:

```env
MAIL_SERVER=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-brevo-email@example.com
MAIL_PASSWORD=your-brevo-smtp-key
MAIL_DEFAULT_SENDER=noreply@yourdomain.com
FRONTEND_URL=http://localhost:3000
```

### Production (Render):

In your Render dashboard, add these environment variables:

- `MAIL_SERVER` → `smtp-relay.brevo.com`
- `MAIL_PORT` → `587`
- `MAIL_USE_TLS` → `true`
- `MAIL_USERNAME` → Your Brevo account email
- `MAIL_PASSWORD` → Your Brevo SMTP key
- `MAIL_DEFAULT_SENDER` → Your verified sender email
- `FRONTEND_URL` → Your production frontend URL (e.g., `https://your-app.onrender.com`)

### Verify Sender Email:

For production, you should verify your sender email address in Brevo:
1. Go to **Settings → Senders & IP**
2. Add and verify your sender email address
3. Use this verified email in `MAIL_DEFAULT_SENDER`

### Testing:

Test the email functionality locally:

```bash
# Start backend
python run.py

# In another terminal, test password reset
curl -X POST http://localhost:5000/auth/request-password-reset/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Check your email inbox for the password reset link.

## Features Implemented:

1. **Password Reset Request** (`/auth/request-password-reset/`)
   - User enters email
   - System generates secure token (valid for 1 hour)
   - Sends email with reset link
   - Returns success message without revealing if email exists (security)

2. **Password Reset** (`/auth/reset-password/`)
   - User clicks link from email
   - Enters new password
   - Token is validated and expired after use

3. **Registration Confirmation Email** (utility function available)
   - Can be called when user registers for a race
   - Function: `send_registration_confirmation_email()`

## Security Features:

- Tokens expire after 1 hour
- Tokens are one-time use (cleared after password reset)
- Email addresses are not revealed (always returns success)
- Tokens are cryptographically secure (32-byte URL-safe)
- Unique constraint on reset_token in database

## Troubleshooting:

### Email not sending:
1. Check environment variables are set correctly
2. Verify Brevo SMTP key is valid
3. Check backend logs for error messages
4. Ensure MAIL_USERNAME matches your Brevo account email

### "Connection refused" error:
- Verify `MAIL_SERVER` is `smtp-relay.brevo.com` (not smtp.sendinblue.com)
- Check `MAIL_PORT` is `587`

### Email goes to spam:
- Verify your sender email in Brevo
- Consider adding SPF/DKIM records to your domain
- Use a professional sender email (not gmail/yahoo)
