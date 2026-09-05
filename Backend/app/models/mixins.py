"""Shared column groups.

Design doc §2.9: archive strategy is `is_active` + `archived_at`, never a
hard delete and never a `deleted_at` global-filter pattern (rejected there —
an implicit filter is invisible at the call site).
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ArchiveMixin:
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
