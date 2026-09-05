"""Reports router — design doc §5.8. Balance Sheet and P&L are computed
live on every request (design doc §4.4) — the data is small enough at
hackathon scale that materialising a snapshot would only add invalidation
bugs for no real speed gain."""
from datetime import date

from fastapi import APIRouter, Depends, Query

from app.core.deps import DbSession, require_roles
from app.models.enums import UserRole
from app.reports import balance_sheet, profit_loss
from app.schemas.report import BalanceSheetOut, ProfitLossOut

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)


@router.get("/balance-sheet", response_model=BalanceSheetOut)
def get_balance_sheet(db: DbSession, as_of: date = Query(default_factory=date.today)):
    return balance_sheet.build_balance_sheet(db, as_of)


@router.get("/profit-loss", response_model=ProfitLossOut)
def get_profit_loss(db: DbSession, date_from: date = Query(...), date_to: date = Query(...)):
    return profit_loss.build_profit_loss(db, date_from, date_to)
