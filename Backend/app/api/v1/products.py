"""Product + ProductCategory routers — design doc §3 item 2, §5.3.
ProductCategory supports create-on-the-fly from the product form (the
wireframe's "Category can be created and saved on the fly (Many2one Field)")
— its POST endpoint has no extra ceremony for exactly that reason."""
import os
import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.core.config import settings
from app.core.deps import DbSession, require_roles
from app.core.exceptions import AppError
from app.core.pagination import PageParams, page_params, total_pages
from app.models import Product, ProductCategory
from app.models.enums import UserRole
from app.schemas.common import Page
from app.schemas.product import (
    ProductCategoryCreate,
    ProductCategoryOut,
    ProductCreate,
    ProductOut,
    ProductUpdate,
)
from app.services import master_service

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}

SEARCH_FIELDS = ["name"]
SORT_FIELDS = {"name", "product_type", "updated_at"}

router = APIRouter(
    prefix="/products",
    tags=["products"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)

category_router = APIRouter(
    prefix="/product-categories",
    tags=["products"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)


@router.get("", response_model=Page[ProductOut])
def list_products(db: DbSession, params: PageParams = Depends(page_params)):
    items, total = master_service.list_records(
        db, Product, params, search_fields=SEARCH_FIELDS, sort_fields=SORT_FIELDS, default_sort="-updated_at"
    )
    return Page(items=items, page=params.page, page_size=params.page_size,
                total=total, total_pages=total_pages(total, params.page_size))


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: DbSession):
    return master_service.create_record(db, Product, payload.model_dump())


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: DbSession):
    return master_service.get_record(db, Product, product_id, not_found_message="Product not found.")


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductUpdate, db: DbSession):
    product = master_service.get_record(db, Product, product_id, not_found_message="Product not found.")
    return master_service.update_record(db, product, payload.model_dump(exclude_unset=True))


@router.post("/{product_id}/archive", response_model=ProductOut, dependencies=[Depends(require_roles(UserRole.ADMIN))])
def archive_product(product_id: int, db: DbSession):
    product = master_service.get_record(db, Product, product_id, not_found_message="Product not found.")
    return master_service.archive_record(db, product)


@router.post("/{product_id}/unarchive", response_model=ProductOut, dependencies=[Depends(require_roles(UserRole.ADMIN))])
def unarchive_product(product_id: int, db: DbSession):
    product = master_service.get_record(db, Product, product_id, not_found_message="Product not found.")
    return master_service.unarchive_record(db, product)


@router.post("/{product_id}/image")
async def upload_product_image(product_id: int, db: DbSession, file: UploadFile = File(...)):
    product = master_service.get_record(db, Product, product_id, not_found_message="Product not found.")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise AppError(
            f"Unsupported image type {file.content_type!r}. Allowed: jpeg, png, webp.",
            code="UNSUPPORTED_IMAGE_TYPE",
        )
    contents = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise AppError(f"Image exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit.", code="IMAGE_TOO_LARGE")

    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[file.content_type]
    filename = f"product_{product_id}_{uuid.uuid4().hex[:8]}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(contents)

    product.image_url = f"/static/{filename}"
    db.flush()
    return {"image_url": product.image_url}


@category_router.get("", response_model=Page[ProductCategoryOut])
def list_categories(db: DbSession, params: PageParams = Depends(page_params)):
    items, total = master_service.list_records(
        db, ProductCategory, params, search_fields=["name"], sort_fields={"name", "updated_at"}, default_sort="-updated_at"
    )
    return Page(items=items, page=params.page, page_size=params.page_size,
                total=total, total_pages=total_pages(total, params.page_size))


@category_router.post("", response_model=ProductCategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: ProductCategoryCreate, db: DbSession):
    return master_service.create_record(db, ProductCategory, payload.model_dump())
