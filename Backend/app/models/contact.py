"""Contact master — design doc §3 Master Data Modules, item 1."""
from sqlalchemy import Enum, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UBigInt
from app.models.enums import ContactType, sa_enum_values
from app.models.mixins import ArchiveMixin, TimestampMixin


class Contact(Base, TimestampMixin, ArchiveMixin):
    __tablename__ = "contact"
    __table_args__ = (
        Index("ix_contact_active_name", "is_active", "name"),
    )

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    contact_type: Mapped[ContactType] = mapped_column(
        Enum(ContactType, name="contact_type", values_callable=sa_enum_values), nullable=False
    )
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    mobile: Mapped[str | None] = mapped_column(String(20), nullable=True)
    street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True, default="India")
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # One contact -> at most one portal login (the other direction of User.contact_id).
    portal_user: Mapped["User | None"] = relationship(
        back_populates="contact", foreign_keys="User.contact_id", uselist=False
    )
