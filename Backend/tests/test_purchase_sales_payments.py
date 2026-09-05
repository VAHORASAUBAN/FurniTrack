"""HTTP-level tests for the Purchase and Sales verticals: Purchase Order ->
Vendor Bill -> Payment, and Sales Order -> Customer Invoice -> Payment.
This is where the engine's Vendor Bill / Customer Invoice / Payment posting
rules (already unit-tested against directly-constructed objects in
test_engine_posting.py) get exercised through the real document lifecycle
for the first time — confirm, convert, post, pay, cancel, all via the API.
"""
import uuid

import pytest


def _account_id(client, admin_auth_header, search: str) -> int:
    resp = client.get(f"/api/v1/accounts?search={search}", headers=admin_auth_header)
    return resp.json()["items"][0]["id"]


def _journal_id(client, admin_auth_header, search: str) -> int:
    resp = client.get(f"/api/v1/journals?search={search}", headers=admin_auth_header)
    return resp.json()["items"][0]["id"]


def _make_contact(client, admin_auth_header, contact_type: str) -> int:
    suffix = uuid.uuid4().hex[:8]
    resp = client.post(
        "/api/v1/contacts",
        json={"name": f"Test {contact_type} {suffix}", "contact_type": contact_type, "email": f"{suffix}@t.co"},
        headers=admin_auth_header,
    )
    return resp.json()["contact"]["id"]


@pytest.fixture()
def vendor_id(client, admin_auth_header):
    return _make_contact(client, admin_auth_header, "VENDOR")


@pytest.fixture()
def customer_id(client, admin_auth_header):
    return _make_contact(client, admin_auth_header, "CUSTOMER")


def test_purchase_order_to_vendor_bill_to_payment(client, admin_auth_header, vendor_id):
    expense_id = _account_id(client, admin_auth_header, "Purchase")
    creditors_id = _account_id(client, admin_auth_header, "Creditors")
    bank_journal_id = _journal_id(client, admin_auth_header, "Bank")

    po_resp = client.post(
        "/api/v1/purchase/orders",
        json={
            "partner_id": vendor_id, "doc_date": "2026-02-01",
            "lines": [{"account_id": expense_id, "description": "Table", "quantity": "3", "unit_price": "2000.00", "tax_rate": "0"}],
        },
        headers=admin_auth_header,
    )
    assert po_resp.status_code == 201, po_resp.text
    po = po_resp.json()
    assert po["doc_number"].startswith("P")
    assert po["total_amount"] == "6000.00"
    assert po["status"] == "DRAFT"

    confirm_resp = client.post(f"/api/v1/purchase/orders/{po['id']}/confirm", headers=admin_auth_header)
    assert confirm_resp.json()["status"] == "CONFIRMED"

    bill_resp = client.post(f"/api/v1/purchase/orders/{po['id']}/create-bill", headers=admin_auth_header)
    assert bill_resp.status_code == 201
    bill = bill_resp.json()
    assert bill["doc_number"].startswith("Bill/")
    assert bill["source_document_id"] == po["id"]
    assert bill["total_amount"] == "6000.00"

    post_resp = client.post(f"/api/v1/purchase/bills/{bill['id']}/post", headers=admin_auth_header)
    assert post_resp.status_code == 200, post_resp.text
    posted_bill = post_resp.json()
    assert posted_bill["status"] == "POSTED"
    assert posted_bill["balance"]["payment_status"] == "UNPAID"
    assert posted_bill["balance"]["amount_due"] == "6000.00"

    je_resp = client.get(f"/api/v1/journal-entries?search={bill['doc_number']}", headers=admin_auth_header)
    lines = je_resp.json()["items"][0]["lines"]
    by_account = {l["account_id"]: l for l in lines}
    assert by_account[expense_id]["debit"] == "6000.00"
    assert by_account[creditors_id]["credit"] == "6000.00"
    assert by_account[creditors_id]["partner_id"] == vendor_id

    pay_resp = client.post(
        "/api/v1/payments",
        json={
            "payment_type": "SEND", "method": "BANK", "partner_id": vendor_id, "journal_id": bank_journal_id,
            "payment_date": "2026-02-10", "amount": "6000.00",
            "allocations": [{"document_id": bill["id"], "amount_allocated": "6000.00"}],
        },
        headers=admin_auth_header,
    )
    assert pay_resp.status_code == 201, pay_resp.text
    assert pay_resp.json()["status"] == "POSTED"

    outstanding = client.get(f"/api/v1/payments/documents/{bill['id']}/outstanding", headers=admin_auth_header)
    assert outstanding.json()["payment_status"] == "PAID"
    assert outstanding.json()["amount_due"] == "0.00"


def test_sales_order_to_customer_invoice_to_payment(client, admin_auth_header, customer_id):
    income_id = _account_id(client, admin_auth_header, "Sales")
    debtors_id = _account_id(client, admin_auth_header, "Debtors")
    cash_journal_id = _journal_id(client, admin_auth_header, "Cash")

    so_resp = client.post(
        "/api/v1/sales/orders",
        json={
            "partner_id": customer_id, "doc_date": "2026-02-01",
            "lines": [{"account_id": income_id, "description": "Chair", "quantity": "5", "unit_price": "2000.00", "tax_rate": "0"}],
        },
        headers=admin_auth_header,
    )
    so = so_resp.json()
    client.post(f"/api/v1/sales/orders/{so['id']}/confirm", headers=admin_auth_header)
    invoice = client.post(f"/api/v1/sales/orders/{so['id']}/create-invoice", headers=admin_auth_header).json()
    posted = client.post(f"/api/v1/sales/invoices/{invoice['id']}/post", headers=admin_auth_header).json()
    assert posted["status"] == "POSTED"
    assert posted["total_amount"] == "10000.00"

    je_resp = client.get(f"/api/v1/journal-entries?search={invoice['doc_number']}", headers=admin_auth_header)
    lines = je_resp.json()["items"][0]["lines"]
    by_account = {l["account_id"]: l for l in lines}
    assert by_account[debtors_id]["debit"] == "10000.00"
    assert by_account[debtors_id]["partner_id"] == customer_id
    assert by_account[income_id]["credit"] == "10000.00"

    pay_resp = client.post(
        "/api/v1/payments",
        json={
            "payment_type": "RECEIVE", "method": "CASH", "partner_id": customer_id, "journal_id": cash_journal_id,
            "payment_date": "2026-02-10", "amount": "10000.00",
            "allocations": [{"document_id": invoice["id"], "amount_allocated": "10000.00"}],
        },
        headers=admin_auth_header,
    )
    assert pay_resp.status_code == 201
    assert pay_resp.json()["status"] == "POSTED"


def test_paying_more_than_outstanding_is_rejected(client, admin_auth_header, vendor_id):
    expense_id = _account_id(client, admin_auth_header, "Purchase")
    bank_journal_id = _journal_id(client, admin_auth_header, "Bank")

    bill_resp = client.post(
        "/api/v1/purchase/bills",
        json={
            "partner_id": vendor_id, "doc_date": "2026-02-01",
            "lines": [{"account_id": expense_id, "quantity": "1", "unit_price": "500.00", "tax_rate": "0"}],
        },
        headers=admin_auth_header,
    )
    bill = bill_resp.json()
    client.post(f"/api/v1/purchase/bills/{bill['id']}/post", headers=admin_auth_header)

    over_pay = client.post(
        "/api/v1/payments",
        json={
            "payment_type": "SEND", "method": "BANK", "partner_id": vendor_id, "journal_id": bank_journal_id,
            "payment_date": "2026-02-10", "amount": "600.00",
            "allocations": [{"document_id": bill["id"], "amount_allocated": "600.00"}],
        },
        headers=admin_auth_header,
    )
    assert over_pay.status_code == 409
    assert over_pay.json()["error"]["code"] == "OVER_ALLOCATION"


def test_paying_an_unposted_document_is_rejected(client, admin_auth_header, vendor_id):
    expense_id = _account_id(client, admin_auth_header, "Purchase")
    bank_journal_id = _journal_id(client, admin_auth_header, "Bank")

    bill = client.post(
        "/api/v1/purchase/bills",
        json={
            "partner_id": vendor_id, "doc_date": "2026-02-01",
            "lines": [{"account_id": expense_id, "quantity": "1", "unit_price": "100.00", "tax_rate": "0"}],
        },
        headers=admin_auth_header,
    ).json()  # never posted — still DRAFT

    pay_resp = client.post(
        "/api/v1/payments",
        json={
            "payment_type": "SEND", "method": "BANK", "partner_id": vendor_id, "journal_id": bank_journal_id,
            "payment_date": "2026-02-10", "amount": "100.00",
            "allocations": [{"document_id": bill["id"], "amount_allocated": "100.00"}],
        },
        headers=admin_auth_header,
    )
    assert pay_resp.status_code == 409
    assert pay_resp.json()["error"]["code"] == "DOC_NOT_POSTED"


def test_cancelling_a_posted_bill_reverses_it(client, admin_auth_header, vendor_id):
    expense_id = _account_id(client, admin_auth_header, "Purchase")

    bill = client.post(
        "/api/v1/purchase/bills",
        json={
            "partner_id": vendor_id, "doc_date": "2026-02-01",
            "lines": [{"account_id": expense_id, "quantity": "1", "unit_price": "250.00", "tax_rate": "0"}],
        },
        headers=admin_auth_header,
    ).json()
    client.post(f"/api/v1/purchase/bills/{bill['id']}/post", headers=admin_auth_header)

    cancel_resp = client.post(f"/api/v1/purchase/bills/{bill['id']}/cancel", headers=admin_auth_header)
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "CANCELLED"

    # Once cancelled, posting again must be rejected (NOT_DRAFT), matching
    # the design doc's status-lifecycle guard, not silently re-postable.
    repost_resp = client.post(f"/api/v1/purchase/bills/{bill['id']}/post", headers=admin_auth_header)
    assert repost_resp.status_code == 409


def test_purchase_order_cannot_be_converted_before_confirming(client, admin_auth_header, vendor_id):
    expense_id = _account_id(client, admin_auth_header, "Purchase")

    po = client.post(
        "/api/v1/purchase/orders",
        json={
            "partner_id": vendor_id, "doc_date": "2026-02-01",
            "lines": [{"account_id": expense_id, "quantity": "1", "unit_price": "10.00", "tax_rate": "0"}],
        },
        headers=admin_auth_header,
    ).json()  # still DRAFT — never confirmed

    bill_resp = client.post(f"/api/v1/purchase/orders/{po['id']}/create-bill", headers=admin_auth_header)
    assert bill_resp.status_code == 409
    assert bill_resp.json()["error"]["code"] == "NOT_CONFIRMED"


def test_accountant_can_run_the_full_purchase_flow_but_not_cancel(client, admin_auth_header, vendor_id):
    suffix = uuid.uuid4().hex[:8]
    client.post(
        "/api/v1/auth/signup",
        json={"login_id": f"acct{suffix}", "email": f"acct{suffix}@t.co", "password": "Test@12345", "name": "Acct"},
    )
    login = client.post("/api/v1/auth/login", json={"login_id": f"acct{suffix}", "password": "Test@12345"})
    accountant_header = {"Authorization": f"Bearer {login.json()['access_token']}"}

    expense_id = _account_id(client, admin_auth_header, "Purchase")
    bill_resp = client.post(
        "/api/v1/purchase/bills",
        json={
            "partner_id": vendor_id, "doc_date": "2026-02-01",
            "lines": [{"account_id": expense_id, "quantity": "1", "unit_price": "40.00", "tax_rate": "0"}],
        },
        headers=accountant_header,
    )
    assert bill_resp.status_code == 201
    bill = bill_resp.json()

    post_resp = client.post(f"/api/v1/purchase/bills/{bill['id']}/post", headers=accountant_header)
    assert post_resp.status_code == 200

    cancel_resp = client.post(f"/api/v1/purchase/bills/{bill['id']}/cancel", headers=accountant_header)
    assert cancel_resp.status_code == 403
