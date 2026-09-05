"""Contact router — design doc §5.3, §9.1 permission matrix (archive is
Admin-only; everything else is Admin+Accountant)."""
import os
import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.exceptions import AppError
from app.core.pagination import PageParams, page_params, total_pages
from app.models import Contact
from app.models.enums import UserRole
from app.schemas.common import Page
from app.schemas.contact import ContactCreate, ContactCreateResponse, ContactOut, ContactUpdate
from app.services import contact_service, master_service

router = APIRouter(
    prefix="/contacts",
    tags=["contacts"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.get("", response_model=Page[ContactOut])
def list_contacts(db: DbSession, params: PageParams = Depends(page_params)):
    items, total = master_service.list_records(
        db, Contact, params,
        search_fields=contact_service.SEARCH_FIELDS,
        sort_fields=contact_service.SORT_FIELDS,
        default_sort="-updated_at",
    )
    return Page(items=items, page=params.page, page_size=params.page_size,
                total=total, total_pages=total_pages(total, params.page_size))


@router.post("", response_model=ContactCreateResponse, status_code=status.HTTP_201_CREATED)
def create_contact(payload: ContactCreate, db: DbSession):
    data = payload.model_dump(exclude={"create_portal_user"})
    contact, portal_credentials = contact_service.create_contact(
        db, data, create_portal_user=payload.create_portal_user
    )
    return ContactCreateResponse(contact=contact, portal_credentials=portal_credentials)


@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(contact_id: int, db: DbSession):
    return master_service.get_record(db, Contact, contact_id, not_found_message="Contact not found.")


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(contact_id: int, payload: ContactUpdate, db: DbSession):
    contact = master_service.get_record(db, Contact, contact_id, not_found_message="Contact not found.")
    return master_service.update_record(db, contact, payload.model_dump(exclude_unset=True))


@router.post("/{contact_id}/archive", response_model=ContactOut, dependencies=[Depends(require_roles(UserRole.ADMIN))])
def archive_contact(contact_id: int, db: DbSession):
    contact = master_service.get_record(db, Contact, contact_id, not_found_message="Contact not found.")
    return master_service.archive_record(db, contact)


@router.post("/{contact_id}/unarchive", response_model=ContactOut, dependencies=[Depends(require_roles(UserRole.ADMIN))])
def unarchive_contact(contact_id: int, db: DbSession):
    contact = master_service.get_record(db, Contact, contact_id, not_found_message="Contact not found.")
    return master_service.unarchive_record(db, contact)


@router.post("/{contact_id}/image")
async def upload_contact_image(contact_id: int, db: DbSession, file: UploadFile = File(...)):
    contact = master_service.get_record(db, Contact, contact_id, not_found_message="Contact not found.")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise AppError(
            f"Unsupported image type {file.content_type!r}. Allowed: jpeg, png, webp.",
            code="UNSUPPORTED_IMAGE_TYPE",
        )
    contents = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise AppError(f"Image exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit.", code="IMAGE_TOO_LARGE")

    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[file.content_type]
    filename = f"contact_{contact_id}_{uuid.uuid4().hex[:8]}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(contents)

    contact.profile_image_url = f"/static/{filename}"
    db.flush()
    return {"profile_image_url": contact.profile_image_url}
