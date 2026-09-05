"""Portal schemas — design doc §5.9. A portal user supplies only method,
amount and date; partner_id, payment_type and journal_id are all resolved
server-side in `portal_service.pay_own_invoice`, never taken from the
request — the same "server is authoritative" rule as everywhere else,
applied here specifically so a portal user can't pay as someone else's
contact or through an arbitrary journal.
"""
from datetime import date

from pydantic import BaseModel

from app.models.enums import PaymentMethod
from app.schemas.common import Money


class PortalPaymentIn(BaseModel):
    method: PaymentMethod
    amount: Money
    payment_date: date
