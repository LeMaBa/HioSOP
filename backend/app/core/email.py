import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_credentials_email(
    to_email: str,
    full_name: str,
    username: str,
    password: str,
) -> bool:
    """Send login credentials email via Resend. Returns True on success, False if disabled or failed."""
    if not settings.email_enabled:
        logger.info("Email disabled (RESEND_API_KEY not set) — skipping credentials email for %s", username)
        return False

    import resend  # imported lazily so missing package doesn't break startup

    resend.api_key = settings.RESEND_API_KEY

    logger.info(
        "Sending credentials email to %s <%s> via Resend (from: %s)",
        username, to_email, settings.RESEND_FROM,
    )

    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#222;">
  <div style="background:#e2001a;padding:24px 32px;border-radius:8px 8px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Malteser SOP-Navigator</h1>
    <p style="color:#ffbbbb;margin:4px 0 0;font-size:13px;">Zugangsdaten</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;padding:24px 32px;">
    <p>Hallo {full_name},</p>
    <p>Dein Zugang zum Malteser SOP-Navigator wurde eingerichtet. Hier sind deine Zugangsdaten:</p>
    <table style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;width:100%;margin:16px 0;">
      <tr><td style="color:#6b7280;font-size:13px;padding:4px 0;">Benutzername</td>
          <td style="font-weight:600;font-size:14px;padding:4px 0;">{username}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;padding:4px 0;">Passwort</td>
          <td style="font-weight:600;font-size:14px;padding:4px 0;color:#e2001a;letter-spacing:2px;">{password}</td></tr>
    </table>
    <p>
      <a href="{settings.APP_BASE_URL}" style="display:inline-block;background:#e2001a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;">
        Zur App →
      </a>
    </p>
    <p style="font-size:12px;color:#9ca3af;margin-top:24px;">
      Bitte ändere dein Passwort nach der ersten Anmeldung.<br/>
      Diese E-Mail wurde automatisch generiert.
    </p>
  </div>
</body>
</html>
"""

    try:
        result = resend.Emails.send({
            "from": settings.RESEND_FROM,
            "to": [to_email],
            "subject": "Deine Zugangsdaten – Malteser SOP-Navigator",
            "html": html,
        })
        logger.info("Credentials email sent successfully — Resend id: %s", result.get("id"))
        return True
    except Exception as exc:
        logger.error("Failed to send credentials email to %s: %s", to_email, exc, exc_info=True)
        return False
