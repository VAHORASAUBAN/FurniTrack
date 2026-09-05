"""Every enum used by a MySQL ENUM column or in engine/service logic.

One module so the accounting engine, schemas and models all import the same
symbol — no risk of a route checking `"Posted"` while the model stores
`"POSTED"`. Values match the design doc's DDL ENUM(...) lists verbatim.
"""
import enum


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    ACCOUNTANT = "ACCOUNTANT"
    PORTAL = "PORTAL"


class ContactType(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    VENDOR = "VENDOR"
    BOTH = "BOTH"


class ProductType(str, enum.Enum):
    GOODS = "GOODS"
    SERVICE = "SERVICE"
    COMBO = "COMBO"


class AccountType(str, enum.Enum):
    ASSET = "ASSET"
    BANK = "BANK"
    CASH = "CASH"
    LIABILITY = "LIABILITY"
    CAPITAL = "CAPITAL"
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    OTHER_EXPENSE = "OTHER_EXPENSE"


# Design doc §2.3 — report section + normal balance are DERIVED from
# account_type, never stored. These two lookups are the single source of
# truth for that derivation; the accounting engine and report layer both
# import them instead of re-encoding the mapping.
BALANCE_SHEET_TYPES = {AccountType.ASSET, AccountType.BANK, AccountType.CASH, AccountType.LIABILITY, AccountType.CAPITAL}
PROFIT_LOSS_TYPES = {AccountType.INCOME, AccountType.EXPENSE, AccountType.OTHER_EXPENSE}
DEBIT_NORMAL_TYPES = {AccountType.ASSET, AccountType.BANK, AccountType.CASH, AccountType.EXPENSE, AccountType.OTHER_EXPENSE}
CREDIT_NORMAL_TYPES = {AccountType.LIABILITY, AccountType.CAPITAL, AccountType.INCOME}


class JournalType(str, enum.Enum):
    SALES = "SALES"
    PURCHASE = "PURCHASE"
    BANK = "BANK"
    CASH = "CASH"
    MISC = "MISC"


class DocType(str, enum.Enum):
    PURCHASE_ORDER = "PURCHASE_ORDER"
    VENDOR_BILL = "VENDOR_BILL"
    SALES_ORDER = "SALES_ORDER"
    CUSTOMER_INVOICE = "CUSTOMER_INVOICE"


class DocStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    POSTED = "POSTED"
    CANCELLED = "CANCELLED"


class JournalEntryStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    POSTED = "POSTED"
    CANCELLED = "CANCELLED"


class JournalEntrySourceType(str, enum.Enum):
    MANUAL = "MANUAL"
    VENDOR_BILL = "VENDOR_BILL"
    CUSTOMER_INVOICE = "CUSTOMER_INVOICE"
    PAYMENT = "PAYMENT"


class PaymentType(str, enum.Enum):
    RECEIVE = "RECEIVE"
    SEND = "SEND"


class PaymentMethod(str, enum.Enum):
    BANK = "BANK"
    CASH = "CASH"


class PaymentStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    POSTED = "POSTED"
    CANCELLED = "CANCELLED"


class AnalyticType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"


class BudgetStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    REVISED = "REVISED"
    CANCELLED = "CANCELLED"


class PaymentAllocationStatus(str, enum.Enum):
    """Derived (never stored) — design doc §2.4 / §3.3 `v_document_balance`."""
    DRAFT = "DRAFT"
    CANCELLED = "CANCELLED"
    UNPAID = "UNPAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"


def sa_enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    """`values_callable` helper: store the .value strings, not member names."""
    return [member.value for member in enum_cls]
