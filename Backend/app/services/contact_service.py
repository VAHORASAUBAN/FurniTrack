"""Contact service — wraps master_service's generic CRUD and adds the one
piece of contact-specific behaviour: auto-provisioning a PORTAL login.

Design doc / brief: "Contact portal users are provisioned automatically
when a Contact master record is created." The design doc's API section
(§5.3) specifies `create_portal_user: true` on POST /contacts but doesn't
fully spec the credential-issuance mechanics (no SMTP exists to email them,
forgot-password is deferred) — the pragmatic gap-fill here: generate a
login_id from the contact's email, a random temporary password, and return
both ONCE in the create response so an Admin/Accountant can relay them to
the contact out of band. They are never retrievable again after that.
"""
import re
import secrets

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError
from app.core.security import hash_password
from app.models import Contact, User
from app.models.enums import UserRole
from app.services import master_service

SEARCH_FIELDS = ["name", "email", "mobile"]
SORT_FIELDS = {"name", "created_at", "contact_type"}


def _slugify_login_id(email: str) -> str:
    local_part = email.split("@")[0]
    slug = re.sub(r"[^a-z0-9]", "", local_part.lower())
    return (slug or "user")[:10]  # leave room for a numeric suffix, cap stays <=12


def _generate_unique_login_id(db: Session, email: str) -> str:
    base = _slugify_login_id(email)
    base = base if len(base) >= 4 else base.ljust(4, "0")
    candidate = base[:12]
    suffix = 1
    while db.query(User).filter_by(login_id=candidate).one_or_none() is not None:
        candidate = f"{base[: 12 - len(str(suffix))]}{suffix}"
        suffix += 1
    return candidate


def _generate_temp_password() -> str:
    # 12 chars, URL-safe alphabet minus ambiguity concerns aren't worth the
    # complexity here — this is a one-time relay password, not long-lived.
    return secrets.token_urlsafe(9)  # ~12 chars


def create_contact(db: Session, data: dict, *, create_portal_user: bool) -> tuple[Contact, dict | None]:
    contact = master_service.create_record(db, Contact, data)

    if not create_portal_user:
        return contact, None

    if not contact.email:
        raise ConflictError(
            "A portal user cannot be provisioned without a contact email.",
            code="PORTAL_REQUIRES_EMAIL",
        )
    if db.query(User).filter_by(email=contact.email).one_or_none():
        raise ConflictError(
            "A user with this email already exists; cannot provision a portal login.",
            code="EMAIL_TAKEN",
        )

    login_id = _generate_unique_login_id(db, contact.email)
    temp_password = _generate_temp_password()
    portal_user = User(
        login_id=login_id,
        email=contact.email,
        password_hash=hash_password(temp_password),
        name=contact.name,
        role=UserRole.PORTAL,
        contact_id=contact.id,
        is_active=True,
    )
    db.add(portal_user)
    db.flush()

    return contact, {"login_id": login_id, "temporary_password": temp_password}
