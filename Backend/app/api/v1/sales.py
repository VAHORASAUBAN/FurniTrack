"""Sales router — design doc §5.5. Mirrors purchase.py exactly: Sales Order
and Customer Invoice share the same `document_service` and `DocumentOut`
shape, with the debit/credit sides flipped inside the engine's posting
rules rather than anywhere in this router."""
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
    prefix="/sales",
    tags=["sales"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)


def _get_document(db: DbSession, document_id: int, *, expected_type: DocType) -> Document:
    document = master_service.get_record(db, Document, document_id, not_found_message="Document not found.")
    if document.doc_type != expected_type:
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


# ---------- Sales Order ----------


@router.get("/orders", response_model=Page[DocumentOut])
def list_sales_orders(
    db: DbSession,
    params: PageParams = Depends(page_params),
    status: DocStatus | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
):
    return _list(db, params, DocType.SALES_ORDER, status=status, date_from=date_from, date_to=date_to)


@router.post("/orders", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_sales_order(payload: DocumentCreate, db: DbSession, user: CurrentUser):
    document = document_service.create_document(
        db, DocType.SALES_ORDER, payload.model_dump(), created_by_user_id=user.id
    )
    return document_service.attach_balance(db, document)


@router.get("/orders/{order_id}", response_model=DocumentOut)
def get_sales_order(order_id: int, db: DbSession):
    document = _get_document(db, order_id, expected_type=DocType.SALES_ORDER)
    return document_service.attach_balance(db, document)


@router.patch("/orders/{order_id}", response_model=DocumentOut)
def update_sales_order(order_id: int, payload: DocumentUpdate, db: DbSession):
    document = _get_document(db, order_id, expected_type=DocType.SALES_ORDER)
    document = document_service.update_document(db, document, payload.model_dump(exclude_unset=True))
    return document_service.attach_balance(db, document)


@router.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sales_order(order_id: int, db: DbSession):
    document = _get_document(db, order_id, expected_type=DocType.SALES_ORDER)
    master_service.delete_draft(db, document, not_draft_message="Only a draft sales order can be deleted.")


@router.post("/orders/{order_id}/confirm", response_model=DocumentOut)
def confirm_sales_order(order_id: int, db: DbSession):
    document = _get_document(db, order_id, expected_type=DocType.SALES_ORDER)
    document = document_service.confirm_document(db, document)
    return document_service.attach_balance(db, document)


@router.post("/orders/{order_id}/cancel", response_model=DocumentOut)
def cancel_sales_order(order_id: int, db: DbSession):
    document = _get_document(db, order_id, expected_type=DocType.SALES_ORDER)
    document = document_service.cancel_draft_or_confirmed(db, document)
    return document_service.attach_balance(db, document)


@router.post("/orders/{order_id}/create-invoice", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_invoice_from_order(order_id: int, db: DbSession, user: CurrentUser):
    so = _get_document(db, order_id, expected_type=DocType.SALES_ORDER)
    invoice = document_service.create_invoice_from_so(db, so, created_by_user_id=user.id)
    return document_service.attach_balance(db, invoice)


@router.get("/orders/{order_id}/pdf")
def get_sales_order_pdf(order_id: int, db: DbSession):
    document = _get_document(db, order_id, expected_type=DocType.SALES_ORDER)
    document_service.attach_balance(db, document)
    company_name = get_company_settings(db).company_name
    pdf_bytes = pdf_service.build_document_pdf(document, company_name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{document.doc_number.replace("/", "-")}.pdf"'},
    )


# ---------- Customer Invoice ----------


@router.get("/invoices", response_model=Page[DocumentOut])
def list_customer_invoices(
    db: DbSession,
    params: PageParams = Depends(page_params),
    status: DocStatus | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
):
    return _list(db, params, DocType.CUSTOMER_INVOICE, status=status, date_from=date_from, date_to=date_to)


@router.post("/invoices", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_customer_invoice(payload: DocumentCreate, db: DbSession, user: CurrentUser):
    document = document_service.create_document(
        db, DocType.CUSTOMER_INVOICE, payload.model_dump(), created_by_user_id=user.id
    )
    return document_service.attach_balance(db, document)


@router.get("/invoices/{invoice_id}", response_model=DocumentOut)
def get_customer_invoice(invoice_id: int, db: DbSession):
    document = _get_document(db, invoice_id, expected_type=DocType.CUSTOMER_INVOICE)
    return document_service.attach_balance(db, document)


@router.patch("/invoices/{invoice_id}", response_model=DocumentOut)
def update_customer_invoice(invoice_id: int, payload: DocumentUpdate, db: DbSession):
    document = _get_document(db, invoice_id, expected_type=DocType.CUSTOMER_INVOICE)
    document = document_service.update_document(db, document, payload.model_dump(exclude_unset=True))
    return document_service.attach_balance(db, document)


@router.delete("/invoices/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer_invoice(invoice_id: int, db: DbSession):
    document = _get_document(db, invoice_id, expected_type=DocType.CUSTOMER_INVOICE)
    master_service.delete_draft(db, document, not_draft_message="Only a draft invoice can be deleted.")


@router.post("/invoices/{invoice_id}/post", response_model=DocumentOut)
def post_customer_invoice(invoice_id: int, db: DbSession, user: CurrentUser):
    document = _get_document(db, invoice_id, expected_type=DocType.CUSTOMER_INVOICE)
    document = document_service.post_document(db, document, posted_by_user_id=user.id)
    return document_service.attach_balance(db, document)


@router.post(
    "/invoices/{invoice_id}/cancel", response_model=DocumentOut, dependencies=[Depends(require_roles(UserRole.ADMIN))]
)
def cancel_customer_invoice(invoice_id: int, db: DbSession, user: CurrentUser):
    document = _get_document(db, invoice_id, expected_type=DocType.CUSTOMER_INVOICE)
    document = document_service.cancel_posted_document(db, document, cancelled_by_user_id=user.id)
    return document_service.attach_balance(db, document)


@router.get("/invoices/{invoice_id}/pdf")
def get_customer_invoice_pdf(invoice_id: int, db: DbSession):
    document = _get_document(db, invoice_id, expected_type=DocType.CUSTOMER_INVOICE)
    document_service.attach_balance(db, document)
    company_name = get_company_settings(db).company_name
    pdf_bytes = pdf_service.build_document_pdf(document, company_name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{document.doc_number.replace("/", "-")}.pdf"'},
    )


@router.post("/invoices/{invoice_id}/send", response_model=SendEmailResponse, status_code=status.HTTP_202_ACCEPTED)
def send_customer_invoice_email(invoice_id: int, payload: SendEmailRequest, db: DbSession):
    document = _get_document(db, invoice_id, expected_type=DocType.CUSTOMER_INVOICE)
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
        subject=f"{company_name} — Invoice {document.doc_number}",
        html=(
            f"<p>Dear {document.partner.name},</p>"
            f"<p>Please find attached Invoice <strong>{document.doc_number}</strong> "
            f"for <strong>Rs. {document.total_amount:,.2f}</strong>, dated {document.doc_date.strftime('%d %b %Y')}.</p>"
            f"<p>{company_name}</p>"
        ),
        pdf_bytes=pdf_bytes,
        pdf_filename=f"{document.doc_number.replace('/', '-')}.pdf",
    )
    return SendEmailResponse(message=f"Invoice sent to {to_email}.")
