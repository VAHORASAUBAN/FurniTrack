"""Master-data regression tests focused on the parts with real logic —
generic CRUD wiring is exercised implicitly by every other test file that
creates fixtures through these endpoints, so this file targets the two
things that could silently regress: the Chart of Accounts single-flag-holder
rule (§2.3) and the Money serializer's fixed-2-decimals guarantee (§2.2),
whose absence was a real bug caught manually during the build (a freshly
created record's client-side-defaulted decimal serialised as "0" instead of
"0.00", inconsistent with every value that had round-tripped through MySQL).
"""
import base64
import uuid

# A real, minimal 1x1 PNG - valid enough for Pillow-free content-type/size
# checks; the upload endpoints never decode pixels, just store bytes.
_TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)

# Accounts created here are never cleaned up: there is no hard-delete
# endpoint by design (§2.9 — archive-only), so leftover test rows are inert.


def test_second_receivable_account_rejected(client, admin_auth_header):
    code = uuid.uuid4().hex[:6]
    resp = client.post(
        "/api/v1/accounts",
        json={"code": code, "name": f"Rogue Debtors {code}", "account_type": "ASSET", "is_receivable": True},
        headers=admin_auth_header,
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "RECEIVABLE_ALREADY_SET"


def test_second_payable_account_rejected(client, admin_auth_header):
    code = uuid.uuid4().hex[:6]
    resp = client.post(
        "/api/v1/accounts",
        json={"code": code, "name": f"Rogue Creditors {code}", "account_type": "LIABILITY", "is_payable": True},
        headers=admin_auth_header,
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PAYABLE_ALREADY_SET"


def test_account_without_flags_succeeds(client, admin_auth_header):
    code = uuid.uuid4().hex[:6]
    resp = client.post(
        "/api/v1/accounts",
        json={"code": code, "name": f"Misc Expense {code}", "account_type": "EXPENSE"},
        headers=admin_auth_header,
    )
    assert resp.status_code == 201, resp.text


def test_updating_an_account_to_receivable_when_taken_is_rejected(client, admin_auth_header):
    code = uuid.uuid4().hex[:6]
    create_resp = client.post(
        "/api/v1/accounts",
        json={"code": code, "name": f"Plain Asset {code}", "account_type": "ASSET"},
        headers=admin_auth_header,
    )
    account_id = create_resp.json()["id"]

    patch_resp = client.patch(
        f"/api/v1/accounts/{account_id}",
        json={"is_receivable": True},
        headers=admin_auth_header,
    )
    assert patch_resp.status_code == 409
    assert patch_resp.json()["error"]["code"] == "RECEIVABLE_ALREADY_SET"


def test_money_fields_always_serialise_with_two_decimals(client, admin_auth_header):
    """Regression for the bug found manually: a product created without an
    explicit tax_rate must still show "0.00", not "0" — the Pydantic field
    default is a bare `Decimal(0)` that never round-trips through MySQL's
    DECIMAL(5,2) column before being echoed back in the create response."""
    cat_resp = client.post(
        "/api/v1/product-categories",
        json={"name": f"TestCat {uuid.uuid4().hex[:6]}"},
        headers=admin_auth_header,
    )
    category_id = cat_resp.json()["id"]

    resp = client.post(
        "/api/v1/products",
        json={
            "name": f"Test Product {uuid.uuid4().hex[:6]}",
            "product_type": "GOODS",
            "category_id": category_id,
            "sales_price": "2000.00",
            "purchase_cost": "1200.00",
        },
        headers=admin_auth_header,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["default_tax_rate"] == "0.00"
    assert body["sales_price"] == "2000.00"
    assert body["purchase_cost"] == "1200.00"

    # And on a freshly-fetched (re-read from MySQL) copy, not just the echo:
    get_resp = client.get(f"/api/v1/products/{body['id']}", headers=admin_auth_header)
    assert get_resp.json()["default_tax_rate"] == "0.00"


def test_archived_account_excluded_from_default_list_but_visible_with_flag(client, admin_auth_header):
    code = uuid.uuid4().hex[:6]
    create_resp = client.post(
        "/api/v1/accounts",
        json={"code": code, "name": f"Temp Account {code}", "account_type": "EXPENSE"},
        headers=admin_auth_header,
    )
    account_id = create_resp.json()["id"]

    client.post(f"/api/v1/accounts/{account_id}/archive", headers=admin_auth_header)

    default_list = client.get(f"/api/v1/accounts?search={code}", headers=admin_auth_header).json()
    assert default_list["total"] == 0

    with_archived = client.get(
        f"/api/v1/accounts?search={code}&include_archived=true", headers=admin_auth_header
    ).json()
    assert with_archived["total"] == 1
    assert with_archived["items"][0]["is_active"] is False


def test_account_list_filters_by_account_type(client, admin_auth_header):
    code = uuid.uuid4().hex[:6]
    client.post(
        "/api/v1/accounts",
        json={"code": f"E{code}", "name": f"Expense {code}", "account_type": "EXPENSE"},
        headers=admin_auth_header,
    )
    client.post(
        "/api/v1/accounts",
        json={"code": f"I{code}", "name": f"Income {code}", "account_type": "INCOME"},
        headers=admin_auth_header,
    )

    expense_only = client.get(
        "/api/v1/accounts", params={"search": code, "account_type": "EXPENSE"}, headers=admin_auth_header
    ).json()
    assert expense_only["total"] == 1
    assert expense_only["items"][0]["account_type"] == "EXPENSE"

    both = client.get("/api/v1/accounts", params={"search": code}, headers=admin_auth_header).json()
    assert both["total"] == 2


def test_journal_list_filters_by_journal_type(client, admin_auth_header):
    code = uuid.uuid4().hex[:6]
    account_id = client.get("/api/v1/accounts?search=Bank", headers=admin_auth_header).json()["items"][0]["id"]
    client.post(
        "/api/v1/journals",
        json={"code": f"MISC{code}", "name": f"Misc {code}", "journal_type": "MISC", "default_account_id": account_id},
        headers=admin_auth_header,
    )

    resp = client.get(
        "/api/v1/journals", params={"search": code, "journal_type": "MISC"}, headers=admin_auth_header
    ).json()
    assert resp["total"] == 1
    assert resp["items"][0]["journal_type"] == "MISC"

    wrong_type = client.get(
        "/api/v1/journals", params={"search": code, "journal_type": "BANK"}, headers=admin_auth_header
    ).json()
    assert wrong_type["total"] == 0


def test_user_list_filters_by_role(client, admin_auth_header):
    suffix = uuid.uuid4().hex[:6]
    login_id = f"t{suffix}"
    client.post(
        "/api/v1/users",
        json={
            "name": f"Filter Test {suffix}", "login_id": login_id, "email": f"{suffix}@t.co",
            "password": "Passw0rd1", "password_confirm": "Passw0rd1", "role": "ACCOUNTANT", "contact_id": None,
        },
        headers=admin_auth_header,
    )

    accountants = client.get(
        "/api/v1/users", params={"search": login_id, "role": "ACCOUNTANT"}, headers=admin_auth_header
    ).json()
    assert accountants["total"] == 1

    admins_only = client.get(
        "/api/v1/users", params={"search": login_id, "role": "ADMIN"}, headers=admin_auth_header
    ).json()
    assert admins_only["total"] == 0


def test_contact_image_upload(client, admin_auth_header):
    suffix = uuid.uuid4().hex[:8]
    contact = client.post(
        "/api/v1/contacts",
        json={"name": f"Photo Contact {suffix}", "contact_type": "CUSTOMER", "email": f"{suffix}@t.co"},
        headers=admin_auth_header,
    ).json()["contact"]
    assert contact["profile_image_url"] is None

    upload_resp = client.post(
        f"/api/v1/contacts/{contact['id']}/image",
        files={"file": ("avatar.png", _TINY_PNG, "image/png")},
        headers=admin_auth_header,
    )
    assert upload_resp.status_code == 200, upload_resp.text
    image_url = upload_resp.json()["profile_image_url"]
    assert image_url.startswith("/static/")

    refreshed = client.get(f"/api/v1/contacts/{contact['id']}", headers=admin_auth_header).json()
    assert refreshed["profile_image_url"] == image_url


def test_contact_image_upload_rejects_wrong_content_type(client, admin_auth_header):
    suffix = uuid.uuid4().hex[:8]
    contact = client.post(
        "/api/v1/contacts",
        json={"name": f"Bad Photo Contact {suffix}", "contact_type": "CUSTOMER", "email": f"{suffix}@t.co"},
        headers=admin_auth_header,
    ).json()["contact"]

    upload_resp = client.post(
        f"/api/v1/contacts/{contact['id']}/image",
        files={"file": ("notes.txt", b"not an image", "text/plain")},
        headers=admin_auth_header,
    )
    assert upload_resp.status_code == 400
    assert upload_resp.json()["error"]["code"] == "UNSUPPORTED_IMAGE_TYPE"


def test_product_image_upload(client, admin_auth_header):
    suffix = uuid.uuid4().hex[:8]
    product = client.post(
        "/api/v1/products",
        json={"name": f"Photo Product {suffix}", "product_type": "GOODS"},
        headers=admin_auth_header,
    ).json()
    assert product["image_url"] is None

    upload_resp = client.post(
        f"/api/v1/products/{product['id']}/image",
        files={"file": ("product.png", _TINY_PNG, "image/png")},
        headers=admin_auth_header,
    )
    assert upload_resp.status_code == 200, upload_resp.text
    image_url = upload_resp.json()["image_url"]
    assert image_url.startswith("/static/")

    refreshed = client.get(f"/api/v1/products/{product['id']}", headers=admin_auth_header).json()
    assert refreshed["image_url"] == image_url


def test_product_image_upload_rejects_oversized_file(client, admin_auth_header):
    suffix = uuid.uuid4().hex[:8]
    product = client.post(
        "/api/v1/products",
        json={"name": f"Big Photo Product {suffix}", "product_type": "GOODS"},
        headers=admin_auth_header,
    ).json()

    oversized = b"\x00" * (3 * 1024 * 1024)  # over the 2MB default limit
    upload_resp = client.post(
        f"/api/v1/products/{product['id']}/image",
        files={"file": ("huge.png", oversized, "image/png")},
        headers=admin_auth_header,
    )
    assert upload_resp.status_code == 400
    assert upload_resp.json()["error"]["code"] == "IMAGE_TOO_LARGE"
