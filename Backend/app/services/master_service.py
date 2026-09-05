"""Generic CRUD + archive/unarchive shared by every master-data module
(design doc §5.3: "Contacts, products, accounts, journals and analytic
accounts share one CRUD shape. Written once for contacts; the others differ
only in payload."). Module-specific services (e.g. contact_service.py) wrap
these for the one or two operations that need extra behaviour (portal
provisioning, "at most one is_receivable account", etc.) — everything else
calls straight through.
"""
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.core.pagination import PageParams, apply_sort, paginate


def list_records(
    db: Session,
    model: type,
    params: PageParams,
    *,
    search_fields: list[str] = (),
    sort_fields: set[str] = frozenset(),
    default_sort: str = "id",
) -> tuple[list, int]:
    query = db.query(model)
    if not params.include_archived and hasattr(model, "is_active"):
        query = query.filter(model.is_active.is_(True))
    if params.search and search_fields:
        like = f"%{params.search}%"
        query = query.filter(or_(*(getattr(model, f).ilike(like) for f in search_fields)))
    query = apply_sort(query, params.sort, model, sort_fields | {default_sort}, default_sort)
    return paginate(query, params)


def get_record(db: Session, model: type, record_id: int, *, not_found_message: str):
    obj = db.get(model, record_id)
    if obj is None:
        raise NotFoundError(not_found_message, code="NOT_FOUND")
    return obj


def create_record(db: Session, model: type, data: dict[str, Any]):
    obj = model(**data)
    db.add(obj)
    db.flush()
    return obj


def update_record(db: Session, obj, data: dict[str, Any]):
    """`data` should already be `payload.model_dump(exclude_unset=True)` —
    only fields actually present in the PATCH body get touched."""
    for key, value in data.items():
        setattr(obj, key, value)
    db.flush()
    return obj


def archive_record(db: Session, obj):
    obj.is_active = False
    obj.archived_at = datetime.now(timezone.utc)
    db.flush()
    return obj


def unarchive_record(db: Session, obj):
    obj.is_active = True
    obj.archived_at = None
    db.flush()
    return obj
