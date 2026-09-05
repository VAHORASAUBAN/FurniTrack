"""Admin user-management service — the wireframe's "Create User" screen
(design doc §5.2's stated credential rules: unique login_id 6-12 chars,
unique email — the same two checks `auth_service.signup` already enforces
for self-registration, reused here for any role)."""
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.core.pagination import PageParams, apply_sort, paginate
from app.core.security import hash_password
from app.models import Contact, User
from app.models.enums import UserRole

SEARCH_FIELDS = ["name", "login_id", "email"]
SORT_FIELDS = {"name", "login_id", "role", "updated_at"}


def list_users(db: Session, params: PageParams, *, role: UserRole | None = None) -> tuple[list[User], int]:
    query = db.query(User)
    if not params.include_archived:
        query = query.filter(User.is_active.is_(True))
    if params.search:
        like = f"%{params.search}%"
        query = query.filter(or_(*(getattr(User, f).ilike(like) for f in SEARCH_FIELDS)))
    if role is not None:
        query = query.filter(User.role == role)
    query = apply_sort(query, params.sort, User, SORT_FIELDS, "-updated_at")
    return paginate(query, params)


def create_user(db: Session, data: dict) -> User:
    if db.query(User).filter_by(login_id=data["login_id"]).one_or_none():
        raise ConflictError("This login ID is already taken.", code="LOGIN_ID_TAKEN")
    if db.query(User).filter_by(email=data["email"]).one_or_none():
        raise ConflictError("This email is already registered.", code="EMAIL_TAKEN")

    contact_id = data.get("contact_id")
    if contact_id is not None:
        contact = db.get(Contact, contact_id)
        if contact is None:
            raise NotFoundError("Contact not found.", code="NOT_FOUND")
        if db.query(User).filter_by(contact_id=contact_id).one_or_none():
            raise ConflictError(
                "This contact already has a portal login.", code="CONTACT_ALREADY_LINKED"
            )

    user = User(
        name=data["name"],
        login_id=data["login_id"],
        email=data["email"],
        password_hash=hash_password(data["password"]),
        role=data["role"],
        contact_id=contact_id,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def deactivate_user(db: Session, user: User) -> User:
    user.is_active = False
    db.flush()
    return user


def reactivate_user(db: Session, user: User) -> User:
    user.is_active = True
    db.flush()
    return user
