"""Single aggregator for every v1 module router (design doc §6). Routers are
added here as each module is built — main.py only ever imports this one
object, never individual module routers."""
from fastapi import APIRouter

from app.api.v1 import accounts, analytics, auth, contacts, journal_entries, journals, products

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(contacts.router)
api_router.include_router(accounts.router)
api_router.include_router(journals.router)
api_router.include_router(analytics.router)
api_router.include_router(products.router)
api_router.include_router(products.category_router)
api_router.include_router(journal_entries.router)

# Populated incrementally as each module is built:
# from app.api.v1 import purchase, sales, payments
# from app.api.v1 import budgets, reports, dashboard, portal
