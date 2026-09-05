"""Dependency injection — design doc §6.1.

`get_db` is the ONLY place in the codebase that calls `session.commit()`.
Services call `db.flush()` when they need a generated id and otherwise do
nothing transaction-related; the commit/rollback decision is made exactly
once, here, after the route handler returns (or raises). This is what makes
§3.5's "posting is one atomic transaction" guarantee hold without a single
explicit `with session.begin():` block anywhere in business code.
"""
from collections.abc import Generator
from typing import Annotated

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Query, Session

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models import Document, User
from app.models.enums import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(db: DbSession, token: Annotated[str | None, Depends(oauth2_scheme)]) -> User:
    if token is None:
        raise UnauthorizedError("Not authenticated.")
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise UnauthorizedError("Invalid or expired token.")

    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedError("Invalid token payload.")

    user = db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise UnauthorizedError("User not found or deactivated.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole):
    """Router-level guard (design doc §6.1) — attach once via
    `APIRouter(dependencies=[Depends(require_roles(...))])`, not per endpoint."""

    def _guard(user: CurrentUser) -> User:
        if user.role not in roles:
            allowed_str = ", ".join(r.value for r in roles)
            raise ForbiddenError(
                f"Role {user.role.value} may not perform this action (requires: {allowed_str})."
            )
        return user

    return _guard


def scoped_documents(db: DbSession, user: CurrentUser) -> Query:
    """Design doc §9.2 — portal scoping enforced at the query, not the UI.
    Every document read for a PORTAL user MUST go through this helper so the
    `partner_id` filter cannot be accidentally omitted by a new endpoint."""
    query = db.query(Document)
    if user.role == UserRole.PORTAL:
        query = query.filter(Document.partner_id == user.contact_id)
    return query
