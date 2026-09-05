"""Payment router — design doc §5.6. Creating a payment posts it
immediately (no draft stage) — see payment_service's module docstring."""
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import text

from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.exceptions import NotFoundError
from app.core.pagination import PageParams, apply_sort, page_params, paginate, total_pages
from app.models import Payment
from app.models.enums import PaymentStatus, PaymentType, UserRole
from app.schemas.common import Page
from app.schemas.payment import DocumentOutstandingOut, PaymentCreate, PaymentOut
from app.services import master_service, payment_service

SEARCH_FIELDS = ["payment_number", "note"]
SORT_FIELDS = {"payment_number", "payment_date", "status"}

router = APIRouter(
    prefix="/payments",
    tags=["payments"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)


@router.get("", response_model=Page[PaymentOut])
def list_payments(
    db: DbSession,
    params: PageParams = Depends(page_params),
    payment_type: PaymentType | None = Query(default=None),
    status: PaymentStatus | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
):
    query = db.query(Payment)
    if payment_type is not None:
        query = query.filter(Payment.payment_type == payment_type)
    if status is not None:
        query = query.filter(Payment.status == status)
    if date_from is not None:
        query = query.filter(Payment.payment_date >= date_from)
    if date_to is not None:
        query = query.filter(Payment.payment_date <= date_to)
    if params.search:
        like = f"%{params.search}%"
        query = query.filter(Payment.payment_number.ilike(like))
    query = apply_sort(query, params.sort, Payment, SORT_FIELDS | {"payment_date"}, "-payment_date")
    items, total = paginate(query, params)
    for item in items:
        payment_service.attach_display_fields(item)
    return Page(items=items, page=params.page, page_size=params.page_size,
                total=total, total_pages=total_pages(total, params.page_size))


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_payment(payload: PaymentCreate, db: DbSession, user: CurrentUser):
    payment = payment_service.create_and_post_payment(db, payload.model_dump(), created_by_user_id=user.id)
    return payment_service.attach_display_fields(payment)


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(payment_id: int, db: DbSession):
    payment = master_service.get_record(db, Payment, payment_id, not_found_message="Payment not found.")
    return payment_service.attach_display_fields(payment)


@router.post(
    "/{payment_id}/cancel", response_model=PaymentOut, dependencies=[Depends(require_roles(UserRole.ADMIN))]
)
def cancel_payment(payment_id: int, db: DbSession, user: CurrentUser):
    payment = master_service.get_record(db, Payment, payment_id, not_found_message="Payment not found.")
    payment = payment_service.cancel_payment(db, payment, cancelled_by_user_id=user.id)
    return payment_service.attach_display_fields(payment)


@router.get("/documents/{document_id}/outstanding", response_model=DocumentOutstandingOut)
def get_document_outstanding(document_id: int, db: DbSession):
    """Design doc §5.6 — backs the Pay dialog's amount-due autofill."""
    row = db.execute(
        text(
            "SELECT total_amount, amount_paid, amount_due, payment_status "
            "FROM v_document_balance WHERE document_id = :id"
        ),
        {"id": document_id},
    ).mappings().one_or_none()
    if row is None:
        raise NotFoundError("Document not found.", code="NOT_FOUND")
    return dict(row)
