"""Reports router — design doc §5.8. Balance Sheet and P&L are computed
live on every request (design doc §4.4) — the data is small enough at
hackathon scale that materialising a snapshot would only add invalidation
bugs for no real speed gain."""
from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.accounting.resolver import get_company_settings
from app.core.deps import DbSession, require_roles
from app.models.enums import UserRole
from app.reports import balance_sheet, budget_report, profit_loss
from app.schemas.report import BalanceSheetOut, BudgetDrillDownItem, ProfitLossOut
from app.services import pdf_service

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.ACCOUNTANT))],
)


@router.get("/balance-sheet", response_model=BalanceSheetOut)
def get_balance_sheet(db: DbSession, as_of: date = Query(default_factory=date.today)):
    return balance_sheet.build_balance_sheet(db, as_of)


@router.get("/balance-sheet/pdf")
def get_balance_sheet_pdf(db: DbSession, as_of: date = Query(default_factory=date.today)):
    bs = balance_sheet.build_balance_sheet(db, as_of)
    company_name = get_company_settings(db).company_name
    pdf_bytes = pdf_service.build_balance_sheet_pdf(bs, company_name)
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="balance-sheet-{as_of}.pdf"'},
    )


@router.get("/profit-loss", response_model=ProfitLossOut)
def get_profit_loss(db: DbSession, date_from: date = Query(...), date_to: date = Query(...)):
    return profit_loss.build_profit_loss(db, date_from, date_to)


@router.get("/profit-loss/pdf")
def get_profit_loss_pdf(db: DbSession, date_from: date = Query(...), date_to: date = Query(...)):
    pl = profit_loss.build_profit_loss(db, date_from, date_to)
    company_name = get_company_settings(db).company_name
    pdf_bytes = pdf_service.build_profit_loss_pdf(pl, company_name)
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="profit-loss-{date_from}-to-{date_to}.pdf"'},
    )


@router.get("/budget/drill-down", response_model=list[BudgetDrillDownItem])
def get_budget_drill_down(
    db: DbSession,
    analytic_id: int = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
):
    return budget_report.build_drill_down(db, analytic_id, date_from, date_to)
