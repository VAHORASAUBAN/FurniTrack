"""Auth router — design doc §5.2.

forgot-password / reset-password are deliberately NOT implemented yet: they
are explicit nice-to-have (build plan §10.2, item 4) and need either SMTP
config or a new reset-token table, neither of which exists yet. The five
endpoints here (signup/login/refresh/logout/me) are must-have — everything
else in the system depends on auth working first.
"""
from fastapi import APIRouter, status

from app.core.deps import CurrentUser, DbSession
from app.schemas.auth import (
    AccessTokenResponse,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    UserOut,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


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
