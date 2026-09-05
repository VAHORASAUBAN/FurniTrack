"""Notification — a shared, global activity feed: any staff user (Admin or
Accountant) posting/confirming/paying/cancelling something writes one row
here, and every OTHER staff user sees it too, not just the one who acted.
There's no per-user read/unread column - "seen" is tracked client-side
(the last notification id a browser has looked at), since the feed itself
is genuinely shared rather than a private inbox per user.
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UBigInt


class Notification(Base):
    __tablename__ = "notification"

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("user.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    created_by: Mapped["User | None"] = relationship()
