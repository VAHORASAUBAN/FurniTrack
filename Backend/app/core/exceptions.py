"""AppError hierarchy + exception handlers -> the one error envelope
(design doc §5.1). Every 4xx/5xx in the API uses this shape; routers never
hand-build an error dict, they just raise one of these.
"""
import uuid

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Base for every application-raised error. `code` is a stable machine
    string the frontend switches on — never localise or reword it per-request."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "BAD_REQUEST"

    def __init__(self, message: str, *, details: list[dict] | None = None, code: str | None = None):
        self.message = message
        self.details = details or []
        if code:
            self.code = code
        super().__init__(message)


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"


class ConflictError(AppError):
    """Uniqueness clashes, duplicate signup, etc. — 409, not 422: this is a
    business-state conflict, not a malformed request (§5.1's deliberate split)."""
    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "FORBIDDEN"


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "UNAUTHORIZED"


class PostingError(AppError):
    """Raised by the accounting engine (§3.4 validators). Always 409 — a
    business-rule refusal, distinct from Pydantic's 422 shape errors."""
    status_code = status.HTTP_409_CONFLICT
    code = "POSTING_ERROR"


def _envelope(code: str, message: str, details: list[dict] | None = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or [],
            "request_id": uuid.uuid4().hex[:12],
        }
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        details = [
            {"field": ".".join(str(p) for p in err["loc"] if p != "body"), "message": err["msg"]}
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_envelope("VALIDATION_ERROR", "Request body failed validation.", details),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        # Covers require_roles()'s plain HTTPException(403, ...) and FastAPI's
        # own 404s for unmatched routes — same envelope either way.
        code = {401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND"}.get(exc.status_code, "HTTP_ERROR")
        message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return JSONResponse(status_code=exc.status_code, content=_envelope(code, message))

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception):
        # Never leak a stack trace to the client; it's still visible in
        # server logs via the default logging FastAPI/uvicorn already does.
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope("INTERNAL_ERROR", "An unexpected error occurred."),
        )
