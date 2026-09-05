"""Product master — design doc §3 Master Data Modules, item 2.

ProductCategory supports "create on the fly" from the product form (a
Many2One that can create a new row inline) — wireframe note under Category.
"""
from sqlalchemy import Enum, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.types import Money, Rate, UBigInt
from app.models.enums import ProductType, sa_enum_values
from app.models.mixins import ArchiveMixin, TimestampMixin


class ProductCategory(Base, TimestampMixin, ArchiveMixin):
    __tablename__ = "product_category"

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)


class Product(Base, TimestampMixin, ArchiveMixin):
    __tablename__ = "product"
    __table_args__ = (
        Index("ix_product_active_name", "is_active", "name"),
    )

    id: Mapped[int] = mapped_column(UBigInt, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    product_type: Mapped[ProductType] = mapped_column(
        Enum(ProductType, name="product_type", values_callable=sa_enum_values), nullable=False
    )
    category_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("product_category.id"), nullable=True)
    sales_price: Mapped[object] = mapped_column(Money, nullable=False, default=0)
    purchase_cost: Mapped[object] = mapped_column(Money, nullable=False, default=0)
    default_tax_rate: Mapped[object] = mapped_column(Rate, nullable=False, default=0)
    # §3.1 account resolution chain, step 2 — "sales/purchase account set by default".
    income_account_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("chart_of_account.id"), nullable=True)
    expense_account_id: Mapped[int | None] = mapped_column(UBigInt, ForeignKey("chart_of_account.id"), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    category: Mapped["ProductCategory | None"] = relationship()
    income_account: Mapped["ChartOfAccount | None"] = relationship(foreign_keys=[income_account_id])
    expense_account: Mapped["ChartOfAccount | None"] = relationship(foreign_keys=[expense_account_id])
