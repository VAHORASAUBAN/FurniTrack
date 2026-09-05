"""HTTP-level tests for manual Journal Entries — design doc §5.4. Every
other test file exercises journal entries only as a side effect of posting
a Bill/Invoice/Payment; this is the one place the manual-entry path itself
(create as Draft, the balance-rule block, Post, Delete) is driven through
the real API rather than directly against the engine (already covered in
isolation by test_engine_validators.py).
"""
import uuid


def _account_id(client, admin_auth_header, search: str) -> int:
    resp = client.get(f"/api/v1/accounts?search={search}", headers=admin_auth_header)
    return resp.json()["items"][0]["id"]


def _journal_id(client, admin_auth_header, search: str) -> int:
    resp = client.get(f"/api/v1/journals?search={search}", headers=admin_auth_header)
    return resp.json()["items"][0]["id"]


def test_unbalanced_entry_is_blocked_then_succeeds_once_fixed(client, admin_auth_header):
    bank_journal_id = _journal_id(client, admin_auth_header, "Bank")
    cash_id = _account_id(client, admin_auth_header, "Cash")
    capital_id = _account_id(client, admin_auth_header, "Capital")
    suffix = uuid.uuid4().hex[:8]

    create_resp = client.post(
        "/api/v1/journal-entries",
        json={
            "journal_id": bank_journal_id, "entry_date": "2026-04-01", "reference": f"JE-TEST-{suffix}",
            "lines": [
                {"account_id": cash_id, "debit": "1000.00", "credit": "0.00"},
                {"account_id": capital_id, "debit": "0.00", "credit": "900.00"},
            ],
        },
        headers=admin_auth_header,
    )
    assert create_resp.status_code == 201, create_resp.text
    entry = create_resp.json()
    assert entry["status"] == "DRAFT"

    post_resp = client.post(f"/api/v1/journal-entries/{entry['id']}/post", headers=admin_auth_header)
    assert post_resp.status_code == 409
    assert post_resp.json()["error"]["code"] == "UNBALANCED_ENTRY"

    # still Draft and editable after the rejected post - nothing was written
    still_draft = client.get(f"/api/v1/journal-entries/{entry['id']}", headers=admin_auth_header).json()
    assert still_draft["status"] == "DRAFT"

    fix_resp = client.patch(
        f"/api/v1/journal-entries/{entry['id']}",
        json={"lines": [
            {"account_id": cash_id, "debit": "1000.00", "credit": "0.00"},
            {"account_id": capital_id, "debit": "0.00", "credit": "1000.00"},
        ]},
        headers=admin_auth_header,
    )
    assert fix_resp.status_code == 200, fix_resp.text

    posted_resp = client.post(f"/api/v1/journal-entries/{entry['id']}/post", headers=admin_auth_header)
    assert posted_resp.status_code == 200, posted_resp.text
    assert posted_resp.json()["status"] == "POSTED"
    assert posted_resp.json()["total_debit"] == posted_resp.json()["total_credit"] == "1000.00"


def test_draft_journal_entry_can_be_deleted(client, admin_auth_header):
    bank_journal_id = _journal_id(client, admin_auth_header, "Bank")
    cash_id = _account_id(client, admin_auth_header, "Cash")
    capital_id = _account_id(client, admin_auth_header, "Capital")

    entry = client.post(
        "/api/v1/journal-entries",
        json={
            "journal_id": bank_journal_id, "entry_date": "2026-04-01",
            "lines": [
                {"account_id": cash_id, "debit": "50.00", "credit": "0.00"},
                {"account_id": capital_id, "debit": "0.00", "credit": "50.00"},
            ],
        },
        headers=admin_auth_header,
    ).json()

    delete_resp = client.delete(f"/api/v1/journal-entries/{entry['id']}", headers=admin_auth_header)
    assert delete_resp.status_code == 204
    assert client.get(f"/api/v1/journal-entries/{entry['id']}", headers=admin_auth_header).status_code == 404


def test_posted_journal_entry_cannot_be_deleted(client, admin_auth_header):
    bank_journal_id = _journal_id(client, admin_auth_header, "Bank")
    cash_id = _account_id(client, admin_auth_header, "Cash")
    capital_id = _account_id(client, admin_auth_header, "Capital")

    entry = client.post(
        "/api/v1/journal-entries",
        json={
            "journal_id": bank_journal_id, "entry_date": "2026-04-01",
            "lines": [
                {"account_id": cash_id, "debit": "50.00", "credit": "0.00"},
                {"account_id": capital_id, "debit": "0.00", "credit": "50.00"},
            ],
        },
        headers=admin_auth_header,
    ).json()
    client.post(f"/api/v1/journal-entries/{entry['id']}/post", headers=admin_auth_header)

    delete_resp = client.delete(f"/api/v1/journal-entries/{entry['id']}", headers=admin_auth_header)
    assert delete_resp.status_code == 409
    assert delete_resp.json()["error"]["code"] == "NOT_DRAFT"
