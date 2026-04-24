"""Integration tests for /auth/*.

These tests hit a real Supabase project. See ``conftest.py`` for setup.

Test cases cover:

* Happy-path parent signup creates both ``auth.users`` and ``public.users``
  rows and returns a session.
* Duplicate email returns 409 ``email_already_registered``.
* Weak password returns 422 ``weak_password``.
* Terms-not-accepted returns 422 ``terms_not_accepted``.
* Login with correct credentials returns 200 + session.
* Login with wrong password returns 401 ``invalid_credentials`` and does
  NOT leak whether the email exists.
* ``/auth/me`` requires a bearer token and returns the DB-stored role
  (never a client-supplied one).
* **SC-06**: public signup can never produce ``role='child'``, even if the
  attacker crafts ``user_metadata.role='child'``.
"""

from __future__ import annotations

import secrets
import uuid

import pytest
from fastapi.testclient import TestClient


def _unique_email(prefix: str = "mq-test") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}@example.com"


def _valid_signup_payload(**overrides: object) -> dict:
    base = {
        "email": _unique_email(),
        "password": secrets.token_urlsafe(16),
        "display_name": "Parent McParentface",
        "terms_accepted": True,
    }
    base.update(overrides)
    return base


# --- signup ------------------------------------------------------------------


def test_signup_happy_path_creates_parent(
    client: TestClient, cleanup_users: list[str]
) -> None:
    payload = _valid_signup_payload()
    r = client.post("/auth/signup", json=payload)

    assert r.status_code == 201, r.text
    body = r.json()

    user = body["user"]
    cleanup_users.append(user["id"])

    assert user["email"] == payload["email"]
    assert user["role"] == "parent"
    assert user["display_name"] == payload["display_name"]
    assert user["parent_id"] is None

    # Session present => email confirmation is disabled in the test project.
    # If it's enabled, session will be null and this assertion must be
    # relaxed; document the expected env in conftest.
    assert body["session"] is not None
    assert body["session"]["token_type"] == "bearer"
    assert body["session"]["access_token"]


def test_signup_rejects_terms_not_accepted(client: TestClient) -> None:
    r = client.post("/auth/signup", json=_valid_signup_payload(terms_accepted=False))
    assert r.status_code == 422
    assert r.json()["code"] == "terms_not_accepted"


def test_signup_rejects_weak_password(
    client: TestClient, cleanup_users: list[str]
) -> None:
    r = client.post("/auth/signup", json=_valid_signup_payload(password="short"))
    # Pydantic catches the length constraint before it reaches Supabase.
    assert r.status_code in (422,)


def test_signup_rejects_duplicate_email(
    client: TestClient, cleanup_users: list[str]
) -> None:
    payload = _valid_signup_payload()
    r1 = client.post("/auth/signup", json=payload)
    assert r1.status_code == 201, r1.text
    cleanup_users.append(r1.json()["user"]["id"])

    r2 = client.post("/auth/signup", json=payload)
    assert r2.status_code == 409
    assert r2.json()["code"] == "email_already_registered"


# --- SC-06: child self-registration is blocked at system level --------------


def test_public_signup_cannot_produce_child_role(
    client: TestClient, cleanup_users: list[str]
) -> None:
    """Even if an attacker's payload tried to set role='child', the backend
    never passes that through; and even if they bypassed the backend and
    hit Supabase auth.signUp directly, the trigger reads role from
    app_metadata (service-role-only), not user_metadata.
    """
    from app.supabase_clients import get_admin_supabase, get_anon_supabase

    anon = get_anon_supabase()
    email = _unique_email("sc06")
    password = secrets.token_urlsafe(16)

    # Simulate the attacker's direct call to auth.signUp with crafted
    # user_metadata. Our trigger MUST ignore it and still create a parent.
    result = anon.auth.sign_up(
        {
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "role": "child",
                    "parent_id": str(uuid.uuid4()),
                    "display_name": "ShouldBeIgnored",
                }
            },
        }
    )
    assert result.user is not None
    cleanup_users.append(result.user.id)

    admin = get_admin_supabase()
    row = (
        admin.table("users")
        .select("role, parent_id")
        .eq("id", result.user.id)
        .single()
        .execute()
    ).data
    assert row["role"] == "parent", "trigger must default to parent for public signup"
    assert row["parent_id"] is None


# --- login -------------------------------------------------------------------


@pytest.fixture
def signed_up_parent(
    client: TestClient, cleanup_users: list[str]
) -> dict:
    payload = _valid_signup_payload()
    r = client.post("/auth/signup", json=payload)
    assert r.status_code == 201, r.text
    body = r.json()
    cleanup_users.append(body["user"]["id"])
    return {"payload": payload, "body": body}


def test_login_happy_path(client: TestClient, signed_up_parent: dict) -> None:
    p = signed_up_parent["payload"]
    r = client.post("/auth/login", json={"email": p["email"], "password": p["password"]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["email"] == p["email"]
    assert body["user"]["role"] == "parent"
    assert body["session"]["access_token"]


def test_login_wrong_password_returns_generic_error(
    client: TestClient, signed_up_parent: dict
) -> None:
    p = signed_up_parent["payload"]
    r = client.post(
        "/auth/login",
        json={"email": p["email"], "password": "definitely-wrong-" + secrets.token_hex(4)},
    )
    assert r.status_code == 401
    assert r.json()["code"] == "invalid_credentials"


def test_login_unknown_email_returns_same_error(client: TestClient) -> None:
    """UX-important: must not leak whether the email exists."""
    r = client.post(
        "/auth/login",
        json={"email": _unique_email("nope"), "password": secrets.token_urlsafe(16)},
    )
    assert r.status_code == 401
    assert r.json()["code"] == "invalid_credentials"


# --- /auth/me ----------------------------------------------------------------


def test_me_requires_bearer_token(client: TestClient) -> None:
    r = client.get("/auth/me")
    assert r.status_code == 401
    assert r.json()["code"] == "not_authenticated"


def test_me_returns_profile_for_valid_token(
    client: TestClient, signed_up_parent: dict
) -> None:
    token = signed_up_parent["body"]["session"]["access_token"]
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["role"] == "parent"
    assert body["email"] == signed_up_parent["payload"]["email"]


def test_me_rejects_garbage_token(client: TestClient) -> None:
    r = client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert r.status_code == 401
    assert r.json()["code"] == "not_authenticated"
