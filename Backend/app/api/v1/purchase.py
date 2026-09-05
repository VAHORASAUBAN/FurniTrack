"""Purchase router — design doc §5.5. Purchase Order and Vendor Bill share
one service (`document_service`) and one response shape (`DocumentOut`);
`doc_type` is bound by which prefix the request came in on, never by the
request body — see `document_service.create_document`'s caller here."""
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy import or_

from app.accounting.resolver import get_company_settings
from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.exceptions import AppError, NotFoundError
from app.core.pagination import PageParams, apply_sort, page_params, paginate, total_pages
from app.models import Document
from app.models.enums import DocStatus, DocType, UserRole
from app.schemas.common import Page
from app.schemas.document import DocumentCreate, DocumentOut, DocumentUpdate, SendEmailRequest, SendEmailResponse
from app.services import document_service, email_service, master_service, pdf_service

SEARCH_FIELDS = ["doc_number", "reference"]
SORT_FIELDS = {"doc_number", "doc_date", "status"}

router = APIRouter(
    prefix="/purchase",
    tags=["purchase"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)


def _get_document(db: DbSession, document_id: int, *, expected_type: DocType) -> Document:
    document = master_service.get_record(db, Document, document_id, not_found_message="Document not found.")
    if document.doc_type != expected_type:
        # A Bill id used against /orders/{id} (or vice versa) is a routing
        # mistake, not "the document doesn't exist" — but 404 is still the
        # right signal: from this URL's point of view, it isn't there.
        raise NotFoundError("Document not found.", code="NOT_FOUND")
    return document


def _list(
    db: DbSession,
    params: PageParams,
    doc_type: DocType,
    *,
    status: DocStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> Page[DocumentOut]:
    query = db.query(Document).filter(Document.doc_type == doc_type)

    if params.search:
        like = f"%{params.search}%"
        query = query.filter(or_(*(getattr(Document, f).ilike(like) for f in SEARCH_FIELDS)))
    if status is not None:
        query = query.filter(Document.status == status)
    if date_from is not None:
        query = query.filter(Document.doc_date >= date_from)
    if date_to is not None:
        query = query.filter(Document.doc_date <= date_to)
    query = apply_sort(query, params.sort, Document, SORT_FIELDS | {"doc_date", "updated_at"}, "-updated_at")
    items, total = paginate(query, params)
    for item in items:
        document_service.attach_balance(db, item)
    return Page(items=items, page=params.page, page_size=params.page_size,
                total=total, total_pages=total_pages(total, params.page_size))


# ---------- Purchase Order ----------


@router.get("/orders", response_model=Page[DocumentOut])
def list_purchase_orders(
    db: DbSession,
    params: PageParams = Depends(page_params),
    status: DocStatus | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
):
    return _list(db, params, DocType.PURCHASE_ORDER, status=status, date_from=date_from, date_to=date_to)


@router.post("/orders", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_purchase_order(payload: DocumentCreate, db: DbSession, user: CurrentUser):
    document = document_service.create_document(
        db, DocType.PURCHASE_ORDER, payload.model_dump(), created_by_user_id=user.id
    )
    return document_service.attach_balance(db, document)


@router.get("/orders/{order_id}", response_model=DocumentOut)
def get_purchase_order(order_id: int, db: DbSession):
    document = _get_document(db, order_id, expected_type=DocType.PURCHASE_ORDER)
    return document_service.attach_balance(db, document)


@router.patch("/orders/{order_id}", response_model=DocumentOut)
def update_purchase_order(order_id: int, payload: DocumentUpdate, db: DbSession):
    document = _get_document(db, order_id, expected_type=DocType.PURCHASE_ORDER)
    document = document_service.update_document(db, document, payload.model_dump(exclude_unset=True))
    return document_service.attach_balance(db, document)


@router.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order(order_id: int, db: DbSession):
    document = _get_document(db, order_id, expected_type=DocType.PURCHASE_ORDER)
    master_service.delete_draft(db, document, not_draft_message="Only a draft purchase order can be deleted.")


@router.post("/orders/{order_id}/confirm", response_model=DocumentOut)
def confirm_purchase_order(order_id: int, db: DbSession):
    document = _get_document(db, order_id, expected_type=DocType.PURCHASE_ORDER)
    document = document_service.confirm_document(db, document)
    return document_service.attach_balance(db, document)


@router.post("/orders/{order_id}/cancel", response_model=DocumentOut)
def cancel_purchase_order(order_id: int, db: DbSession):
    document = _get_document(db, order_id, expected_type=DocType.PURCHASE_ORDER)
    document = document_service.cancel_draft_or_confirmed(db, document)
    return document_service.attach_balance(db, document)


@router.post("/orders/{order_id}/create-bill", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_bill_from_order(order_id: int, db: DbSession, user: CurrentUser):
    po = _get_document(db, order_id, expected_type=DocType.PURCHASE_ORDER)
    bill = document_service.create_bill_from_po(db, po, created_by_user_id=user.id)
    return document_service.attach_balance(db, bill)


@router.get("/orders/{order_id}/pdf")
def get_purchase_order_pdf(order_id: int, db: DbSession):
    # build_document_pdf branches on doc_type for the title only and
    # renders the balance block conditionally — a PO has no balance/due_date,
    # so this is otherwise the same document layout as the Bill PDF below.
    document = _get_document(db, order_id, expected_type=DocType.PURCHASE_ORDER)
    document_service.attach_balance(db, document)
    company_name = get_company_settings(db).company_name
    pdf_bytes = pdf_service.build_document_pdf(document, company_name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{document.doc_number.replace("/", "-")}.pdf"'},
    )


# ---------- Vendor Bill ----------


@router.get("/bills", response_model=Page[DocumentOut])
def list_vendor_bills(
    db: DbSession,
    params: PageParams = Depends(page_params),
    status: DocStatus | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
):
    return _list(db, params, DocType.VENDOR_BILL, status=status, date_from=date_from, date_to=date_to)


@router.post("/bills", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_vendor_bill(payload: DocumentCreate, db: DbSession, user: CurrentUser):
    """Bills can also be created fresh, without a Purchase Order — the
    wireframe's Bill form hides the "PO" back-link button in exactly that case."""
    document = document_service.create_document(
        db, DocType.VENDOR_BILL, payload.model_dump(), created_by_user_id=user.id
    )
    return document_service.attach_balance(db, document)


@router.get("/bills/{bill_id}", response_model=DocumentOut)
def get_vendor_bill(bill_id: int, db: DbSession):
    document = _get_document(db, bill_id, expected_type=DocType.VENDOR_BILL)
    return document_service.attach_balance(db, document)


@router.patch("/bills/{bill_id}", response_model=DocumentOut)
def update_vendor_bill(bill_id: int, payload: DocumentUpdate, db: DbSession):
    document = _get_document(db, bill_id, expected_type=DocType.VENDOR_BILL)
    document = document_service.update_document(db, document, payload.model_dump(exclude_unset=True))
    return document_service.attach_balance(db, document)


@router.delete("/bills/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor_bill(bill_id: int, db: DbSession):
    document = _get_document(db, bill_id, expected_type=DocType.VENDOR_BILL)
    master_service.delete_draft(db, document, not_draft_message="Only a draft bill can be deleted.")


@router.post("/bills/{bill_id}/post", response_model=DocumentOut)
def post_vendor_bill(bill_id: int, db: DbSession, user: CurrentUser):
    document = _get_document(db, bill_id, expected_type=DocType.VENDOR_BILL)
    document = document_service.post_document(db, document, posted_by_user_id=user.id)
    return document_service.attach_balance(db, document)


@router.post(
    "/bills/{bill_id}/cancel", response_model=DocumentOut, dependencies=[Depends(require_roles(UserRole.ADMIN))]
)
def cancel_vendor_bill(bill_id: int, db: DbSession, user: CurrentUser):
    document = _get_document(db, bill_id, expected_type=DocType.VENDOR_BILL)
    document = document_service.cancel_posted_document(db, document, cancelled_by_user_id=user.id)
    return document_service.attach_balance(db, document)


@router.get("/bills/{bill_id}/pdf")
def get_vendor_bill_pdf(bill_id: int, db: DbSession):
    document = _get_document(db, bill_id, expected_type=DocType.VENDOR_BILL)
    document_service.attach_balance(db, document)
    company_name = get_company_settings(db).company_name
    pdf_bytes = pdf_service.build_document_pdf(document, company_name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{document.doc_number.replace("/", "-")}.pdf"'},
    )


@router.post("/bills/{bill_id}/send", response_model=SendEmailResponse, status_code=status.HTTP_202_ACCEPTED)
def send_vendor_bill_email(bill_id: int, payload: SendEmailRequest, db: DbSession):
    document = _get_document(db, bill_id, expected_type=DocType.VENDOR_BILL)
    document_service.attach_balance(db, document)
    to_email = payload.to_email or document.partner.email
    if not to_email:
        raise AppError(
            f"{document.partner.name} has no email on file — add one or enter a recipient.",
            code="NO_RECIPIENT_EMAIL",
        )
    company_name = get_company_settings(db).company_name
    pdf_bytes = pdf_service.build_document_pdf(document, company_name)
    email_service.send_document_email(
        to_email=to_email,
        subject=f"{company_name} — Bill {document.doc_number}",
        html=(
            f"<p>Dear {document.partner.name},</p>"
            f"<p>Please find attached Bill <strong>{document.doc_number}</strong> "
            f"for <strong>Rs. {document.total_amount:,.2f}</strong>, dated {document.doc_date.strftime('%d %b %Y')}.</p>"
            f"<p>{company_name}</p>"
        ),
        pdf_bytes=pdf_bytes,
        pdf_filename=f"{document.doc_number.replace('/', '-')}.pdf",
    )
    return SendEmailResponse(message=f"Bill sent to {to_email}.")
