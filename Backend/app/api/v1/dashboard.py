"""Dashboard router — design doc §5.8. One call backs the whole landing
screen rather than the frontend firing off six separate report requests."""
from fastapi import APIRouter, Depends

from app.core.deps import DbSession, require_roles
from app.models.enums import UserRole
from app.reports import dashboard as dashboard_report
from app.schemas.report import DashboardSummaryOut

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)


@router.get("/summary", response_model=DashboardSummaryOut)
def get_dashboard_summary(db: DbSession):
    return dashboard_report.build_dashboard_summary(db)
