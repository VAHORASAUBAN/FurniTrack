"""Portal router — design doc §5.9. Every route requires the PORTAL role
(no staff user can hit these — they'd get their own document endpoints
instead), and every read/write is scoped to the caller's own contact via
`portal_service`, never trusted to a client-supplied id."""
from fastapi import APIRouter, Depends, status
from fastapi.responses import Response

from app.accounting.resolver import get_company_settings
from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.pagination import PageParams, page_params, total_pages
from app.models.enums import UserRole
from app.schemas.common import Page
from app.schemas.document import DocumentOut
from app.schemas.payment import PaymentOut
from app.schemas.portal import PortalPaymentIn
from app.services import document_service, payment_service, pdf_service, portal_service

router = APIRouter(
    prefix="/portal",
    tags=["portal"],
    dependencies=[Depends(require_roles(UserRole.PORTAL))],
)


@router.get("/invoices", response_model=Page[DocumentOut])
def list_my_invoices(db: DbSession, user: CurrentUser, params: PageParams = Depends(page_params)):
    items, total = portal_service.list_own_invoices(db, user, params)
    for item in items:
        document_service.attach_balance(db, item)
    return Page(items=items, page=params.page, page_size=params.page_size,
                total=total, total_pages=total_pages(total, params.page_size))


@router.get("/invoices/{invoice_id}", response_model=DocumentOut)
def get_my_invoice(invoice_id: int, db: DbSession, user: CurrentUser):
    document = portal_service.get_own_invoice(db, user, invoice_id)
    return document_service.attach_balance(db, document)


@router.post("/invoices/{invoice_id}/pay", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def pay_my_invoice(invoice_id: int, payload: PortalPaymentIn, db: DbSession, user: CurrentUser):
    payment = portal_service.pay_own_invoice(
        db, user, invoice_id, method=payload.method, amount=payload.amount, payment_date=payload.payment_date
    )
    return payment_service.attach_display_fields(payment)


@router.get("/invoices/{invoice_id}/pdf")
def get_my_invoice_pdf(invoice_id: int, db: DbSession, user: CurrentUser):
    document = portal_service.get_own_invoice(db, user, invoice_id)
    document_service.attach_balance(db, document)
    company_name = get_company_settings(db).company_name
    pdf_bytes = pdf_service.build_document_pdf(document, company_name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{document.doc_number.replace("/", "-")}.pdf"'},
    )


# A vendor's side of the portal — read-only (no /pay: a vendor doesn't
# settle their own bill, the staff side does via Purchase > Payments).
@router.get("/bills", response_model=Page[DocumentOut])
def list_my_bills(db: DbSession, user: CurrentUser, params: PageParams = Depends(page_params)):
    items, total = portal_service.list_own_bills(db, user, params)
    for item in items:
        document_service.attach_balance(db, item)
    return Page(items=items, page=params.page, page_size=params.page_size,
                total=total, total_pages=total_pages(total, params.page_size))


@router.get("/bills/{bill_id}", response_model=DocumentOut)
def get_my_bill(bill_id: int, db: DbSession, user: CurrentUser):
    document = portal_service.get_own_bill(db, user, bill_id)
    return document_service.attach_balance(db, document)


@router.get("/bills/{bill_id}/pdf")
def get_my_bill_pdf(bill_id: int, db: DbSession, user: CurrentUser):
    document = portal_service.get_own_bill(db, user, bill_id)
    document_service.attach_balance(db, document)
    company_name = get_company_settings(db).company_name
    pdf_bytes = pdf_service.build_document_pdf(document, company_name)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{document.doc_number.replace("/", "-")}.pdf"'},
    )
