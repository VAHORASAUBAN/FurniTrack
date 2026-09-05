"""Contact master schemas — design doc §3 item 1, §5.3."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import ContactType


class ContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    contact_type: ContactType
    email: EmailStr | None = None
    mobile: str | None = Field(default=None, max_length=20)
    street: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default="India", max_length=100)
    pincode: str | None = Field(default=None, max_length=10)
    # Design doc §5.3 / brief: "Contact portal users are provisioned
    # automatically when a Contact master record is created."
    create_portal_user: bool = False


class ContactUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    contact_type: ContactType | None = None
    email: EmailStr | None = None
    mobile: str | None = Field(default=None, max_length=20)
    street: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    pincode: str | None = Field(default=None, max_length=10)


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    contact_type: ContactType
    email: str | None
    mobile: str | None
    street: str | None
    city: str | None
    state: str | None
    country: str | None
    pincode: str | None
    profile_image_url: str | None
    is_active: bool
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PortalCredentials(BaseModel):
    login_id: str
    temporary_password: str


class ContactCreateResponse(BaseModel):
    contact: ContactOut
    portal_credentials: PortalCredentials | None = None
