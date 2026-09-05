"""One-shot seed: Chart of Accounts, Journals, Company Settings, doc sequences,
and one Admin user. Run via `python -m app.db.seed`.

Idempotent — safe to run more than once; existing rows are left alone
(matched by their natural unique key: code / login_id).

Account/journal set matches the wireframe examples verbatim (design doc §2,
§3 worked example): Cash, Bank, Debtors, Creditors, Capital A/c, Sales
Income, Purchase Expense, plus Input/Output Tax accounts needed by the
engine's tax posting rule (§3.2) and one Other Expense account so the P&L's
three-section layout has something to show in every section.
"""
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import ChartOfAccount, CompanySetting, DocSequence, Journal, User
from app.models.enums import AccountType, JournalType, UserRole

ACCOUNTS = [
    # code,   name,               type,                is_receivable, is_payable
    ("1000", "Cash",              AccountType.CASH,      False, False),
    ("1010", "Bank",              AccountType.BANK,      False, False),
    ("1100", "Debtors",           AccountType.ASSET,     True,  False),
    ("1900", "Input Tax Receivable", AccountType.ASSET,  False, False),
    ("2100", "Creditors",         AccountType.LIABILITY, False, True),
    ("2900", "Output Tax Payable", AccountType.LIABILITY, False, False),
    ("3000", "Capital A/c",       AccountType.CAPITAL,   False, False),
    ("4000", "Sales Income",      AccountType.INCOME,    False, False),
    ("5000", "Purchase Expense",  AccountType.EXPENSE,   False, False),
    ("5900", "Other Expense",     AccountType.OTHER_EXPENSE, False, False),
]

JOURNALS = [
    # code,      name,              type,                    default_account_code
    ("SALES",    "Sales Journal",    JournalType.SALES,    "4000"),
    ("PURCHASE", "Purchase Journal", JournalType.PURCHASE, "5000"),
    ("BANK",     "Bank Journal",     JournalType.BANK,     "1010"),
    ("CASH",     "Cash Journal",     JournalType.CASH,     "1000"),
]

# code,               prefix,  padding   (fiscal_year=0 => not year-partitioned)
SEQUENCES_NO_YEAR = [
    ("PURCHASE_ORDER", "P",   5),
    ("SALES_ORDER",    "S",   5),
]
# these DO get a fiscal-year segment allocated per year at posting time;
# the seed just needs one row to exist for the current cycle's bootstrap.
SEQUENCES_YEARED = [
    ("VENDOR_BILL",       "Bill", 4),
    ("CUSTOMER_INVOICE",  "INV",  4),
    ("PAYMENT_RECEIVE",   "PAY",  4),
    ("PAYMENT_SEND",      "PAY",  4),
    ("JOURNAL_ENTRY",     "JE",   4),
]

ADMIN_LOGIN_ID = "admin"
ADMIN_EMAIL = "admin@urbanfurniture.local"
ADMIN_PASSWORD = "Admin@12345"  # dev-only default; change after first login


def seed() -> None:
    db = SessionLocal()
    try:
        accounts_by_code: dict[str, ChartOfAccount] = {}
        for code, name, acc_type, is_receivable, is_payable in ACCOUNTS:
            existing = db.query(ChartOfAccount).filter_by(code=code).one_or_none()
            if existing is None:
                existing = ChartOfAccount(
                    code=code, name=name, account_type=acc_type,
                    is_receivable=is_receivable, is_payable=is_payable,
                )
                db.add(existing)
                db.flush()
                print(f"  + account {code} {name}")
            accounts_by_code[code] = existing

        journals_by_code: dict[str, Journal] = {}
        for code, name, j_type, default_code in JOURNALS:
            existing = db.query(Journal).filter_by(code=code).one_or_none()
            if existing is None:
                existing = Journal(
                    code=code, name=name, journal_type=j_type,
                    default_account_id=accounts_by_code[default_code].id,
                )
                db.add(existing)
                db.flush()
                print(f"  + journal {code} {name}")
            journals_by_code[code] = existing

        for code, prefix, padding in SEQUENCES_NO_YEAR:
            existing = db.query(DocSequence).filter_by(code=code, fiscal_year=0).one_or_none()
            if existing is None:
                db.add(DocSequence(code=code, prefix=prefix, fiscal_year=0, padding=padding, next_number=1))
                print(f"  + sequence {code} (no year)")

        from datetime import date
        current_year = date.today().year
        for code, prefix, padding in SEQUENCES_YEARED:
            existing = db.query(DocSequence).filter_by(code=code, fiscal_year=current_year).one_or_none()
            if existing is None:
                db.add(DocSequence(
                    code=code, prefix=prefix, fiscal_year=current_year, padding=padding, next_number=1
                ))
                print(f"  + sequence {code}/{current_year}")

        settings_row = db.query(CompanySetting).filter_by(id=1).one_or_none()
        if settings_row is None:
            settings_row = CompanySetting(
                id=1,
                company_name="Urban Furniture",
                books_lock_date=None,
                receivable_account_id=accounts_by_code["1100"].id,
                payable_account_id=accounts_by_code["2100"].id,
                output_tax_account_id=accounts_by_code["2900"].id,
                input_tax_account_id=accounts_by_code["1900"].id,
                sales_journal_id=journals_by_code["SALES"].id,
                purchase_journal_id=journals_by_code["PURCHASE"].id,
                bank_journal_id=journals_by_code["BANK"].id,
                cash_journal_id=journals_by_code["CASH"].id,
            )
            db.add(settings_row)
            print("  + company_setting (singleton)")

        admin = db.query(User).filter_by(login_id=ADMIN_LOGIN_ID).one_or_none()
        if admin is None:
            admin = User(
                login_id=ADMIN_LOGIN_ID,
                email=ADMIN_EMAIL,
                password_hash=hash_password(ADMIN_PASSWORD),
                name="Admin",
                role=UserRole.ADMIN,
                contact_id=None,
                is_active=True,
            )
            db.add(admin)
            print(f"  + admin user login_id={ADMIN_LOGIN_ID!r} password={ADMIN_PASSWORD!r} (CHANGE AFTER FIRST LOGIN)")

        db.commit()
        print("Seed complete.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
