"""Shared schema building blocks — design doc §5.1.

`Money`: every monetary field in every response schema uses this instead of
`Decimal` directly, so it serialises to JSON as the STRING "6000.00" rather
than a bare number. Decimal encoded as a JSON number round-trips through
JS as a float and can silently lose precision; forcing a string closes that
off at the one place it matters (the API boundary) rather than trusting
every caller to remember.
"""
from decimal import Decimal
from typing import Annotated, Generic, TypeVar

from pydantic import BaseModel, PlainSerializer

def _format_money(v: Decimal) -> str:
    # Always exactly 2 decimals, regardless of the Decimal's internal scale —
    # str(Decimal) alone would print "0" for an un-quantized client-side
    # default (e.g. a Pydantic field default of `0` before it ever round-trips
    # through the DB's DECIMAL(15,2) column), which is inconsistent with every
    # value that DID round-trip. f"{v:.2f}" normalises both cases the same way.
    return f"{v:.2f}"


Money = Annotated[Decimal, PlainSerializer(_format_money, return_type=str, when_used="json")]

ItemT = TypeVar("ItemT")


class Page(BaseModel, Generic[ItemT]):
    items: list[ItemT]
    page: int
    page_size: int
    total: int
    total_pages: int


class ErrorDetail(BaseModel):
    field: str | None = None
    message: str | None = None


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[dict] = []
    request_id: str


class ErrorEnvelope(BaseModel):
    """Documents the error shape for OpenAPI; the actual response is built
    by app.core.exceptions._envelope() since FastAPI exception handlers
    bypass response_model."""
    error: ErrorBody
