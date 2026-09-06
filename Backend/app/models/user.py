"""User + RefreshToken.

Design doc §9.3: refresh tokens use rotation with reuse detection — each
token belongs to a `family_id`; if a token already marked `is_used` is
presented again, the whole family is revoked (a replay means it leaked).
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UBigInt
from app.models.enums import UserRole, sa_enum_values
from app.models.mixins import TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    login_id: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=sa_enum_values), nullable=False
    )
    # NULL unless role == PORTAL. Portal users are auto-provisioned from a
    # Contact (design doc §5.3 `create_portal_user`), never the reverse.
    contact_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("contact.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    # Set on system-generated one-time passwords (portal auto-provision —
    # see contact_service._generate_temp_password); cleared by change_password.
    must_change_password: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")

    contact: Mapped["Contact | None"] = relationship(back_populates="portal_user", foreign_keys=[contact_id])
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class RefreshToken(Base):
    __tablename__ = "refresh_token"

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(UBigInt, ForeignKey("user.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    family_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    is_used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    is_revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class PasswordResetToken(Base):
    """Opaque, SHA-256-hashed reset tokens — same at-rest pattern as
    RefreshToken (design doc §9.3). One-time use: `used_at` is stamped on
    a successful reset so a captured link can't be replayed."""

    __tablename__ = "password_reset_token"

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(UBigInt, ForeignKey("user.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
