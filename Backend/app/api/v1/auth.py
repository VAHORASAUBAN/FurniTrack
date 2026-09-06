"""Auth router — design doc §5.2.

forgot-password / reset-password have no SMTP service to send an actual
email through, so in place of one the backend prints the reset link to its
own console — this user already runs the server from a terminal to read
logs, so that's where the "email" shows up. The HTTP response never reveals
whether the address was registered (no account enumeration) or leaks the
token; only the console line does.
"""
from fastapi import APIRouter, status

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.schemas.auth import (
    AccessTokenResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageOut,
    RefreshRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    UserOut,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

_GENERIC_FORGOT_PASSWORD_MESSAGE = "If that email is registered, password reset instructions have been sent."


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: DbSession):
    user = auth_service.signup(db, payload)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession):
    user, access_token, refresh_token = auth_service.login(db, payload)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, user=user)


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(payload: RefreshRequest, db: DbSession):
    access_token, new_refresh_token = auth_service.refresh(db, payload.refresh_token)
    return AccessTokenResponse(access_token=access_token, refresh_token=new_refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: LogoutRequest, db: DbSession):
    auth_service.logout(db, payload.refresh_token)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user


@router.post("/forgot-password", response_model=MessageOut, status_code=status.HTTP_202_ACCEPTED)
def forgot_password(payload: ForgotPasswordRequest, db: DbSession):
    raw_token = auth_service.forgot_password(db, payload.email)
    if raw_token is not None:
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
        print(f"\n{'=' * 72}\nPASSWORD RESET (no SMTP configured — this stands in for the email)\n"
              f"  To: {payload.email}\n  Link: {reset_link}\n"
              f"  Expires in {settings.RESET_TOKEN_EXPIRE_MINUTES} minutes.\n{'=' * 72}\n")
    return MessageOut(message=_GENERIC_FORGOT_PASSWORD_MESSAGE)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(payload: ResetPasswordRequest, db: DbSession):
    auth_service.reset_password(db, payload.token, payload.new_password)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: ChangePasswordRequest, db: DbSession, user: CurrentUser):
    auth_service.change_password(db, user, payload.current_password, payload.new_password)
