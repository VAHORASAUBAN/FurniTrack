"""Two isolation strategies, used by different test tiers:

`db_session` — a SQLAlchemy session bound to a SAVEPOINT inside an outer
transaction that's rolled back at teardown. Used by direct model/service/
engine-level tests (§11.1's real priority: posting rules, validators,
report correctness) that never touch HTTP or FastAPI's exception handling.

`client` — a plain TestClient against the real app and the real dev
database, used for HTTP-level tests (auth, routing, status codes). It does
NOT override get_db: FastAPI's yield-dependency cleanup interacting with a
savepoint session across exception-handled requests is fragile under time
pressure, so HTTP-tier tests instead use randomised test data (a uuid
suffix) plus explicit cleanup, accepting a small amount of DB churn in
exchange for exercising the real request/response path end-to-end.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.session import engine
from app.main import app


@pytest.fixture()
def db_session():
    connection = engine.connect()
    trans = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        trans.rollback()
        connection.close()


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def admin_auth_header(client):
    """Authorization header for the seeded admin (app/db/seed.py). Shared
    across HTTP-tier tests that need a real Admin-role token."""
    resp = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "Admin@12345"})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
