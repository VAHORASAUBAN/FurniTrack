"""Dashboard router — design doc §5.8. One call backs the whole landing
screen rather than the frontend firing off six separate report requests."""
from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.accounting.resolver import get_company_settings
from app.core.deps import DbSession, require_roles
from app.models.enums import UserRole
from app.reports import dashboard as dashboard_report
from app.schemas.report import DashboardSummaryOut
from app.services import pdf_service

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)


@router.get("/summary", response_model=DashboardSummaryOut)
def get_dashboard_summary(db: DbSession):
    return dashboard_report.build_dashboard_summary(db)


@router.get("/summary/pdf")
def get_dashboard_summary_pdf(db: DbSession):
    summary = dashboard_report.build_dashboard_summary(db)
    company_name = get_company_settings(db).company_name
    pdf_bytes = pdf_service.build_dashboard_summary_pdf(summary, company_name)
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": 'inline; filename="dashboard-summary.pdf"'},
    )
