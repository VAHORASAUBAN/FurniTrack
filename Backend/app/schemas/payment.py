"""Payment schemas — design doc §2.7, §5.6. A payment always posts
immediately on creation (no draft stage) — the wireframe's Pay dialog is a
single Confirm action, unlike documents and manual journal entries which
have an explicit Draft step.
"""
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PaymentMethod, PaymentStatus, PaymentType
from app.schemas.common import Money


class PaymentAllocationIn(BaseModel):
    document_id: int
    amount_allocated: Money


class PaymentCreate(BaseModel):
    payment_type: PaymentType
    method: PaymentMethod = PaymentMethod.BANK
    partner_id: int
    journal_id: int
    payment_date: date
    amount: Money
    note: str | None = Field(default=None, max_length=255)
    allocations: list[PaymentAllocationIn] = Field(min_length=1)


class PaymentAllocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    amount_allocated: Money


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    payment_number: str
    payment_type: PaymentType
    method: PaymentMethod
    partner_id: int
    journal_id: int
    payment_date: date
    amount: Money
    note: str | None
    status: PaymentStatus
    created_at: datetime
    allocations: list[PaymentAllocationOut]


class DocumentOutstandingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_amount: Money
    amount_paid: Money
    amount_due: Money
    payment_status: str
