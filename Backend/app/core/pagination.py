"""List-view query params + the paginate() helper — design doc §5.1's
uniform list conventions (page, page_size, search, sort, include_archived).
"""
import math
from dataclasses import dataclass
from typing import Annotated

from fastapi import Query
from sqlalchemy import asc, desc
from sqlalchemy.orm import Query as ORMQuery


@dataclass
class PageParams:
    page: int = 1
    page_size: int = 25
    search: str | None = None
    sort: str | None = None
    include_archived: bool = False


def page_params(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    search: Annotated[str | None, Query()] = None,
    sort: Annotated[str | None, Query()] = None,
    include_archived: Annotated[bool, Query()] = False,
) -> PageParams:
    return PageParams(page=page, page_size=page_size, search=search, sort=sort, include_archived=include_archived)


def apply_sort(query: ORMQuery, sort: str | None, model, allowed_fields: set[str], default_field: str):
    """`sort` is `field` (asc) or `-field` (desc); silently falls back to
    `default_field` for anything not in `allowed_fields` — an unrecognised
    sort param should never 500 a list screen."""
    field_name = default_field
    direction = asc
    if sort:
        if sort.startswith("-"):
            direction = desc
            field_name = sort[1:]
        else:
            field_name = sort
        if field_name not in allowed_fields:
            field_name = default_field
            direction = asc
    return query.order_by(direction(getattr(model, field_name)))


def paginate(query: ORMQuery, params: PageParams) -> tuple[list, int]:
    total = query.count()
    items = query.offset((params.page - 1) * params.page_size).limit(params.page_size).all()
    return items, total


def total_pages(total: int, page_size: int) -> int:
    return max(1, math.ceil(total / page_size))
