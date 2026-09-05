"""Admin user-management schemas — the wireframe's "Create User" screen.

Distinct from `schemas.auth.SignupRequest` (self-registration, always
ACCOUNTANT, no Role picker): this is what an Admin uses to create a user of
ANY role, including PORTAL. The wireframe's Role field explanation maps
"User" to exactly what this codebase calls PORTAL — "can only see his
invoices/bills... and pay from portal" — so a PORTAL user created here must
be linked to the Contact that scoping is keyed on (design doc §9.2);
that Contact picker isn't in the original wireframe, but a Portal login
with no linked Contact could never see anything, so it's required whenever
Role = Portal.
"""
from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.enums import UserRole


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    login_id: str = Field(min_length=6, max_length=12)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    password_confirm: str
    role: UserRole
    contact_id: int | None = None

    @model_validator(mode="after")
    def _validate(self):
        if self.password != self.password_confirm:
            raise ValueError("Passwords do not match.")
        if self.role == UserRole.PORTAL and self.contact_id is None:
            raise ValueError("Select the Contact this portal user belongs to.")
        if self.role != UserRole.PORTAL and self.contact_id is not None:
            raise ValueError("Only a Portal user may be linked to a Contact.")
        return self
