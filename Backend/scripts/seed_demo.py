"""Demo-data seeder for manual QA - drives the REAL running HTTP API (exactly
like the React app would), not the database directly, so every record it
creates has already passed RBAC, Pydantic validation and the accounting
engine's validators.

Builds one coherent scenario touching every module built so far:
  - Master data (contacts incl. one archived + one portal-linked customer,
    products incl. one archived, product categories, analytic accounts)
  - The full Purchase vertical in every status: paid, partially paid,
    unpaid, draft, cancelled
  - The full Sales vertical in every status: paid, partially paid, unpaid
    (left for you to pay from the Portal), draft
  - Manual journal entries: one posted opening-capital entry, one posted
    entry tagged with an analytic account, and - the one worth clicking
    yourself - one DRAFT entry that is deliberately unbalanced, left
    un-posted so you can hit Post in the UI and watch validator #1
    (UNBALANCED_ENTRY) block it live
  - Two budgets (one CONFIRMED with real achieved-amount tracking, one
    DRAFT for you to edit/confirm yourself)
  - An extra Accountant login and the auto-provisioned Portal login

Prerequisites: both servers running (`uvicorn` on :8000, `npm run dev` on
:5173 - this script only needs the backend) against a freshly reset DB
(`alembic downgrade base && alembic upgrade head && python -m app.db.seed`).

Run from Backend/, with the venv active:
    python -m scripts.seed_demo

Idempotency: aborts immediately if "Azure Furniture Co." already exists as
a contact, rather than creating duplicates. Re-reset the DB for a clean pass.
"""
import sys
from decimal import ROUND_HALF_UP, Decimal

import httpx

BASE_URL = "http://localhost:8000/api/v1"
ADMIN_LOGIN = "admin"
ADMIN_PASSWORD = "Admin@12345"


def die(msg: str) -> None:
    print(f"\nERROR: {msg}")
    sys.exit(1)


def half(amount: str) -> str:
    return str((Decimal(amount) / 2).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def main() -> None:
    client = httpx.Client(base_url=BASE_URL, timeout=30)

    print(f"== Logging in as {ADMIN_LOGIN} ==")
    resp = client.post("/auth/login", json={"login_id": ADMIN_LOGIN, "password": ADMIN_PASSWORD})
    if resp.status_code != 200:
        die(f"admin login failed ({resp.status_code}): {resp.text}\nIs the backend running on :8000?")
    client.headers["Authorization"] = f"Bearer {resp.json()['access_token']}"

    guard = client.get("/contacts", params={"search": "Azure Furniture Co."}).json()
    if guard["total"] > 0:
        die(
            "Demo data already present (found 'Azure Furniture Co.'). "
            "Reset the DB first if you want a clean pass:\n"
            "  alembic downgrade base && alembic upgrade head && python -m app.db.seed"
        )

    def post(path: str, json: dict | None = None) -> dict:
        r = client.post(path, json=json)
        if r.status_code >= 400:
            die(f"POST {path} -> {r.status_code}\n{r.text}")
        return r.json() if r.text else {}

    def patch(path: str, json: dict) -> dict:
        r = client.patch(path, json=json)
        if r.status_code >= 400:
            die(f"PATCH {path} -> {r.status_code}\n{r.text}")
        return r.json()

    def get_all(path: str) -> list[dict]:
        r = client.get(path, params={"page_size": 100})
        if r.status_code >= 400:
            die(f"GET {path} -> {r.status_code}\n{r.text}")
        return r.json()["items"]

    # ---------------------------------------------------------- lookups --
    print("== Reading baseline Chart of Accounts / Journals (from app.db.seed) ==")
    accounts = {a["code"]: a["id"] for a in get_all("/accounts")}
    journals = {j["code"]: j["id"] for j in get_all("/journals")}
    for code in ("1000", "1010", "3000", "4000", "5000", "5900"):
        if code not in accounts:
            die(f"account {code} missing - run `python -m app.db.seed` first")
    BANK_J, CASH_J = journals["BANK"], journals["CASH"]

    # ---------------------------------------------------- master data ---
    print("== Product categories ==")
    cat_chairs = post("/product-categories", {"name": "Chairs"})
    cat_tables = post("/product-categories", {"name": "Tables"})
    cat_raw = post("/product-categories", {"name": "Raw Materials"})

    print("== Products ==")
    chair = post("/products", {
        "name": "Office Chair", "product_type": "GOODS", "category_id": cat_chairs["id"],
        "sales_price": "3500.00", "purchase_cost": "2000.00", "default_tax_rate": "5.00",
        "income_account_id": accounts["4000"], "expense_account_id": accounts["5000"],
    })
    table = post("/products", {
        "name": "Dining Table", "product_type": "GOODS", "category_id": cat_tables["id"],
        "sales_price": "12000.00", "purchase_cost": "7500.00", "default_tax_rate": "12.00",
        "income_account_id": accounts["4000"], "expense_account_id": accounts["5000"],
    })
    plank = post("/products", {
        "name": "Teak Wood Plank", "product_type": "GOODS", "category_id": cat_raw["id"],
        "sales_price": "1100.00", "purchase_cost": "900.00", "default_tax_rate": "12.00",
        "income_account_id": accounts["4000"], "expense_account_id": accounts["5000"],
    })
    assembly = post("/products", {
        "name": "Assembly Service", "product_type": "SERVICE",
        "sales_price": "500.00", "purchase_cost": "0.00", "default_tax_rate": "0.00",
        "income_account_id": accounts["4000"],
    })
    old_bookshelf = post("/products", {
        "name": "Old Bookshelf Model", "product_type": "GOODS", "category_id": cat_chairs["id"],
        "sales_price": "1500.00", "purchase_cost": "900.00", "default_tax_rate": "5.00",
        "income_account_id": accounts["4000"], "expense_account_id": accounts["5000"],
    })
    post(f"/products/{old_bookshelf['id']}/archive")
    print(f"  archived product: {old_bookshelf['name']}")

    print("== Analytic accounts ==")
    proj_alpha = post("/analytic-accounts", {"name": "Project Alpha", "analytic_type": "EXPENSE"})
    retail = post("/analytic-accounts", {"name": "Retail Sales", "analytic_type": "INCOME"})
    overheads = post("/analytic-accounts", {"name": "Admin Overheads", "analytic_type": "EXPENSE"})

    print("== Contacts ==")

    def create_contact(payload: dict) -> tuple[dict, dict | None]:
        resp = post("/contacts", payload)
        return resp["contact"], resp.get("portal_credentials")

    azure, _ = create_contact({
        "name": "Azure Furniture Co.", "contact_type": "VENDOR", "email": "sales@azurefurniture.in",
        "mobile": "9821012345", "street": "12 Industrial Estate Road", "city": "Pune",
        "state": "Maharashtra", "pincode": "411019",
    })
    heritage, _ = create_contact({
        "name": "Heritage Timber Traders", "contact_type": "VENDOR", "email": "contact@heritagetimber.in",
        "mobile": "9876543210", "street": "4 Sawmill Lane", "city": "Nashik",
        "state": "Maharashtra", "pincode": "422001",
    })
    nimesh, portal_creds = create_contact({
        "name": "Nimesh Pathak", "contact_type": "CUSTOMER", "email": "nimesh.pathak@example.com",
        "mobile": "9922334455", "street": "22 Marine Drive", "city": "Mumbai",
        "state": "Maharashtra", "pincode": "400001", "create_portal_user": True,
    })
    rahul, _ = create_contact({
        "name": "Rahul Shah", "contact_type": "CUSTOMER", "email": "rahul.shah@example.com",
        "mobile": "9988776655", "street": "9 CG Road", "city": "Ahmedabad",
        "state": "Gujarat", "pincode": "380001",
    })
    craft_co, _ = create_contact({
        "name": "Craft & Co. Interiors", "contact_type": "BOTH", "email": "hello@craftandco.in",
        "mobile": "9012345678", "street": "5 MG Road", "city": "Bengaluru",
        "state": "Karnataka", "pincode": "560001",
    })
    discontinued, _ = create_contact({
        "name": "Discontinued Vendor Pvt Ltd", "contact_type": "VENDOR", "email": "info@discontinued-vendor.example",
        "mobile": "9000000000", "city": "Pune", "state": "Maharashtra",
    })

    # ------------------------------------------------------- purchase ---
    print("== Purchase: Scenario A - PO -> Bill -> PAID (Azure Furniture) ==")
    po_a = post("/purchase/orders", {
        "partner_id": azure["id"], "doc_date": "2026-08-05",
        "lines": [{"product_id": chair["id"], "quantity": "10", "unit_price": "2000.00",
                   "tax_rate": "5.00", "analytic_account_id": proj_alpha["id"]}],
    })
    post(f"/purchase/orders/{po_a['id']}/confirm")
    bill_a = post(f"/purchase/orders/{po_a['id']}/create-bill")
    bill_a = patch(f"/purchase/bills/{bill_a['id']}", {"reference": "AZ-INV-1045", "due_date": "2026-09-04"})
    bill_a = post(f"/purchase/bills/{bill_a['id']}/post")
    post("/payments", {
        "payment_type": "SEND", "method": "BANK", "partner_id": azure["id"], "journal_id": BANK_J,
        "payment_date": "2026-08-10", "amount": bill_a["total_amount"],
        "allocations": [{"document_id": bill_a["id"], "amount_allocated": bill_a["total_amount"]}],
    })
    print(f"  {bill_a['doc_number']} total={bill_a['total_amount']} -> PAID")

    print("== Purchase: Scenario B - PO -> Bill -> PARTIALLY PAID (Azure Furniture) ==")
    po_b = post("/purchase/orders", {
        "partner_id": azure["id"], "doc_date": "2026-08-12",
        "lines": [{"product_id": table["id"], "quantity": "2", "unit_price": "7500.00",
                   "tax_rate": "12.00", "analytic_account_id": proj_alpha["id"]}],
    })
    post(f"/purchase/orders/{po_b['id']}/confirm")
    bill_b = post(f"/purchase/orders/{po_b['id']}/create-bill")
    bill_b = post(f"/purchase/bills/{bill_b['id']}/post")
    post("/payments", {
        "payment_type": "SEND", "method": "CASH", "partner_id": azure["id"], "journal_id": CASH_J,
        "payment_date": "2026-08-20", "amount": half(bill_b["total_amount"]),
        "allocations": [{"document_id": bill_b["id"], "amount_allocated": half(bill_b["total_amount"])}],
    })
    print(f"  {bill_b['doc_number']} total={bill_b['total_amount']} paid={half(bill_b['total_amount'])} -> PARTIALLY_PAID")

    print("== Purchase: Scenario C - direct Bill (no PO), left UNPAID (Heritage Timber) ==")
    bill_c = post("/purchase/bills", {
        "partner_id": heritage["id"], "doc_date": "2026-08-25", "due_date": "2026-09-24",
        "reference": "HT-2208",
        "lines": [{"product_id": plank["id"], "quantity": "50", "unit_price": "900.00", "tax_rate": "12.00"}],
    })
    bill_c = post(f"/purchase/bills/{bill_c['id']}/post")
    print(f"  {bill_c['doc_number']} total={bill_c['total_amount']} -> UNPAID (no PO back-link button)")

    print("== Purchase: Scenario D - PO left in DRAFT (Heritage Timber) ==")
    po_d = post("/purchase/orders", {
        "partner_id": heritage["id"], "doc_date": "2026-08-28",
        "lines": [{"product_id": plank["id"], "quantity": "20", "unit_price": "900.00"}],
    })
    print(f"  {po_d['doc_number']} -> DRAFT")

    print("== Purchase: Scenario E - PO confirmed then CANCELLED (Azure Furniture) ==")
    po_e = post("/purchase/orders", {
        "partner_id": azure["id"], "doc_date": "2026-08-15",
        "lines": [{"product_id": chair["id"], "quantity": "1", "unit_price": "2000.00"}],
    })
    post(f"/purchase/orders/{po_e['id']}/confirm")
    post(f"/purchase/orders/{po_e['id']}/cancel")
    print(f"  {po_e['doc_number']} -> CANCELLED")

    print("== Purchase: Scenario F - draft PO against a vendor we then archive ==")
    po_f = post("/purchase/orders", {
        "partner_id": discontinued["id"], "doc_date": "2026-08-02",
        "lines": [{"product_id": plank["id"], "quantity": "5", "unit_price": "900.00"}],
    })
    post(f"/contacts/{discontinued['id']}/archive")
    print(f"  {po_f['doc_number']} kept as DRAFT, then archived {discontinued['name']}"
          " (still resolvable from this PO; gone from active vendor pickers)")

    # ---------------------------------------------------------- sales ---
    print("== Sales: Scenario A - SO -> Invoice -> PAID (Nimesh Pathak, portal) ==")
    so_a = post("/sales/orders", {
        "partner_id": nimesh["id"], "doc_date": "2026-08-07",
        "lines": [{"product_id": chair["id"], "quantity": "5", "unit_price": "3500.00",
                   "tax_rate": "5.00", "analytic_account_id": retail["id"]}],
    })
    post(f"/sales/orders/{so_a['id']}/confirm")
    inv_a = post(f"/sales/orders/{so_a['id']}/create-invoice")
    inv_a = post(f"/sales/invoices/{inv_a['id']}/post")
    post("/payments", {
        "payment_type": "RECEIVE", "method": "BANK", "partner_id": nimesh["id"], "journal_id": BANK_J,
        "payment_date": "2026-08-14", "amount": inv_a["total_amount"],
        "allocations": [{"document_id": inv_a["id"], "amount_allocated": inv_a["total_amount"]}],
    })
    print(f"  {inv_a['doc_number']} total={inv_a['total_amount']} -> PAID")

    print("== Sales: Scenario B - SO -> Invoice -> PARTIALLY PAID (Nimesh Pathak) ==")
    so_b = post("/sales/orders", {
        "partner_id": nimesh["id"], "doc_date": "2026-08-18",
        "lines": [{"product_id": table["id"], "quantity": "1", "unit_price": "12000.00",
                   "tax_rate": "12.00", "analytic_account_id": retail["id"]}],
    })
    post(f"/sales/orders/{so_b['id']}/confirm")
    inv_b = post(f"/sales/orders/{so_b['id']}/create-invoice")
    inv_b = post(f"/sales/invoices/{inv_b['id']}/post")
    post("/payments", {
        "payment_type": "RECEIVE", "method": "CASH", "partner_id": nimesh["id"], "journal_id": CASH_J,
        "payment_date": "2026-08-24", "amount": half(inv_b["total_amount"]),
        "allocations": [{"document_id": inv_b["id"], "amount_allocated": half(inv_b["total_amount"])}],
    })
    print(f"  {inv_b['doc_number']} total={inv_b['total_amount']} paid={half(inv_b['total_amount'])} -> PARTIALLY_PAID")

    print("== Sales: Scenario C - direct Invoice, left UNPAID for you to Pay from the Portal (Nimesh) ==")
    inv_c = post("/sales/invoices", {
        "partner_id": nimesh["id"], "doc_date": "2026-09-01", "due_date": "2026-10-01",
        "lines": [{"product_id": assembly["id"], "quantity": "3", "unit_price": "500.00",
                   "analytic_account_id": retail["id"]}],
    })
    inv_c = post(f"/sales/invoices/{inv_c['id']}/post")
    print(f"  {inv_c['doc_number']} total={inv_c['total_amount']} -> UNPAID (pay this one live from the portal login)")

    print("== Sales: Scenario D - SO -> Invoice -> PAID (Rahul Shah) ==")
    so_d = post("/sales/orders", {
        "partner_id": rahul["id"], "doc_date": "2026-08-09",
        "lines": [{"product_id": chair["id"], "quantity": "8", "unit_price": "3500.00",
                   "tax_rate": "5.00", "analytic_account_id": retail["id"]}],
    })
    post(f"/sales/orders/{so_d['id']}/confirm")
    inv_d = post(f"/sales/orders/{so_d['id']}/create-invoice")
    inv_d = post(f"/sales/invoices/{inv_d['id']}/post")
    post("/payments", {
        "payment_type": "RECEIVE", "method": "BANK", "partner_id": rahul["id"], "journal_id": BANK_J,
        "payment_date": "2026-08-16", "amount": inv_d["total_amount"],
        "allocations": [{"document_id": inv_d["id"], "amount_allocated": inv_d["total_amount"]}],
    })
    print(f"  {inv_d['doc_number']} total={inv_d['total_amount']} -> PAID")

    print("== Sales: Scenario E - SO left in DRAFT (Craft & Co. Interiors) ==")
    so_e = post("/sales/orders", {
        "partner_id": craft_co["id"], "doc_date": "2026-08-30",
        "lines": [{"product_id": table["id"], "quantity": "3", "unit_price": "12000.00"}],
    })
    print(f"  {so_e['doc_number']} -> DRAFT")

    # ------------------------------------------------- manual journals ---
    print("== Manual JE 1 - opening capital, POSTED (Dr Bank / Cr Capital) ==")
    je1 = post("/journal-entries", {
        "journal_id": BANK_J, "entry_date": "2026-08-01", "reference": "OPENING-BAL",
        "narration": "Opening capital contribution",
        "lines": [
            {"account_id": accounts["1010"], "debit": "200000.00", "credit": "0"},
            {"account_id": accounts["3000"], "debit": "0", "credit": "200000.00"},
        ],
    })
    post(f"/journal-entries/{je1['id']}/post")
    print(f"  {je1['entry_number']} -> POSTED")

    print("== Manual JE 2 - analytic-tagged expense, POSTED (proves a manual entry counts toward budgets too) ==")
    je2 = post("/journal-entries", {
        "journal_id": CASH_J, "entry_date": "2026-08-22", "reference": "MISC-EXP-01",
        "narration": "Site visit expense for Project Alpha",
        "lines": [
            {"account_id": accounts["5900"], "debit": "1500.00", "credit": "0",
             "analytic_account_id": proj_alpha["id"]},
            {"account_id": accounts["1000"], "debit": "0", "credit": "1500.00"},
        ],
    })
    post(f"/journal-entries/{je2['id']}/post")
    print(f"  {je2['entry_number']} -> POSTED")

    print("== Manual JE 3 - deliberately UNBALANCED, left in DRAFT for you to Post yourself ==")
    je3 = post("/journal-entries", {
        "journal_id": BANK_J, "entry_date": "2026-09-03", "reference": "NEEDS-FIX",
        "narration": "Cash moved to bank - try Posting this as-is and watch it get blocked",
        "lines": [
            {"account_id": accounts["1000"], "debit": "10000.00", "credit": "0"},
            {"account_id": accounts["1010"], "debit": "0", "credit": "9000.00"},
        ],
    })
    print(f"  {je3['entry_number']} -> DRAFT, debit 10,000.00 vs credit 9,000.00 - open Journal Entries and hit Post")

    # -------------------------------------------------------- budgets ---
    print("== Budget 1 - CONFIRMED, with real achieved-amount tracking already live ==")
    budget1 = post("/budgets", {
        "name": "Q3 Furniture Program", "start_date": "2026-08-01", "end_date": "2026-09-30",
        "responsible_contact_id": None,
        "lines": [
            {"analytic_account_id": proj_alpha["id"], "analytic_type": "EXPENSE", "planned_amount": "50000.00"},
            {"analytic_account_id": retail["id"], "analytic_type": "INCOME", "planned_amount": "80000.00"},
        ],
    })
    budget1 = post(f"/budgets/{budget1['id']}/confirm")
    for line in budget1["lines"]:
        print(f"    line {line['analytic_account_id']}: planned={line['planned_amount']} "
              f"achieved={line['achieved_amount']} ({line['achieved_pct']}%) remaining={line['remaining']}")

    print("== Budget 2 - left in DRAFT for you to edit/confirm yourself ==")
    budget2 = post("/budgets", {
        "name": "Overheads Draft", "start_date": "2026-08-01", "end_date": "2026-12-31",
        "lines": [{"analytic_account_id": overheads["id"], "analytic_type": "EXPENSE", "planned_amount": "20000.00"}],
    })
    print(f"  {budget2['name']} -> DRAFT (0% achieved - nothing tagged 'Admin Overheads' yet)")

    # ----------------------------------------------------------- users ---
    print("== Extra Accountant login ==")
    post("/users", {
        "name": "Meera Iyer", "login_id": "meera01", "email": "meera.iyer@urbanfurniture.in",
        "password": "Accountant@123", "password_confirm": "Accountant@123",
        "role": "ACCOUNTANT", "contact_id": None,
    })

    print("\n" + "=" * 72)
    print("DEMO DATA READY")
    print("=" * 72)
    print(f"  Admin:        {ADMIN_LOGIN} / {ADMIN_PASSWORD}")
    print(f"  Accountant:   meera01 / Accountant@123")
    if portal_creds:
        print(f"  Portal user:  {portal_creds['login_id']} / {portal_creds['temporary_password']}"
              f"   (Nimesh Pathak - has one PAID, one PARTIALLY_PAID, one UNPAID invoice)")
    print("-" * 72)
    print("Try these while validating:")
    print("  - Journal Entries: open", je3["entry_number"], "and click Post -> expect a blocking 409")
    print("  - Contacts: toggle 'Show archived' -> Discontinued Vendor Pvt Ltd appears")
    print("  - Products: toggle 'Show archived' -> Old Bookshelf Model appears")
    print("  - Reports > Balance Sheet: should show is_balanced = true")
    print("  - Reports > Profit & Loss: net profit should match the Balance Sheet's Current Period Earnings")
    print("  - Budgets: Q3 Furniture Program shows two progress bars, both mid-way, not 0% or 100%")
    print("  - Log in as the portal user and pay", inv_c["doc_number"], "live from /portal/invoices")
    print("=" * 72)


if __name__ == "__main__":
    main()
