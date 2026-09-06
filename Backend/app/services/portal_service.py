"""Portal service — design doc §9.2. Every read goes through
`deps.scoped_documents`, which filters to `partner_id == user.contact_id`
for a PORTAL user — the enforcement lives here, at the query, not trusted
to the UI. A wrong invoice id therefore comes back as 404, not 403: a
portal user can't even confirm another contact's invoice exists.
"""
from datetime import date
from decimal import Decimal

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.accounting import resolver
from app.core.deps import scoped_documents
from app.core.exceptions import NotFoundError, PostingError
from app.core.pagination import PageParams, apply_sort, paginate
from app.models import Document, Payment, User
from app.models.enums import DocType, PaymentMethod, PaymentType
from app.services import payment_service

SEARCH_FIELDS = ["doc_number", "reference"]
SORT_FIELDS = {"doc_number", "doc_date", "status", "updated_at"}


def list_own_invoices(db: Session, user: User, params: PageParams) -> tuple[list[Document], int]:
    query = scoped_documents(db, user).filter(Document.doc_type == DocType.CUSTOMER_INVOICE)
    if params.search:
        like = f"%{params.search}%"
        query = query.filter(or_(*(getattr(Document, f).ilike(like) for f in SEARCH_FIELDS)))
    query = apply_sort(query, params.sort, Document, SORT_FIELDS | {"doc_date", "updated_at"}, "-updated_at")
    return paginate(query, params)


def get_own_invoice(db: Session, user: User, invoice_id: int) -> Document:
    document = (
        scoped_documents(db, user)
        .filter(Document.id == invoice_id, Document.doc_type == DocType.CUSTOMER_INVOICE)
        .one_or_none()
    )
    if document is None:
        raise NotFoundError("Invoice not found.", code="NOT_FOUND")
    return document


def list_own_bills(db: Session, user: User, params: PageParams) -> tuple[list[Document], int]:
    """A vendor's side of the portal (design doc §5.9's "invoices/bills") —
    read-only: a vendor sees what they're owed, they don't pay themselves."""
    query = scoped_documents(db, user).filter(Document.doc_type == DocType.VENDOR_BILL)
    if params.search:
        like = f"%{params.search}%"
        query = query.filter(or_(*(getattr(Document, f).ilike(like) for f in SEARCH_FIELDS)))
    query = apply_sort(query, params.sort, Document, SORT_FIELDS | {"doc_date", "updated_at"}, "-updated_at")
    return paginate(query, params)


def get_own_bill(db: Session, user: User, bill_id: int) -> Document:
    document = (
        scoped_documents(db, user)
        .filter(Document.id == bill_id, Document.doc_type == DocType.VENDOR_BILL)
        .one_or_none()
    )
    if document is None:
        raise NotFoundError("Bill not found.", code="NOT_FOUND")
    return document


def pay_own_invoice(
    db: Session, user: User, invoice_id: int, *, method: PaymentMethod, amount: Decimal, payment_date: date
) -> Payment:
    document = get_own_invoice(db, user, invoice_id)  # the scoping check itself

    settings = resolver.get_company_settings(db)
    journal_id = settings.bank_journal_id if method == PaymentMethod.BANK else settings.cash_journal_id
    if journal_id is None:
        raise PostingError(f"No default {method.value.lower()} journal is configured.", code="MISSING_CONFIG")

    payment_data = {
        "payment_type": PaymentType.RECEIVE,
        "method": method,
        "partner_id": user.contact_id,
        "journal_id": journal_id,
        "payment_date": payment_date,
        "amount": amount,
        "note": None,
        "allocations": [{"document_id": document.id, "amount_allocated": amount}],
    }
    return payment_service.create_and_post_payment(db, payment_data, created_by_user_id=user.id)
