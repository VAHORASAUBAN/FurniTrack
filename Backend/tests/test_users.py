"""User management tests — the wireframe's "Create User" screen. Admin-only
end to end; a Portal-role user must be linked to an existing, not-already-
linked Contact, since that Contact is what portal scoping (design doc §9.2)
actually keys on.
"""
import uuid

import pytest


def _make_contact(client, admin_auth_header) -> int:
    suffix = uuid.uuid4().hex[:8]
    resp = client.post(
        "/api/v1/contacts",
        json={"name": f"Portal Test {suffix}", "contact_type": "CUSTOMER", "email": f"{suffix}@t.co"},
        headers=admin_auth_header,
    )
    return resp.json()["contact"]["id"]


def _user_payload(**overrides):
    suffix = uuid.uuid4().hex[:6]
    payload = {
        "name": "Test User",
        "login_id": f"u{suffix}",
        "email": f"u{suffix}@t.co",
        "password": "Passw0rd1",
        "password_confirm": "Passw0rd1",
        "role": "ACCOUNTANT",
    }
    payload.update(overrides)
    return payload


def test_admin_can_create_an_accountant(client, admin_auth_header):
    resp = client.post("/api/v1/users", json=_user_payload(role="ACCOUNTANT"), headers=admin_auth_header)
    assert resp.status_code == 201, resp.text
    assert resp.json()["role"] == "ACCOUNTANT"


def test_admin_can_create_another_admin(client, admin_auth_header):
    resp = client.post("/api/v1/users", json=_user_payload(role="ADMIN"), headers=admin_auth_header)
    assert resp.status_code == 201, resp.text
    assert resp.json()["role"] == "ADMIN"


def test_portal_role_without_contact_is_rejected(client, admin_auth_header):
    resp = client.post("/api/v1/users", json=_user_payload(role="PORTAL"), headers=admin_auth_header)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


def test_non_portal_role_with_contact_is_rejected(client, admin_auth_header):
    contact_id = _make_contact(client, admin_auth_header)
    resp = client.post(
        "/api/v1/users", json=_user_payload(role="ACCOUNTANT", contact_id=contact_id), headers=admin_auth_header
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


def test_portal_role_with_contact_succeeds_and_can_log_in(client, admin_auth_header):
    contact_id = _make_contact(client, admin_auth_header)
    payload = _user_payload(role="PORTAL", contact_id=contact_id)
    resp = client.post("/api/v1/users", json=payload, headers=admin_auth_header)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["role"] == "PORTAL"
    assert body["contact_id"] == contact_id

    login_resp = client.post(
        "/api/v1/auth/login", json={"login_id": payload["login_id"], "password": payload["password"]}
    )
    assert login_resp.status_code == 200
    assert login_resp.json()["user"]["role"] == "PORTAL"


def test_contact_already_linked_to_a_portal_user_is_rejected(client, admin_auth_header):
    contact_id = _make_contact(client, admin_auth_header)
    client.post("/api/v1/users", json=_user_payload(role="PORTAL", contact_id=contact_id), headers=admin_auth_header)

    second_resp = client.post(
        "/api/v1/users", json=_user_payload(role="PORTAL", contact_id=contact_id), headers=admin_auth_header
    )
    assert second_resp.status_code == 409
    assert second_resp.json()["error"]["code"] == "CONTACT_ALREADY_LINKED"


def test_duplicate_login_id_is_rejected(client, admin_auth_header):
    payload = _user_payload()
    client.post("/api/v1/users", json=payload, headers=admin_auth_header)

    dupe = dict(payload, email=f"{uuid.uuid4().hex[:6]}@t.co")
    resp = client.post("/api/v1/users", json=dupe, headers=admin_auth_header)
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LOGIN_ID_TAKEN"


def test_mismatched_passwords_rejected(client, admin_auth_header):
    resp = client.post(
        "/api/v1/users", json=_user_payload(password="Passw0rd1", password_confirm="Different1"),
        headers=admin_auth_header,
    )
    assert resp.status_code == 422


def test_non_admin_cannot_create_users(client, admin_auth_header):
    suffix = uuid.uuid4().hex[:6]
    client.post(
        "/api/v1/auth/signup",
        json={"login_id": f"a{suffix}", "email": f"a{suffix}@t.co", "password": "Passw0rd1", "password_confirm": "Passw0rd1"},
    )
    login = client.post("/api/v1/auth/login", json={"login_id": f"a{suffix}", "password": "Passw0rd1"})
    accountant_header = {"Authorization": f"Bearer {login.json()['access_token']}"}

    resp = client.post("/api/v1/users", json=_user_payload(), headers=accountant_header)
    assert resp.status_code == 403


def test_archiving_a_user_removes_it_from_default_list(client, admin_auth_header):
    payload = _user_payload()
    create_resp = client.post("/api/v1/users", json=payload, headers=admin_auth_header)
    user_id = create_resp.json()["id"]

    archive_resp = client.post(f"/api/v1/users/{user_id}/archive", headers=admin_auth_header)
    assert archive_resp.status_code == 200
    assert archive_resp.json()["is_active"] is False

    list_resp = client.get(f"/api/v1/users?search={payload['login_id']}", headers=admin_auth_header)
    assert list_resp.json()["total"] == 0

    with_archived = client.get(
        f"/api/v1/users?search={payload['login_id']}&include_archived=true", headers=admin_auth_header
    )
    assert with_archived.json()["total"] == 1
