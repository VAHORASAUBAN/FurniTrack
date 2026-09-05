"""Import every model module so all classes register on `Base.metadata`
before Alembic autogenerate or `configure_mappers()` runs. Cross-module
`relationship()` string references (e.g. Mapped["Contact"]) only resolve if
the referenced class has been imported somewhere by then — this module is
that "somewhere". Also the single import point: `from app.models import User`.
"""
from app.db.base import Base
from app.models.account import ChartOfAccount
from app.models.budget import AnalyticAccount, Budget, BudgetLine
from app.models.contact import Contact
from app.models.document import Document, DocumentLine
from app.models.journal import Journal
from app.models.journal_entry import JournalEntry, JournalEntryLine
from app.models.payment import Payment, PaymentAllocation
from app.models.product import Product, ProductCategory
from app.models.sequence import CompanySetting, DocSequence
from app.models.user import RefreshToken, User

__all__ = [
    "Base",
    "ChartOfAccount",
    "AnalyticAccount",
    "Budget",
    "BudgetLine",
    "Contact",
    "Document",
    "DocumentLine",
    "Journal",
    "JournalEntry",
    "JournalEntryLine",
    "Payment",
    "PaymentAllocation",
    "Product",
    "ProductCategory",
    "CompanySetting",
    "DocSequence",
    "RefreshToken",
    "User",
]
