"""Chart of Accounts schemas — design doc §2.3, §2.4."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AccountType


class AccountCreate(BaseModel):
    code: str = Field(min_length=1, max_length=16)
    name: str = Field(min_length=1, max_length=128)
    account_type: AccountType
    is_receivable: bool = False
    is_payable: bool = False


class AccountUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=16)
    name: str | None = Field(default=None, min_length=1, max_length=128)
    account_type: AccountType | None = None
    is_receivable: bool | None = None
    is_payable: bool | None = None


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    account_type: AccountType
    is_receivable: bool
    is_payable: bool
    is_active: bool
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
