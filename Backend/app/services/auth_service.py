"""Auth service — design doc §5.2, §9.3.

Refresh tokens rotate with reuse detection: each token belongs to a
`family_id`. Presenting a token that has already been used revokes the
whole family (a replay means it leaked) rather than just rejecting that
one request.
"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models import RefreshToken, User
from app.models.enums import UserRole
from app.schemas.auth import LoginRequest, SignupRequest


def signup(db: Session, payload: SignupRequest) -> User:
    if db.query(User).filter_by(login_id=payload.login_id).one_or_none():
        raise ConflictError("This login ID is already taken.", code="LOGIN_ID_TAKEN")
    if db.query(User).filter_by(email=payload.email).one_or_none():
        raise ConflictError("This email is already registered.", code="EMAIL_TAKEN")

    # Design decision (§00): self-signup creates ACCOUNTANT users only —
    # portal users are provisioned from a Contact, never from open signup.
    # The wireframe's Sign Up page never collects a name, but `user.name`
    # is NOT NULL — login_id is the placeholder until an Admin (or a future
    # profile screen) sets a real one via the Create User / user-management path.
    user = User(
        login_id=payload.login_id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.login_id,
        role=UserRole.ACCOUNTANT,
        contact_id=None,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _issue_tokens(db: Session, user: User, family_id: str) -> tuple[str, str]:
    access_token = create_access_token(
        subject=str(user.id), role=user.role.value, contact_id=user.contact_id
    )
    raw_refresh, refresh_hash = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            family_id=family_id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            created_at=datetime.now(timezone.utc),
        )
    )
    db.flush()
    return access_token, raw_refresh


def login(db: Session, payload: LoginRequest) -> tuple[User, str, str]:
    user = db.query(User).filter_by(login_id=payload.login_id).one_or_none()
    # Deliberately the same message whether the login_id doesn't exist or the
    # password is wrong — don't let the error shape enumerate valid accounts.
    if user is None or not verify_password(payload.password, user.password_hash):
        raise UnauthorizedError("Invalid login ID or password.", code="INVALID_CREDENTIALS")
    if not user.is_active:
        raise UnauthorizedError("This account has been deactivated.", code="ACCOUNT_INACTIVE")

    family_id = uuid.uuid4().hex
    access_token, raw_refresh = _issue_tokens(db, user, family_id)
    return user, access_token, raw_refresh


def refresh(db: Session, raw_refresh_token: str) -> tuple[str, str]:
    token_hash = hash_refresh_token(raw_refresh_token)
    token_row = db.query(RefreshToken).filter_by(token_hash=token_hash).one_or_none()

    if token_row is None:
        raise UnauthorizedError("Invalid refresh token.", code="INVALID_REFRESH_TOKEN")

    if token_row.is_revoked:
        raise UnauthorizedError("This session has been revoked. Please log in again.", code="REFRESH_REVOKED")

    if token_row.is_used:
        # Reuse of an already-rotated token means it leaked — kill the whole
        # family so every derived token (legitimate or not) stops working.
        #
        # Deliberate, narrow exception to "get_db is the only committer"
        # (§6.1): raising UnauthorizedError below propagates out of the route
        # handler and hits get_db's `except Exception: db.rollback()`, which
        # would otherwise silently undo this revocation before it ever lands —
        # a security response has to survive regardless of how the request
        # that discovered it gets reported to HTTP. commit() here is final;
        # the later rollback() then has nothing pending left to undo.
        db.query(RefreshToken).filter_by(family_id=token_row.family_id).update({"is_revoked": True})
        db.commit()
        raise UnauthorizedError(
            "Refresh token reuse detected; all sessions for this login have been revoked.",
            code="REFRESH_REUSE_DETECTED",
        )

    if token_row.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise UnauthorizedError("Refresh token has expired. Please log in again.", code="REFRESH_EXPIRED")

    user = db.get(User, token_row.user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("User not found or deactivated.", code="ACCOUNT_INACTIVE")

    token_row.is_used = True
    db.flush()
    access_token, raw_new_refresh = _issue_tokens(db, user, token_row.family_id)
    return access_token, raw_new_refresh


def logout(db: Session, raw_refresh_token: str) -> None:
    token_hash = hash_refresh_token(raw_refresh_token)
    token_row = db.query(RefreshToken).filter_by(token_hash=token_hash).one_or_none()
    if token_row is None:
        return  # logout is idempotent — an already-gone token is not an error
    # Revoke the whole family: logging out ends this session everywhere it
    # was rotated to, not just the one token presented.
    db.query(RefreshToken).filter_by(family_id=token_row.family_id).update({"is_revoked": True})
