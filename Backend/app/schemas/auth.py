"""Auth request/response shapes — design doc §5.2, §9.3.

login_id: 6-12 chars per the wireframe's stated credential rule.
password: minimum 8 chars (§9.3 — the wireframe's 6-12 rule is for login_id,
not password).
"""
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class SignupRequest(BaseModel):
    login_id: str = Field(min_length=6, max_length=12)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=128)


class LoginRequest(BaseModel):
    login_id: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    login_id: str
    email: str
    name: str
    role: UserRole
    contact_id: int | None
    is_active: bool


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class AccessTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
