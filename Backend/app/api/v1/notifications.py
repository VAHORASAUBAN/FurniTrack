"""Notifications router — a shared activity feed for Admin/Accountant
staff (Portal users have their own scoped world and no reason to see
internal posting activity)."""
from fastapi import APIRouter, Depends, Query

from app.core.deps import DbSession, require_roles
from app.models.enums import UserRole
from app.schemas.notification import NotificationOut
from app.services import notification_service

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)


@router.get("", response_model=list[NotificationOut])
def list_notifications(db: DbSession, limit: int = Query(default=30, ge=1, le=100)):
    return notification_service.list_recent(db, limit=limit)
