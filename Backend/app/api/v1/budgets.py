"""Budget router — design doc §5.7. Confirm/edit follow the same
Draft-only-editable pattern as documents and manual journal entries;
Cancel is Admin-only, matching the permission matrix (§9.1)."""
from datetime import date

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import DbSession, require_roles
from app.core.pagination import PageParams, page_params, total_pages
from app.models import Budget
from app.models.enums import BudgetStatus, UserRole
from app.schemas.budget import BudgetCreate, BudgetOut, BudgetUpdate
from app.schemas.common import Page
from app.services import budget_service, master_service

SEARCH_FIELDS = ["name"]
SORT_FIELDS = {"name", "start_date", "end_date", "status", "updated_at"}

router = APIRouter(
    prefix="/budgets",
    tags=["budgets"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)


@router.get("", response_model=Page[BudgetOut])
def list_budgets(
    db: DbSession,
    params: PageParams = Depends(page_params),
    status: BudgetStatus | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
):
    items, total = master_service.list_records(
        db, Budget, params, search_fields=SEARCH_FIELDS, sort_fields=SORT_FIELDS, default_sort="-updated_at",
        exact_filters={"status": status}, date_range=("start_date", date_from, date_to),
    )
    for item in items:
        budget_service.attach_achieved(db, item)
    return Page(items=items, page=params.page, page_size=params.page_size,
                total=total, total_pages=total_pages(total, params.page_size))


@router.post("", response_model=BudgetOut, status_code=status.HTTP_201_CREATED)
def create_budget(payload: BudgetCreate, db: DbSession):
    budget = budget_service.create_draft(db, payload.model_dump())
    return budget_service.attach_achieved(db, budget)


@router.get("/{budget_id}", response_model=BudgetOut)
def get_budget(budget_id: int, db: DbSession):
    budget = master_service.get_record(db, Budget, budget_id, not_found_message="Budget not found.")
    return budget_service.attach_achieved(db, budget)


@router.patch("/{budget_id}", response_model=BudgetOut)
def update_budget(budget_id: int, payload: BudgetUpdate, db: DbSession):
    budget = master_service.get_record(db, Budget, budget_id, not_found_message="Budget not found.")
    budget = budget_service.update_draft(db, budget, payload.model_dump(exclude_unset=True))
    return budget_service.attach_achieved(db, budget)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: int, db: DbSession):
    budget = master_service.get_record(db, Budget, budget_id, not_found_message="Budget not found.")
    master_service.delete_draft(db, budget, not_draft_message="Only a draft budget can be deleted.")


@router.post("/{budget_id}/confirm", response_model=BudgetOut)
def confirm_budget(budget_id: int, db: DbSession):
    budget = master_service.get_record(db, Budget, budget_id, not_found_message="Budget not found.")
    budget = budget_service.confirm_budget(db, budget)
    return budget_service.attach_achieved(db, budget)


@router.post("/{budget_id}/revise", response_model=BudgetOut, status_code=status.HTTP_201_CREATED)
def revise_budget(budget_id: int, db: DbSession):
    budget = master_service.get_record(db, Budget, budget_id, not_found_message="Budget not found.")
    revised = budget_service.revise_budget(db, budget)
    return budget_service.attach_achieved(db, revised)


@router.post(
    "/{budget_id}/cancel", response_model=BudgetOut, dependencies=[Depends(require_roles(UserRole.ADMIN))]
)
def cancel_budget(budget_id: int, db: DbSession):
    budget = master_service.get_record(db, Budget, budget_id, not_found_message="Budget not found.")
    budget = budget_service.cancel_budget(db, budget)
    return budget_service.attach_achieved(db, budget)
