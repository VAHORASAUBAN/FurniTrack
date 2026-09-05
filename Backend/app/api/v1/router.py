"""Single aggregator for every v1 module router (design doc §6). Routers are
added here as each module is built — main.py only ever imports this one
object, never individual module routers."""
from fastapi import APIRouter

api_router = APIRouter()

# Populated incrementally as each module is built:
# from app.api.v1 import auth, contacts
# from app.api.v1 import products, accounts, journals, analytics
# from app.api.v1 import journal_entries, purchase, sales, payments
# from app.api.v1 import budgets, reports, dashboard, portal
