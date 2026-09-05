"""Auth regression suite — automates the manual verification done during
the build, including the refresh-token reuse-detection bug found and fixed
there: a compromised token family must stay dead even for tokens rotated
from it BEFORE the reuse was detected (test_refresh_reuse_revokes_whole_family).
"""
import uuid

import pytest

from app.db.session import SessionLocal
from app.models import RefreshToken, User


@pytest.fixture()
def new_accountant(client):
    """Signs up a fresh, uniquely-named accountant and cleans up after."""
    suffix = uuid.uuid4().hex[:6]
    login_id = f"t{suffix}"  # 7 chars, within the 6-12 rule
    email = f"test_{suffix}@example.com"
    password = "TestPass1"

    resp = client.post(
        "/api/v1/auth/signup",
        json={"login_id": login_id, "email": email, "password": password, "password_confirm": password},
    )
    assert resp.status_code == 201, resp.text
    user_id = resp.json()["id"]

    yield {"login_id": login_id, "email": email, "password": password, "user_id": user_id}

    db = SessionLocal()
    try:
        db.query(RefreshToken).filter_by(user_id=user_id).delete()
        db.query(User).filter_by(id=user_id).delete()
        db.commit()
    finally:
        db.close()


def test_signup_creates_accountant_role(client, new_accountant):
    resp = client.get(
        "/api/v1/auth/me",
        headers=_auth_header(client, new_accountant),
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "ACCOUNTANT"


def test_signup_duplicate_login_id_returns_409(client, new_accountant):
    resp = client.post(
        "/api/v1/auth/signup",
        json={
            "login_id": new_accountant["login_id"],
            "email": f"other_{uuid.uuid4().hex[:6]}@example.com",
            "password": "AnotherPass1",
            "password_confirm": "AnotherPass1",
        },
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "LOGIN_ID_TAKEN"


def test_signup_short_login_id_returns_422(client):
    resp = client.post(
        "/api/v1/auth/signup",
        json={"login_id": "ab", "email": "x@example.com", "password": "Passw0rd1", "password_confirm": "Passw0rd1"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    assert resp.json()["error"]["details"][0]["field"] == "login_id"


def test_signup_mismatched_passwords_returns_422(client):
    resp = client.post(
        "/api/v1/auth/signup",
        json={
            "login_id": f"t{uuid.uuid4().hex[:6]}", "email": f"{uuid.uuid4().hex[:6]}@example.com",
            "password": "Passw0rd1", "password_confirm": "Different1",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


def test_signup_defaults_name_to_login_id(client, new_accountant):
    resp = client.get("/api/v1/auth/me", headers=_auth_header(client, new_accountant))
    assert resp.json()["name"] == new_accountant["login_id"]


def test_login_wrong_password_returns_401_generic_message(client, new_accountant):
    resp = client.post(
        "/api/v1/auth/login",
        json={"login_id": new_accountant["login_id"], "password": "WrongPassword"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_me_without_token_returns_401(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


def test_refresh_rotates_token(client, new_accountant):
    refresh_a = _login(client, new_accountant)["refresh_token"]

    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_a})
    assert resp.status_code == 200
    refresh_b = resp.json()["refresh_token"]
    assert refresh_b != refresh_a


def test_refresh_reuse_revokes_whole_family(client, new_accountant):
    """The bug caught during manual testing: presenting an already-rotated
    refresh token must revoke the ENTIRE family durably — including tokens
    that were validly issued from it before the reuse was detected — not
    just reject the replayed token itself."""
    refresh_a = _login(client, new_accountant)["refresh_token"]

    rotate_resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_a})
    assert rotate_resp.status_code == 200
    refresh_b = rotate_resp.json()["refresh_token"]

    replay_resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_a})
    assert replay_resp.status_code == 401
    assert replay_resp.json()["error"]["code"] == "REFRESH_REUSE_DETECTED"

    # The critical assertion: refresh_b must be dead too, even though it was
    # issued before the replay was ever detected.
    b_resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_b})
    assert b_resp.status_code == 401
    assert b_resp.json()["error"]["code"] == "REFRESH_REVOKED"


def test_logout_then_refresh_returns_401(client, new_accountant):
    refresh_token = _login(client, new_accountant)["refresh_token"]

    logout_resp = client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert logout_resp.status_code == 204

    refresh_resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_resp.status_code == 401
    assert refresh_resp.json()["error"]["code"] == "REFRESH_REVOKED"


def test_logout_is_idempotent(client, new_accountant):
    refresh_token = _login(client, new_accountant)["refresh_token"]
    assert client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token}).status_code == 204
    # same token again — already gone, still must not error
    assert client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token}).status_code == 204


# --- helpers ---

def _login(client, account: dict) -> dict:
    resp = client.post(
        "/api/v1/auth/login",
        json={"login_id": account["login_id"], "password": account["password"]},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _auth_header(client, account: dict) -> dict:
    token = _login(client, account)["access_token"]
    return {"Authorization": f"Bearer {token}"}
