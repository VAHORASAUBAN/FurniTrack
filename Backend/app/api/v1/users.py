"""User management router — the wireframe's "Create User" screen.
Admin-only end to end: only an Admin may create a login of any role, and
only an Admin may deactivate one."""
from fastapi import APIRouter, Depends, status

from app.core.deps import DbSession, require_roles
from app.core.pagination import PageParams, page_params, total_pages
from app.models import User
from app.models.enums import UserRole
from app.schemas.auth import UserOut
from app.schemas.common import Page
from app.schemas.user import UserCreate
from app.services import master_service, user_service

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)


@router.get("", response_model=Page[UserOut])
def list_users(db: DbSession, params: PageParams = Depends(page_params)):
    items, total = user_service.list_users(db, params)
    return Page(items=items, page=params.page, page_size=params.page_size,
                total=total, total_pages=total_pages(total, params.page_size))


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: DbSession):
    return user_service.create_user(db, payload.model_dump())


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: DbSession):
    return master_service.get_record(db, User, user_id, not_found_message="User not found.")


@router.post("/{user_id}/archive", response_model=UserOut)
def archive_user(user_id: int, db: DbSession):
    user = master_service.get_record(db, User, user_id, not_found_message="User not found.")
    return user_service.deactivate_user(db, user)


@router.post("/{user_id}/unarchive", response_model=UserOut)
def unarchive_user(user_id: int, db: DbSession):
    user = master_service.get_record(db, User, user_id, not_found_message="User not found.")
    return user_service.reactivate_user(db, user)
