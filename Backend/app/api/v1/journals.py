"""Journal router — design doc §5.3, §9.1. Pure generic CRUD (no
journal-specific business rule beyond what FK/enum constraints already
enforce), so this wraps master_service directly."""
from fastapi import APIRouter, Depends, Query, status

from app.core.deps import DbSession, require_roles
from app.core.pagination import PageParams, page_params, total_pages
from app.models import Journal
from app.models.enums import JournalType, UserRole
from app.schemas.common import Page
from app.schemas.journal import JournalCreate, JournalOut, JournalUpdate
from app.services import master_service

SEARCH_FIELDS = ["code", "name"]
SORT_FIELDS = {"code", "name", "journal_type"}

router = APIRouter(
    prefix="/journals",
    tags=["journals"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)


@router.get("", response_model=Page[JournalOut])
def list_journals(
    db: DbSession, params: PageParams = Depends(page_params), journal_type: JournalType | None = Query(default=None)
):
    items, total = master_service.list_records(
        db, Journal, params, search_fields=SEARCH_FIELDS, sort_fields=SORT_FIELDS, default_sort="code",
        exact_filters={"journal_type": journal_type},
    )
    return Page(items=items, page=params.page, page_size=params.page_size,
                total=total, total_pages=total_pages(total, params.page_size))


@router.post("", response_model=JournalOut, status_code=status.HTTP_201_CREATED)
def create_journal(payload: JournalCreate, db: DbSession):
    return master_service.create_record(db, Journal, payload.model_dump())


@router.get("/{journal_id}", response_model=JournalOut)
def get_journal(journal_id: int, db: DbSession):
    return master_service.get_record(db, Journal, journal_id, not_found_message="Journal not found.")


@router.patch("/{journal_id}", response_model=JournalOut)
def update_journal(journal_id: int, payload: JournalUpdate, db: DbSession):
    journal = master_service.get_record(db, Journal, journal_id, not_found_message="Journal not found.")
    return master_service.update_record(db, journal, payload.model_dump(exclude_unset=True))


@router.post("/{journal_id}/archive", response_model=JournalOut, dependencies=[Depends(require_roles(UserRole.ADMIN))])
def archive_journal(journal_id: int, db: DbSession):
    journal = master_service.get_record(db, Journal, journal_id, not_found_message="Journal not found.")
    return master_service.archive_record(db, journal)


@router.post("/{journal_id}/unarchive", response_model=JournalOut, dependencies=[Depends(require_roles(UserRole.ADMIN))])
def unarchive_journal(journal_id: int, db: DbSession):
    journal = master_service.get_record(db, Journal, journal_id, not_found_message="Journal not found.")
    return master_service.unarchive_record(db, journal)
