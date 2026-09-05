"""Email delivery via Resend (https://resend.com) — design doc §5.5's
Bill/Invoice "Send" action, the one piece of the original design that
genuinely needed external infrastructure (a real API key) rather than
just more code.

A blank RESEND_API_KEY disables sending outright with a clear 409 (code
EMAIL_NOT_CONFIGURED) rather than every request crashing on an auth error
against Resend's API — a dev environment without a key can still run
everything else.
"""
import resend
from resend.exceptions import ResendError

from app.core.config import settings
from app.core.exceptions import AppError, ConflictError

resend.api_key = settings.RESEND_API_KEY


def send_document_email(
    *, to_email: str, subject: str, html: str, pdf_bytes: bytes, pdf_filename: str
) -> str:
    """Returns the Resend message id."""
    if not settings.RESEND_API_KEY:
        raise ConflictError(
            "Email sending isn't configured on this server (no RESEND_API_KEY set).",
            code="EMAIL_NOT_CONFIGURED",
        )
    try:
        response = resend.Emails.send({
            "from": settings.RESEND_FROM_EMAIL,
            "to": to_email,
            "subject": subject,
            "html": html,
            "attachments": [{"filename": pdf_filename, "content": list(pdf_bytes)}],
        })
    except ResendError as exc:
        # Wraps whatever Resend rejected (bad recipient, unverified domain,
        # rate limit) in the same error envelope as every other 4xx here,
        # instead of leaking a third-party library's exception shape.
        raise AppError(f"Could not send email: {exc}", code="EMAIL_SEND_FAILED") from exc
    return response["id"]
