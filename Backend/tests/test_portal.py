"""Portal tests — design doc §9.2. The scoping proof that matters most:
a wrong invoice id must come back 404, not 403, since a portal user
shouldn't be able to confirm another contact's invoice even exists.
"""
import uuid

import pytest


def _account_id(client, admin_auth_header, search: str) -> int:
    resp = client.get(f"/api/v1/accounts?search={search}", headers=admin_auth_header)
    return resp.json()["items"][0]["id"]


def _make_customer_with_posted_invoice(client, admin_auth_header, *, amount="6000.00"):
    suffix = uuid.uuid4().hex[:8]
    contact_resp = client.post(
        "/api/v1/contacts",
        json={"name": f"Portal Customer {suffix}", "contact_type": "CUSTOMER", "email": f"{suffix}@t.co"},
        headers=admin_auth_header,
    )
    contact_id = contact_resp.json()["contact"]["id"]

    income_id = _account_id(client, admin_auth_header, "Sales")
    invoice_resp = client.post(
        "/api/v1/sales/invoices",
        json={
            "partner_id": contact_id, "doc_date": "2026-02-01",
            "lines": [{"account_id": income_id, "quantity": "1", "unit_price": amount, "tax_rate": "0"}],
        },
        headers=admin_auth_header,
    )
    invoice = invoice_resp.json()
    posted = client.post(f"/api/v1/sales/invoices/{invoice['id']}/post", headers=admin_auth_header).json()
    return contact_id, posted


def _make_vendor_with_posted_bill(client, admin_auth_header, *, amount="4500.00"):
    suffix = uuid.uuid4().hex[:8]
    contact_resp = client.post(
        "/api/v1/contacts",
        json={"name": f"Portal Vendor {suffix}", "contact_type": "VENDOR", "email": f"{suffix}@t.co"},
        headers=admin_auth_header,
    )
    contact_id = contact_resp.json()["contact"]["id"]

    expense_id = _account_id(client, admin_auth_header, "Purchase")
    bill_resp = client.post(
        "/api/v1/purchase/bills",
        json={
            "partner_id": contact_id, "doc_date": "2026-02-01",
            "lines": [{"account_id": expense_id, "quantity": "1", "unit_price": amount, "tax_rate": "0"}],
        },
        headers=admin_auth_header,
    )
    bill = bill_resp.json()
    posted = client.post(f"/api/v1/purchase/bills/{bill['id']}/post", headers=admin_auth_header).json()
    return contact_id, posted


def _create_portal_login(client, admin_auth_header, contact_id: int) -> dict:
    suffix = uuid.uuid4().hex[:6]
    payload = {
        "name": "Portal Login", "login_id": f"p{suffix}", "email": f"p{suffix}@t.co",
        "password": "Passw0rd1", "password_confirm": "Passw0rd1", "role": "PORTAL", "contact_id": contact_id,
    }
    client.post("/api/v1/users", json=payload, headers=admin_auth_header)
    login = client.post("/api/v1/auth/login", json={"login_id": payload["login_id"], "password": payload["password"]})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_portal_user_sees_only_their_own_invoice(client, admin_auth_header):
    contact_id, invoice = _make_customer_with_posted_invoice(client, admin_auth_header)
    portal_header = _create_portal_login(client, admin_auth_header, contact_id)

    list_resp = client.get("/api/v1/portal/invoices", headers=portal_header)
    assert list_resp.status_code == 200
    ids = [item["id"] for item in list_resp.json()["items"]]
    assert invoice["id"] in ids

    detail_resp = client.get(f"/api/v1/portal/invoices/{invoice['id']}", headers=portal_header)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["doc_number"] == invoice["doc_number"]
    assert detail_resp.json()["balance"]["payment_status"] == "UNPAID"


def test_portal_user_cannot_see_someone_elses_invoice(client, admin_auth_header):
    own_contact_id, _ = _make_customer_with_posted_invoice(client, admin_auth_header)
    _, other_invoice = _make_customer_with_posted_invoice(client, admin_auth_header)
    portal_header = _create_portal_login(client, admin_auth_header, own_contact_id)

    resp = client.get(f"/api/v1/portal/invoices/{other_invoice['id']}", headers=portal_header)
    assert resp.status_code == 404  # not 403 — can't even confirm it exists

    other_ids = [item["id"] for item in client.get("/api/v1/portal/invoices", headers=portal_header).json()["items"]]
    assert other_invoice["id"] not in other_ids


def test_portal_user_can_pay_their_own_invoice(client, admin_auth_header):
    contact_id, invoice = _make_customer_with_posted_invoice(client, admin_auth_header, amount="1000.00")
    portal_header = _create_portal_login(client, admin_auth_header, contact_id)

    pay_resp = client.post(
        f"/api/v1/portal/invoices/{invoice['id']}/pay",
        json={"method": "BANK", "amount": "1000.00", "payment_date": "2026-02-05"},
        headers=portal_header,
    )
    assert pay_resp.status_code == 201, pay_resp.text
    body = pay_resp.json()
    assert body["payment_type"] == "RECEIVE"
    assert body["status"] == "POSTED"

    detail = client.get(f"/api/v1/portal/invoices/{invoice['id']}", headers=portal_header)
    assert detail.json()["balance"]["payment_status"] == "PAID"


def test_portal_user_cannot_pay_someone_elses_invoice(client, admin_auth_header):
    own_contact_id, _ = _make_customer_with_posted_invoice(client, admin_auth_header)
    _, other_invoice = _make_customer_with_posted_invoice(client, admin_auth_header)
    portal_header = _create_portal_login(client, admin_auth_header, own_contact_id)

    resp = client.post(
        f"/api/v1/portal/invoices/{other_invoice['id']}/pay",
        json={"method": "BANK", "amount": "1.00", "payment_date": "2026-02-05"},
        headers=portal_header,
    )
    assert resp.status_code == 404


def test_staff_user_cannot_hit_portal_routes(client, admin_auth_header):
    resp = client.get("/api/v1/portal/invoices", headers=admin_auth_header)
    assert resp.status_code == 403


def test_portal_user_can_download_their_own_invoice_pdf(client, admin_auth_header):
    contact_id, invoice = _make_customer_with_posted_invoice(client, admin_auth_header)
    portal_header = _create_portal_login(client, admin_auth_header, contact_id)

    resp = client.get(f"/api/v1/portal/invoices/{invoice['id']}/pdf", headers=portal_header)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"


def test_portal_user_cannot_download_someone_elses_invoice_pdf(client, admin_auth_header):
    own_contact_id, _ = _make_customer_with_posted_invoice(client, admin_auth_header)
    _, other_invoice = _make_customer_with_posted_invoice(client, admin_auth_header)
    portal_header = _create_portal_login(client, admin_auth_header, own_contact_id)

    resp = client.get(f"/api/v1/portal/invoices/{other_invoice['id']}/pdf", headers=portal_header)
    assert resp.status_code == 404


# --- vendor's side (/portal/bills) — same scoping guarantees, read-only ---


def test_portal_user_sees_only_their_own_bill(client, admin_auth_header):
    contact_id, bill = _make_vendor_with_posted_bill(client, admin_auth_header)
    portal_header = _create_portal_login(client, admin_auth_header, contact_id)

    list_resp = client.get("/api/v1/portal/bills", headers=portal_header)
    assert list_resp.status_code == 200
    ids = [item["id"] for item in list_resp.json()["items"]]
    assert bill["id"] in ids

    detail_resp = client.get(f"/api/v1/portal/bills/{bill['id']}", headers=portal_header)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["doc_number"] == bill["doc_number"]
    assert detail_resp.json()["balance"]["payment_status"] == "UNPAID"


def test_portal_user_cannot_see_someone_elses_bill(client, admin_auth_header):
    own_contact_id, _ = _make_vendor_with_posted_bill(client, admin_auth_header)
    _, other_bill = _make_vendor_with_posted_bill(client, admin_auth_header)
    portal_header = _create_portal_login(client, admin_auth_header, own_contact_id)

    resp = client.get(f"/api/v1/portal/bills/{other_bill['id']}", headers=portal_header)
    assert resp.status_code == 404  # not 403 — can't even confirm it exists

    other_ids = [item["id"] for item in client.get("/api/v1/portal/bills", headers=portal_header).json()["items"]]
    assert other_bill["id"] not in other_ids


def test_portal_user_cannot_see_invoices_mixed_into_their_bills_list(client, admin_auth_header):
    """A vendor and customer contact are scoped by doc_type, not just
    partner_id - a BOTH-type contact's invoices must not leak into /bills."""
    contact_resp = client.post(
        "/api/v1/contacts",
        json={"name": f"Both Contact {uuid.uuid4().hex[:8]}", "contact_type": "BOTH",
              "email": f"{uuid.uuid4().hex[:8]}@t.co"},
        headers=admin_auth_header,
    )
    contact_id = contact_resp.json()["contact"]["id"]
    income_id = _account_id(client, admin_auth_header, "Sales")
    invoice = client.post(
        "/api/v1/sales/invoices",
        json={"partner_id": contact_id, "doc_date": "2026-02-01",
              "lines": [{"account_id": income_id, "quantity": "1", "unit_price": "500.00", "tax_rate": "0"}]},
        headers=admin_auth_header,
    ).json()
    client.post(f"/api/v1/sales/invoices/{invoice['id']}/post", headers=admin_auth_header)
    portal_header = _create_portal_login(client, admin_auth_header, contact_id)

    bill_ids = [item["id"] for item in client.get("/api/v1/portal/bills", headers=portal_header).json()["items"]]
    assert invoice["id"] not in bill_ids


def test_staff_user_cannot_hit_portal_bills_route(client, admin_auth_header):
    resp = client.get("/api/v1/portal/bills", headers=admin_auth_header)
    assert resp.status_code == 403


def test_portal_user_can_download_their_own_bill_pdf(client, admin_auth_header):
    contact_id, bill = _make_vendor_with_posted_bill(client, admin_auth_header)
    portal_header = _create_portal_login(client, admin_auth_header, contact_id)

    resp = client.get(f"/api/v1/portal/bills/{bill['id']}/pdf", headers=portal_header)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"


def test_portal_user_cannot_download_someone_elses_bill_pdf(client, admin_auth_header):
    own_contact_id, _ = _make_vendor_with_posted_bill(client, admin_auth_header)
    _, other_bill = _make_vendor_with_posted_bill(client, admin_auth_header)
    portal_header = _create_portal_login(client, admin_auth_header, own_contact_id)

    resp = client.get(f"/api/v1/portal/bills/{other_bill['id']}/pdf", headers=portal_header)
    assert resp.status_code == 404
