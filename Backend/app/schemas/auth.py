"""Auth request/response shapes — design doc §5.2, §9.3.

login_id: 6-12 chars per the wireframe's stated credential rule.
password: minimum 8 chars (§9.3 — the wireframe's 6-12 rule is for login_id,
not password).
"""
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.models.enums import UserRole


class SignupRequest(BaseModel):
    """The wireframe's Sign Up page collects exactly these four fields —
    no Name — so `name` isn't part of this shape at all; auth_service
    defaults it from `login_id` since the User row itself still requires one."""

    login_id: str = Field(min_length=6, max_length=12)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    password_confirm: str

    @model_validator(mode="after")
    def _passwords_match(self):
        if self.password != self.password_confirm:
            raise ValueError("Passwords do not match.")
        return self


class LoginRequest(BaseModel):
    login_id: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)
    new_password_confirm: str

    @model_validator(mode="after")
    def _passwords_match(self):
        if self.new_password != self.new_password_confirm:
            raise ValueError("Passwords do not match.")
        return self


class ChangePasswordRequest(BaseModel):
    """For an already-authenticated user (current_password required) — as
    opposed to ResetPasswordRequest's token flow for a user who can't log in
    at all. Covers both a voluntary change and clearing a portal user's
    forced must_change_password flag after their one-time password."""

    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
    new_password_confirm: str

    @model_validator(mode="after")
    def _passwords_match(self):
        if self.new_password != self.new_password_confirm:
            raise ValueError("Passwords do not match.")
        return self


class MessageOut(BaseModel):
    message: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    login_id: str
    email: str
    name: str
    role: UserRole
    contact_id: int | None
    is_active: bool
    must_change_password: bool


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class AccessTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
