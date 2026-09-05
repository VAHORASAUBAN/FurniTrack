"""Journal master — design doc §3 Master Data Modules, item 4."""
from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import UBigInt
from app.models.enums import JournalType, sa_enum_values
from app.models.mixins import ArchiveMixin, TimestampMixin


class Journal(Base, TimestampMixin, ArchiveMixin):
    __tablename__ = "journal"

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(16), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    journal_type: Mapped[JournalType] = mapped_column(
        Enum(JournalType, name="journal_type", values_callable=sa_enum_values), nullable=False
    )
    default_account_id: Mapped[int | None] = mapped_column(
        UBigInt, ForeignKey("chart_of_account.id"), nullable=True
    )

    default_account: Mapped["ChartOfAccount | None"] = relationship()
