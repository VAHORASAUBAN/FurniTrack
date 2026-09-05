"""Chart of Accounts service — wraps master_service, adding the one
account-specific rule: at most one account may carry `is_receivable` /
`is_payable` (design doc §2.3). Note this flag is a UI/validation
convenience only — the accounting engine itself resolves Debtors/Creditors
via `company_setting.receivable_account_id`/`payable_account_id` (§3.1),
never by scanning for this flag, so it can never silently break posting.
"""
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError
from app.models import ChartOfAccount

SEARCH_FIELDS = ["code", "name"]
SORT_FIELDS = {"code", "name", "account_type"}


def _check_single_flag_holder(db: Session, *, exclude_id: int | None, is_receivable: bool | None, is_payable: bool | None):
    if is_receivable:
        q = db.query(ChartOfAccount).filter(ChartOfAccount.is_receivable.is_(True))
        if exclude_id is not None:
            q = q.filter(ChartOfAccount.id != exclude_id)
        clash = q.one_or_none()
        if clash:
            raise ConflictError(
                f"'{clash.name}' is already the receivable account; only one account may carry this flag.",
                code="RECEIVABLE_ALREADY_SET",
            )
    if is_payable:
        q = db.query(ChartOfAccount).filter(ChartOfAccount.is_payable.is_(True))
        if exclude_id is not None:
            q = q.filter(ChartOfAccount.id != exclude_id)
        clash = q.one_or_none()
        if clash:
            raise ConflictError(
                f"'{clash.name}' is already the payable account; only one account may carry this flag.",
                code="PAYABLE_ALREADY_SET",
            )


def create_account(db: Session, data: dict) -> ChartOfAccount:
    _check_single_flag_holder(db, exclude_id=None, is_receivable=data.get("is_receivable"), is_payable=data.get("is_payable"))
    account = ChartOfAccount(**data)
    db.add(account)
    db.flush()
    return account


def update_account(db: Session, account: ChartOfAccount, data: dict) -> ChartOfAccount:
    _check_single_flag_holder(
        db, exclude_id=account.id,
        is_receivable=data.get("is_receivable"),
        is_payable=data.get("is_payable"),
    )
    for key, value in data.items():
        setattr(account, key, value)
    db.flush()
    return account
