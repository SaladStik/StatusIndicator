import aiosmtplib
from email.message import EmailMessage
from datetime import datetime
from app.config import get_settings

settings = get_settings()


async def send_failed_auth_alert(
    failed_key: str,
    ip_address: str = "unknown",
    endpoint: str = "unknown",
):
    """Send email alert for failed authentication attempt"""
    if not settings.ENABLE_EMAIL_ALERTS:
        return

    if not settings.SMTP_USERNAME or not settings.ALERT_EMAIL_TO:
        return

    # Create email message
    message = EmailMessage()
    message["From"] = f"{settings.ALERT_EMAIL_FROM_NAME} <{settings.SMTP_USERNAME}>"
    message["To"] = settings.ALERT_EMAIL_TO
    message["Subject"] = "Status Indicator API - Failed Authentication Attempt"

    # Email body
    body = f"""
Security Alert: Failed Authentication Attempt

Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
Endpoint: {endpoint}
IP Address: {ip_address}
Failed API Key: {failed_key[:8]}...{failed_key[-4:] if len(failed_key) > 12 else ''}

This is an automated security alert from your Status Indicator API.
Someone attempted to authenticate with an invalid API key.

If this was you, you can safely ignore this message.
If this was not you, consider reviewing your server logs and security settings.

---
Status Indicator API
    """

    message.set_content(body)

    try:
        # Send email
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            use_tls=True,
        )
    except Exception as e:
        # Don't crash the API if email fails, just log it
        print(f"Failed to send email alert: {e}")
