"""Email service — sends transactional emails via Resend."""

import logging

import resend

from app.core.settings import settings

logger = logging.getLogger(__name__)

APP_URL = settings.app_url


def _build_html(title: str, message: str, lab_name: str | None = None) -> str:
    lab_line = f"<p style='color:#666;font-size:14px;'>Lab: <strong>{lab_name}</strong></p>" if lab_name else ""
    return f"""\
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#18181b;margin:0 0 8px;">{title}</h2>
  {lab_line}
  <p style="color:#3f3f46;font-size:15px;line-height:1.5;">{message}</p>
  <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;" />
  <a href="{APP_URL}/dashboard"
     style="display:inline-block;background:#18181b;color:#fff;padding:10px 20px;
            border-radius:6px;text-decoration:none;font-size:14px;">
    Open Molecule Manager
  </a>
  <p style="color:#a1a1aa;font-size:12px;margin-top:24px;">
    You received this because you are a member of a lab on Molecule Manager.
  </p>
</div>"""


def send_email(to: str, subject: str, html: str) -> None:
    """Send an email via Resend. Silently skips if RESEND_API_KEY is not configured."""
    api_key = settings.resend_api_key
    if not api_key:
        logger.debug("RESEND_API_KEY not set — skipping email to %s", to)
        return

    resend.api_key = api_key
    try:
        resend.Emails.send(
            {
                "from": "Molecule Manager <notifications@moleculemanager.app>",
                "to": [to],
                "subject": subject,
                "html": html,
            }
        )
    except Exception:
        logger.exception("Failed to send email to %s", to)


def send_notification_email(
    to: str,
    title: str,
    message: str,
    lab_name: str | None = None,
) -> None:
    """Build and send a notification email."""
    html = _build_html(title, message, lab_name)
    send_email(to, f"Molecule Manager — {title}", html)
