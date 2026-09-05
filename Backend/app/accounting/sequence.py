"""Concurrency-safe sequence allocation — design doc §2.10.

`SELECT ... FOR UPDATE` inside the caller's own transaction is what makes
this safe: the row lock is held until that transaction commits or rolls
back, so a second concurrent allocator blocks at this SELECT rather than
reading the same `next_number` the first one just read. Rolling back after
a partial post releases the number, so the series stays gap-free.

Deliberately NOT `SELECT MAX(number) + 1` (design doc's rejected
alternative) — two concurrent readers would see the same max and collide.
"""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import PostingError
from app.models import DocSequence

# PO/SO numbers don't carry a year segment (P00001, not P00001/2026) — those
# rows are stored under the sentinel fiscal_year=0 (design doc §2.3 DocSequence).
_NO_YEAR_CODES = {"PURCHASE_ORDER", "SALES_ORDER"}


def next_number(db: Session, code: str) -> str:
    """Allocates and returns the next formatted document/entry number for
    `code` (e.g. 'VENDOR_BILL', 'JOURNAL_ENTRY', 'PAYMENT'). Must be called
    inside the same transaction that inserts the row using this number —
    see design doc §3.5 step 3."""
    fiscal_year = 0 if code in _NO_YEAR_CODES else date.today().year

    row = db.execute(
        select(DocSequence)
        .where(DocSequence.code == code, DocSequence.fiscal_year == fiscal_year)
        .with_for_update()
    ).scalar_one_or_none()

    if row is None:
        raise PostingError(
            f"No document sequence configured for {code!r}"
            + (f" in fiscal year {fiscal_year}." if fiscal_year else "."),
            code="MISSING_CONFIG",
        )

    allocated = row.next_number
    row.next_number = allocated + 1

    padded = str(allocated).zfill(row.padding)
    if fiscal_year == 0:
        return f"{row.prefix}{padded}"
    return f"{row.prefix}/{fiscal_year}/{padded}"
