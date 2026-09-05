"""Password hashing + JWT — design doc §9.3.

Passwords: bcrypt via passlib, cost factor 12 (passlib's bcrypt default).
Access tokens: JWT, HS256, short-lived. Refresh tokens: opaque random
strings — only their SHA-256 hash is ever stored (see models.RefreshToken),
so a leaked DB dump doesn't hand out usable refresh tokens.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(*, subject: str, role: str, contact_id: int | None, jti: str | None = None) -> str:
    """`subject` is the user id (as a string, per JWT `sub` convention)."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "contact_id": contact_id,
        "iat": now,
        "exp": expire,
        "jti": jti or secrets.token_hex(8),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Raises jose.JWTError (expired / bad signature / malformed) — callers
    catch this and turn it into a 401, never let it bubble as a 500."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def generate_refresh_token() -> tuple[str, str]:
    """Returns (raw_token_to_send_to_client, sha256_hash_to_store_in_db)."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


class TokenError(Exception):
    """Raised for any invalid/expired/reused token — routers map this to 401."""
