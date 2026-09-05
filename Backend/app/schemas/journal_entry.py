"""Manual Journal Entry schemas — design doc §5.4.

Debit/credit arrive as `Money` (string on the wire, exact `Decimal` once
parsed) so the client can never accidentally send a float that silently
loses precision before it even reaches the engine's balance check.
"""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import JournalEntrySourceType, JournalEntryStatus
from app.schemas.common import Money


class JournalEntryLineIn(BaseModel):
    account_id: int
    partner_id: int | None = None
    analytic_account_id: int | None = None
    label: str | None = Field(default=None, max_length=255)
    debit: Money = Decimal("0")
    credit: Money = Decimal("0")

    @model_validator(mode="after")
    def _shape(self):
        # Client-side convenience only — the engine's own validators (rules
        # 2/3/4) are the actual gate; this just gives a 422 instead of a 409
        # for the most obvious malformed-input case.
        if self.debit < 0 or self.credit < 0:
            raise ValueError("debit and credit cannot be negative")
        return self


class JournalEntryCreate(BaseModel):
    journal_id: int
    entry_date: date
    reference: str | None = Field(default=None, max_length=128)
    narration: str | None = None
    lines: list[JournalEntryLineIn] = Field(min_length=1)


class JournalEntryUpdate(BaseModel):
    journal_id: int | None = None
    entry_date: date | None = None
    reference: str | None = Field(default=None, max_length=128)
    narration: str | None = None
    lines: list[JournalEntryLineIn] | None = Field(default=None, min_length=1)


class JournalEntryLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    line_no: int
    account_id: int
    partner_id: int | None
    analytic_account_id: int | None
    label: str | None
    debit: Money
    credit: Money


class JournalEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entry_number: str
    journal_id: int
    entry_date: date
    reference: str | None
    narration: str | None
    status: JournalEntryStatus
    source_type: JournalEntrySourceType
    source_document_id: int | None
    source_payment_id: int | None
    total_debit: Money
    total_credit: Money
    posted_at: datetime | None
    posted_by: int | None
    lines: list[JournalEntryLineOut]
