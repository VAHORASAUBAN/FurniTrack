"""Journal Entry router — design doc §5.4. The manual-entry flow: Draft →
edit lines → Post (blocking on the balance rule) → optionally Cancel
(reversal) or Reset to Draft (Admin-only correction, no reversal)."""
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response

from app.accounting.resolver import get_company_settings
from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.pagination import PageParams, page_params, total_pages
from app.models import JournalEntry
from app.models.enums import JournalEntryStatus, UserRole
from app.schemas.common import Page
from app.schemas.journal_entry import JournalEntryCreate, JournalEntryOut, JournalEntryUpdate
from app.services import journal_entry_service, master_service, pdf_service

SEARCH_FIELDS = ["entry_number", "reference"]
SORT_FIELDS = {"entry_number", "entry_date", "status"}

router = APIRouter(
    prefix="/journal-entries",
    tags=["journal-entries"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)


@router.get("", response_model=Page[JournalEntryOut])
def list_journal_entries(
    db: DbSession,
    params: PageParams = Depends(page_params),
    status: JournalEntryStatus | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
):
    items, total = master_service.list_records(
        db, JournalEntry, params, search_fields=SEARCH_FIELDS, sort_fields=SORT_FIELDS, default_sort="-entry_date",
        exact_filters={"status": status}, date_range=("entry_date", date_from, date_to),
    )
    return Page(items=items, page=params.page, page_size=params.page_size,
                total=total, total_pages=total_pages(total, params.page_size))


@router.post("", response_model=JournalEntryOut, status_code=status.HTTP_201_CREATED)
def create_journal_entry(payload: JournalEntryCreate, db: DbSession):
    entry = journal_entry_service.create_draft(db, payload.model_dump())
    db.flush()
    db.refresh(entry)
    return entry


@router.get("/{entry_id}", response_model=JournalEntryOut)
def get_journal_entry(entry_id: int, db: DbSession):
    return master_service.get_record(db, JournalEntry, entry_id, not_found_message="Journal entry not found.")


@router.patch("/{entry_id}", response_model=JournalEntryOut)
def update_journal_entry(entry_id: int, payload: JournalEntryUpdate, db: DbSession):
    entry = master_service.get_record(db, JournalEntry, entry_id, not_found_message="Journal entry not found.")
    entry = journal_entry_service.update_draft(db, entry, payload.model_dump(exclude_unset=True))
    db.refresh(entry)
    return entry


@router.post("/{entry_id}/post", response_model=JournalEntryOut)
def post_journal_entry(entry_id: int, db: DbSession, user: CurrentUser):
    entry = master_service.get_record(db, JournalEntry, entry_id, not_found_message="Journal entry not found.")
    entry = journal_entry_service.post(db, entry, posted_by_user_id=user.id)
    db.refresh(entry)
    return entry


@router.post(
    "/{entry_id}/cancel", response_model=JournalEntryOut, dependencies=[Depends(require_roles(UserRole.ADMIN))]
)
def cancel_journal_entry(entry_id: int, db: DbSession, user: CurrentUser):
    entry = master_service.get_record(db, JournalEntry, entry_id, not_found_message="Journal entry not found.")
    reversal = journal_entry_service.cancel(db, entry, cancelled_by_user_id=user.id)
    db.refresh(reversal)
    return reversal


@router.get("/{entry_id}/pdf")
def get_journal_entry_pdf(entry_id: int, db: DbSession):
    entry = master_service.get_record(db, JournalEntry, entry_id, not_found_message="Journal entry not found.")
    company_name = get_company_settings(db).company_name
    pdf_bytes = pdf_service.build_journal_entry_pdf(entry, company_name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{entry.entry_number.replace("/", "-")}.pdf"'},
    )


@router.post(
    "/{entry_id}/reset-to-draft",
    response_model=JournalEntryOut,
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
def reset_journal_entry_to_draft(entry_id: int, db: DbSession):
    entry = master_service.get_record(db, JournalEntry, entry_id, not_found_message="Journal entry not found.")
    entry = journal_entry_service.reset_to_draft(db, entry)
    db.refresh(entry)
    return entry
