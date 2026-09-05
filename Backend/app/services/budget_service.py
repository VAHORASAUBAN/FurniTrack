"""Budget service — design doc §3 item 7, §5.7."""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError
from app.models import Budget, BudgetLine
from app.models.enums import BudgetStatus
from app.reports.budget_report import compute_achieved_by_analytic
from app.services import notification_service


def _build_lines(line_inputs: list[dict]) -> list[BudgetLine]:
    return [
        BudgetLine(
            analytic_account_id=li["analytic_account_id"],
            analytic_type=li["analytic_type"],
            planned_amount=li["planned_amount"],
        )
        for li in line_inputs
    ]


def create_draft(db: Session, data: dict) -> Budget:
    lines = data.pop("lines")
    budget = Budget(
        name=data["name"],
        start_date=data["start_date"],
        end_date=data["end_date"],
        responsible_contact_id=data.get("responsible_contact_id"),
        status=BudgetStatus.DRAFT,
    )
    budget.lines = _build_lines(lines)
    db.add(budget)
    db.flush()
    return budget


def update_draft(db: Session, budget: Budget, data: dict) -> Budget:
    if budget.status != BudgetStatus.DRAFT:
        raise ConflictError("Only a draft budget can be edited.", code="NOT_DRAFT")

    lines = data.pop("lines", None)
    for key, value in data.items():
        setattr(budget, key, value)

    if lines is not None:
        budget.lines.clear()
        db.flush()
        budget.lines = _build_lines(lines)
    db.flush()
    return budget


def confirm_budget(db: Session, budget: Budget) -> Budget:
    if budget.status != BudgetStatus.DRAFT:
        raise ConflictError("Only a draft budget can be confirmed.", code="NOT_DRAFT")
    budget.status = BudgetStatus.CONFIRMED
    db.flush()
    notification_service.notify(db, f"Budget \"{budget.name}\" was confirmed.", link=f"/budgets/{budget.id}")
    return budget


def cancel_budget(db: Session, budget: Budget) -> Budget:
    if budget.status == BudgetStatus.CANCELLED:
        raise ConflictError("This budget is already cancelled.", code="ALREADY_CANCELLED")
    budget.status = BudgetStatus.CANCELLED
    db.flush()
    return budget


def revise_budget(db: Session, budget: Budget) -> Budget:
    """Design doc §5.7: copies the budget as a new DRAFT (name + " Revised",
    same period and lines as a starting point to edit from), points the copy
    back at the original via revises_budget_id, and flips the original to
    REVISED so it reads as superseded rather than just quietly abandoned."""
    if budget.status != BudgetStatus.CONFIRMED:
        raise ConflictError("Only a confirmed budget can be revised.", code="NOT_CONFIRMED")

    revised = Budget(
        name=f"{budget.name} Revised",
        start_date=budget.start_date,
        end_date=budget.end_date,
        responsible_contact_id=budget.responsible_contact_id,
        status=BudgetStatus.DRAFT,
        revises_budget_id=budget.id,
    )
    revised.lines = [
        BudgetLine(
            analytic_account_id=line.analytic_account_id,
            analytic_type=line.analytic_type,
            planned_amount=line.planned_amount,
        )
        for line in budget.lines
    ]
    db.add(revised)
    budget.status = BudgetStatus.REVISED
    db.flush()
    return revised


def attach_achieved(db: Session, budget: Budget) -> Budget:
    """Stamps achieved_amount/achieved_pct/remaining onto each (transient,
    non-mapped) BudgetLine — computed fresh from posted journal lines every
    time, never stored (design doc §4.3)."""
    achieved_by_analytic = compute_achieved_by_analytic(db, budget.id)
    for line in budget.lines:
        stats = achieved_by_analytic.get(
            line.analytic_account_id, {"achieved_amount": Decimal("0"), "achieved_pct": Decimal("0"), "remaining": line.planned_amount}
        )
        line.achieved_amount = stats["achieved_amount"]
        line.achieved_pct = stats["achieved_pct"]
        line.remaining = stats["remaining"]
        line.analytic_name = line.analytic_account.name
    return budget
