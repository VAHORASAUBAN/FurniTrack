"""Document (PO / Vendor Bill / SO / Customer Invoice) schemas — design doc
§2.2, §5.5. One polymorphic shape shared by all four doc_types; the router
binds doc_type from the URL, never from the request body — the client can
never accidentally create a Sales Order by POSTing to /purchase/orders.

The client sends only quantity/unit_price/tax_rate per line (design doc
§7.4/§7.5: "the frontend never sends computed totals") — tax_amount,
subtotal, total and every header total are recomputed server-side in
document_service, never trusted from the request.
"""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import DocStatus, DocType, PaymentAllocationStatus
from app.schemas.common import Money, Qty


class DocumentLineIn(BaseModel):
    product_id: int | None = None
    account_id: int | None = None  # falls back to the product's default account if omitted (§3.1)
    analytic_account_id: int | None = None
    description: str | None = Field(default=None, max_length=255)
    quantity: Qty = Decimal("1")
    unit_price: Money = Decimal("0")
    tax_rate: Money = Decimal("0")


class DocumentCreate(BaseModel):
    partner_id: int
    doc_date: date
    due_date: date | None = None
    reference: str | None = Field(default=None, max_length=64)
    notes: str | None = None
    lines: list[DocumentLineIn] = Field(min_length=1)


class DocumentUpdate(BaseModel):
    partner_id: int | None = None
    doc_date: date | None = None
    due_date: date | None = None
    reference: str | None = Field(default=None, max_length=64)
    notes: str | None = None
    lines: list[DocumentLineIn] | None = Field(default=None, min_length=1)


class DocumentLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    line_no: int
    product_id: int | None
    account_id: int
    analytic_account_id: int | None
    description: str | None
    quantity: Qty
    unit_price: Money
    tax_rate: Money
    tax_amount: Money
    subtotal: Money
    total: Money


class DocumentBalance(BaseModel):
    amount_paid: Money
    paid_via_cash: Money
    paid_via_bank: Money
    amount_due: Money
    payment_status: PaymentAllocationStatus


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    doc_type: DocType
    doc_number: str
    partner_id: int
    journal_id: int | None
    source_document_id: int | None
    doc_date: date
    due_date: date | None
    reference: str | None
    status: DocStatus
    untaxed_amount: Money
    tax_amount: Money
    total_amount: Money
    notes: str | None
    created_at: datetime
    updated_at: datetime
    lines: list[DocumentLineOut]
    balance: DocumentBalance | None = None


class SendEmailRequest(BaseModel):
    """design doc §5.5 — the Bill/Invoice "Send" action. Defaults to the
    partner's own email on file when to_email is omitted."""

    to_email: EmailStr | None = None


class SendEmailResponse(BaseModel):
    message: str
