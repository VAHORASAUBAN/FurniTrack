"""Analytic Account router — design doc §5.3, §9.1."""
from fastapi import APIRouter, Depends, Query, status

from app.core.deps import DbSession, require_roles
from app.core.pagination import PageParams, page_params, total_pages
from app.models import AnalyticAccount
from app.models.enums import AnalyticType, UserRole
from app.schemas.analytic_account import AnalyticAccountCreate, AnalyticAccountOut, AnalyticAccountUpdate
from app.schemas.common import Page
from app.services import master_service

SEARCH_FIELDS = ["name"]
SORT_FIELDS = {"name", "analytic_type", "updated_at"}

router = APIRouter(
    prefix="/analytic-accounts",
    tags=["analytic-accounts"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)


@router.get("", response_model=Page[AnalyticAccountOut])
def list_analytic_accounts(
    db: DbSession, params: PageParams = Depends(page_params), analytic_type: AnalyticType | None = Query(default=None)
):
    items, total = master_service.list_records(
        db, AnalyticAccount, params, search_fields=SEARCH_FIELDS, sort_fields=SORT_FIELDS, default_sort="-updated_at",
        exact_filters={"analytic_type": analytic_type},
    )
    return Page(items=items, page=params.page, page_size=params.page_size,
                total=total, total_pages=total_pages(total, params.page_size))


@router.post("", response_model=AnalyticAccountOut, status_code=status.HTTP_201_CREATED)
def create_analytic_account(payload: AnalyticAccountCreate, db: DbSession):
    return master_service.create_record(db, AnalyticAccount, payload.model_dump())


@router.get("/{analytic_id}", response_model=AnalyticAccountOut)
def get_analytic_account(analytic_id: int, db: DbSession):
    return master_service.get_record(db, AnalyticAccount, analytic_id, not_found_message="Analytic account not found.")


@router.patch("/{analytic_id}", response_model=AnalyticAccountOut)
def update_analytic_account(analytic_id: int, payload: AnalyticAccountUpdate, db: DbSession):
    obj = master_service.get_record(db, AnalyticAccount, analytic_id, not_found_message="Analytic account not found.")
    return master_service.update_record(db, obj, payload.model_dump(exclude_unset=True))


@router.post("/{analytic_id}/archive", response_model=AnalyticAccountOut, dependencies=[Depends(require_roles(UserRole.ADMIN))])
def archive_analytic_account(analytic_id: int, db: DbSession):
    obj = master_service.get_record(db, AnalyticAccount, analytic_id, not_found_message="Analytic account not found.")
    return master_service.archive_record(db, obj)


@router.post("/{analytic_id}/unarchive", response_model=AnalyticAccountOut, dependencies=[Depends(require_roles(UserRole.ADMIN))])
def unarchive_analytic_account(analytic_id: int, db: DbSession):
    obj = master_service.get_record(db, AnalyticAccount, analytic_id, not_found_message="Analytic account not found.")
    return master_service.unarchive_record(db, obj)
