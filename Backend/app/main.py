"""FastAPI app entrypoint. Design doc §6 backend structure: CORS, router
mounting, and exception-handler wiring live here and nowhere else."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers

app = FastAPI(
    title="Urban Furniture Accounting API",
    version="0.1.0",
    description="Double-entry accounting system — master data, purchase/sales, journal entries, reports.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.mount("/static", StaticFiles(directory=settings.UPLOAD_DIR), name="static")

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}
