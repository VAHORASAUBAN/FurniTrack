"""Budget schemas — design doc §3 item 7, §4.3. Achieved/achieved_pct/
remaining are never stored — `budget_service.attach_achieved` stamps them
onto each line's response the same way `document_service.attach_balance`
stamps `balance` onto a Document, so they're always freshly computed.
"""
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AnalyticType, BudgetStatus
from app.schemas.common import Money


class BudgetLineIn(BaseModel):
    analytic_account_id: int
    analytic_type: AnalyticType
    planned_amount: Money


class BudgetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    start_date: date
    end_date: date
    responsible_contact_id: int | None = None
    lines: list[BudgetLineIn] = Field(min_length=1)


class BudgetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    start_date: date | None = None
    end_date: date | None = None
    responsible_contact_id: int | None = None
    lines: list[BudgetLineIn] | None = Field(default=None, min_length=1)


class BudgetLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    analytic_account_id: int
    analytic_name: str
    analytic_type: AnalyticType
    planned_amount: Money
    achieved_amount: Money
    achieved_pct: Money
    remaining: Money


class BudgetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    start_date: date
    end_date: date
    responsible_contact_id: int | None
    status: BudgetStatus
    revises_budget_id: int | None
    is_active: bool
    updated_at: datetime
    lines: list[BudgetLineOut]
