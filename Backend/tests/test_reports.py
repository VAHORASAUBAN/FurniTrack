"""Report tests — design doc §4, §11.2. The one that matters most: the
Balance Sheet must balance exactly, always, with no epsilon — and the
current-period-earnings line (net_income folded into Equity) is what
makes that true, since no posting rule ever moves an income/expense
balance into a balance-sheet account directly.

Assertions use *deltas* around a fresh transaction rather than absolute
totals, since the report aggregates over the whole ledger and other tests
may have posted entries before this one runs — the accounting identity
(assets = liabilities + equity) has to hold at every point regardless of
scale, which is exactly what asserting is_balanced proves.
"""
import uuid
from decimal import Decimal


def _account_id(client, admin_auth_header, search: str) -> int:
    resp = client.get(f"/api/v1/accounts?search={search}", headers=admin_auth_header)
    return resp.json()["items"][0]["id"]


def test_balance_sheet_balances_before_and_after_a_posted_bill(client, admin_auth_header):
    before = client.get("/api/v1/reports/balance-sheet", headers=admin_auth_header).json()
    assert before["is_balanced"] is True
    assert before["difference"] == "0.00"

    suffix = uuid.uuid4().hex[:8]
    vendor = client.post(
        "/api/v1/contacts",
        json={"name": f"Report Vendor {suffix}", "contact_type": "VENDOR", "email": f"{suffix}@t.co"},
        headers=admin_auth_header,
    ).json()["contact"]

    expense_id = _account_id(client, admin_auth_header, "Purchase")
    bill = client.post(
        "/api/v1/purchase/bills",
        json={
            "partner_id": vendor["id"], "doc_date": "2026-03-01",
            "lines": [{"account_id": expense_id, "quantity": "1", "unit_price": "1000.00", "tax_rate": "0"}],
        },
        headers=admin_auth_header,
    ).json()
    client.post(f"/api/v1/purchase/bills/{bill['id']}/post", headers=admin_auth_header)

    after = client.get("/api/v1/reports/balance-sheet", headers=admin_auth_header).json()
    assert after["is_balanced"] is True
    assert after["difference"] == "0.00"

    # Creditors (Liability) +1000, net_income -1000 (an Expense posted) ->
    # Equity -1000 -> Assets unchanged. The identity survives the swing.
    delta_liabilities = Decimal(after["total_liabilities"]) - Decimal(before["total_liabilities"])
    delta_equity = Decimal(after["total_equity"]) - Decimal(before["total_equity"])
    delta_assets = Decimal(after["total_assets"]) - Decimal(before["total_assets"])
    assert delta_liabilities == Decimal("1000.00")
    assert delta_equity == Decimal("-1000.00")
    assert delta_assets == Decimal("0.00")


def test_profit_and_loss_matches_balance_sheet_net_income(client, admin_auth_header):
    # A wide, fixed window rather than one specific calendar day — repeated
    # suite runs must stay idempotent, and a single hardcoded day collects a
    # second test's postings on every rerun, breaking an exact-delta check.
    WIDE_FROM, WIDE_TO = "2000-01-01", "2030-01-01"

    def pl_totals():
        pl = client.get(
            f"/api/v1/reports/profit-loss?date_from={WIDE_FROM}&date_to={WIDE_TO}", headers=admin_auth_header
        ).json()
        return Decimal(pl["net_profit"])

    def bs_net_income():
        bs = client.get(f"/api/v1/reports/balance-sheet?as_of={WIDE_TO}", headers=admin_auth_header).json()
        return Decimal(bs["net_income"])

    net_profit_before = pl_totals()
    net_income_before = bs_net_income()

    suffix = uuid.uuid4().hex[:8]
    customer = client.post(
        "/api/v1/contacts",
        json={"name": f"Report Customer {suffix}", "contact_type": "CUSTOMER", "email": f"{suffix}@t.co"},
        headers=admin_auth_header,
    ).json()["contact"]

    income_id = _account_id(client, admin_auth_header, "Sales")
    invoice = client.post(
        "/api/v1/sales/invoices",
        json={
            "partner_id": customer["id"], "doc_date": "2026-03-15",
            "lines": [{"account_id": income_id, "quantity": "1", "unit_price": "500.00", "tax_rate": "0"}],
        },
        headers=admin_auth_header,
    ).json()
    client.post(f"/api/v1/sales/invoices/{invoice['id']}/post", headers=admin_auth_header)

    # Same underlying query shape (§4.1/§4.2) over the same window — if these
    # two ever disagree, there's a filter bug, not a business difference.
    assert pl_totals() - net_profit_before == Decimal("500.00")
    assert bs_net_income() - net_income_before == Decimal("500.00")


def test_budget_achieved_amount_reflects_posted_journal_lines(client, admin_auth_header):
    suffix = uuid.uuid4().hex[:8]
    analytic = client.post(
        "/api/v1/analytic-accounts", json={"name": f"Project {suffix}", "analytic_type": "EXPENSE"},
        headers=admin_auth_header,
    ).json()

    budget = client.post(
        "/api/v1/budgets",
        json={
            "name": f"Budget {suffix}", "start_date": "2026-04-01", "end_date": "2026-04-30",
            "lines": [{"analytic_account_id": analytic["id"], "analytic_type": "EXPENSE", "planned_amount": "10000.00"}],
        },
        headers=admin_auth_header,
    ).json()
    assert budget["lines"][0]["achieved_amount"] == "0.00"
    assert budget["lines"][0]["achieved_pct"] == "0.00"
    assert budget["lines"][0]["remaining"] == "10000.00"

    vendor = client.post(
        "/api/v1/contacts",
        json={"name": f"Budget Vendor {suffix}", "contact_type": "VENDOR", "email": f"bv{suffix}@t.co"},
        headers=admin_auth_header,
    ).json()["contact"]
    expense_id = _account_id(client, admin_auth_header, "Purchase")
    bill = client.post(
        "/api/v1/purchase/bills",
        json={
            "partner_id": vendor["id"], "doc_date": "2026-04-15",
            "lines": [
                {
                    "account_id": expense_id, "analytic_account_id": analytic["id"],
                    "quantity": "1", "unit_price": "2000.00", "tax_rate": "0",
                }
            ],
        },
        headers=admin_auth_header,
    ).json()
    client.post(f"/api/v1/purchase/bills/{bill['id']}/post", headers=admin_auth_header)

    refreshed = client.get(f"/api/v1/budgets/{budget['id']}", headers=admin_auth_header).json()
    line = refreshed["lines"][0]
    assert line["achieved_amount"] == "2000.00"
    assert line["achieved_pct"] == "20.00"
    assert line["remaining"] == "8000.00"


def test_budget_confirm_lifecycle(client, admin_auth_header):
    suffix = uuid.uuid4().hex[:8]
    analytic = client.post(
        "/api/v1/analytic-accounts", json={"name": f"Lifecycle {suffix}", "analytic_type": "INCOME"},
        headers=admin_auth_header,
    ).json()
    budget = client.post(
        "/api/v1/budgets",
        json={
            "name": f"Lifecycle Budget {suffix}", "start_date": "2026-05-01", "end_date": "2026-05-31",
            "lines": [{"analytic_account_id": analytic["id"], "analytic_type": "INCOME", "planned_amount": "500.00"}],
        },
        headers=admin_auth_header,
    ).json()
    assert budget["status"] == "DRAFT"

    confirm_resp = client.post(f"/api/v1/budgets/{budget['id']}/confirm", headers=admin_auth_header)
    assert confirm_resp.json()["status"] == "CONFIRMED"

    edit_resp = client.patch(
        f"/api/v1/budgets/{budget['id']}",
        json={"name": "Should not work"},
        headers=admin_auth_header,
    )
    assert edit_resp.status_code == 409

    cancel_resp = client.post(f"/api/v1/budgets/{budget['id']}/cancel", headers=admin_auth_header)
    assert cancel_resp.json()["status"] == "CANCELLED"
