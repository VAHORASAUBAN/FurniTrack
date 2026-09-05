"""Journal schemas — design doc §3 item 4."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import JournalType


class JournalCreate(BaseModel):
    code: str = Field(min_length=1, max_length=16)
    name: str = Field(min_length=1, max_length=128)
    journal_type: JournalType
    default_account_id: int | None = None


class JournalUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=16)
    name: str | None = Field(default=None, min_length=1, max_length=128)
    journal_type: JournalType | None = None
    default_account_id: int | None = None


class JournalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    journal_type: JournalType
    default_account_id: int | None
    is_active: bool
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
