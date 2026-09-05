"""Analytic Account schemas — design doc §3 item 6."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AnalyticType


class AnalyticAccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    analytic_type: AnalyticType


class AnalyticAccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    analytic_type: AnalyticType | None = None


class AnalyticAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    analytic_type: AnalyticType
    is_active: bool
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
