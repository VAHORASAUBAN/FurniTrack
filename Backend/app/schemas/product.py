"""Product + ProductCategory schemas — design doc §3 item 2, §5.3."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ProductType
from app.schemas.common import Money


class ProductCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class ProductCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    is_active: bool


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    product_type: ProductType
    category_id: int | None = None
    sales_price: Money = Decimal("0")
    purchase_cost: Money = Decimal("0")
    default_tax_rate: Money = Decimal("0")
    income_account_id: int | None = None
    expense_account_id: int | None = None


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    product_type: ProductType | None = None
    category_id: int | None = None
    sales_price: Money | None = None
    purchase_cost: Money | None = None
    default_tax_rate: Money | None = None
    income_account_id: int | None = None
    expense_account_id: int | None = None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    product_type: ProductType
    category_id: int | None
    category: ProductCategoryOut | None
    sales_price: Money
    purchase_cost: Money
    default_tax_rate: Money
    income_account_id: int | None
    expense_account_id: int | None
    is_active: bool
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
