"""Chart of Accounts router — design doc §5.3, §9.1."""
from fastapi import APIRouter, Depends, Query, status

from app.core.deps import DbSession, require_roles
from app.core.pagination import PageParams, page_params, total_pages
from app.models import ChartOfAccount
from app.models.enums import AccountType, UserRole
from app.schemas.account import AccountCreate, AccountOut, AccountUpdate
from app.schemas.common import Page
from app.services import account_service, master_service

router = APIRouter(
    prefix="/accounts",
    tags=["accounts"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)


@router.get("", response_model=Page[AccountOut])
def list_accounts(
    db: DbSession, params: PageParams = Depends(page_params), account_type: AccountType | None = Query(default=None)
):
    items, total = master_service.list_records(
        db, ChartOfAccount, params,
        search_fields=account_service.SEARCH_FIELDS,
        sort_fields=account_service.SORT_FIELDS,
        default_sort="code",
        exact_filters={"account_type": account_type},
    )
    return Page(items=items, page=params.page, page_size=params.page_size,
                total=total, total_pages=total_pages(total, params.page_size))


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(payload: AccountCreate, db: DbSession):
    return account_service.create_account(db, payload.model_dump())


@router.get("/{account_id}", response_model=AccountOut)
def get_account(account_id: int, db: DbSession):
    return master_service.get_record(db, ChartOfAccount, account_id, not_found_message="Account not found.")


@router.patch("/{account_id}", response_model=AccountOut)
def update_account(account_id: int, payload: AccountUpdate, db: DbSession):
    account = master_service.get_record(db, ChartOfAccount, account_id, not_found_message="Account not found.")
    return account_service.update_account(db, account, payload.model_dump(exclude_unset=True))


@router.post("/{account_id}/archive", response_model=AccountOut, dependencies=[Depends(require_roles(UserRole.ADMIN))])
def archive_account(account_id: int, db: DbSession):
    account = master_service.get_record(db, ChartOfAccount, account_id, not_found_message="Account not found.")
    return master_service.archive_record(db, account)


@router.post("/{account_id}/unarchive", response_model=AccountOut, dependencies=[Depends(require_roles(UserRole.ADMIN))])
def unarchive_account(account_id: int, db: DbSession):
    account = master_service.get_record(db, ChartOfAccount, account_id, not_found_message="Account not found.")
    return master_service.unarchive_record(db, account)
