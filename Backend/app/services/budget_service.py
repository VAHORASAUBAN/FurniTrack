"""Budget service — design doc §3 item 7. Revise is deliberately not
implemented (schema-now/UI-later decision) — `status` only ever moves
DRAFT -> CONFIRMED -> CANCELLED here."""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError
from app.models import Budget, BudgetLine
from app.models.enums import BudgetStatus
from app.reports.budget_report import compute_achieved_by_analytic


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
    return budget


def cancel_budget(db: Session, budget: Budget) -> Budget:
    if budget.status == BudgetStatus.CANCELLED:
        raise ConflictError("This budget is already cancelled.", code="ALREADY_CANCELLED")
    budget.status = BudgetStatus.CANCELLED
    db.flush()
    return budget


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
