"""Integration tests for /parent/* and child login.

Covers:

* ``POST /parent/children`` — happy path, role gating, duplicate email,
  weak password, payload validation.
* The created child can log in via ``/auth/login`` and ``/auth/me``
  reports their role and parent_id correctly.
* ``GET /parent/settings`` — auto-created at signup, returns defaults.
* ``PATCH /parent/settings`` — partial update; out-of-range values
  rejected by Pydantic.
* Forbidden role: a child cannot create children, cannot read parent
  settings.

These hit the real Supabase project (see ``conftest.py``); each test
cleans up its created users via the ``cleanup_users`` fixture.
"""

from __future__ import annotations

import secrets
import uuid

import pytest
from fastapi.testclient import TestClient


# --- helpers -----------------------------------------------------------------


def _unique_email(prefix: str = "mq-test") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}@example.com"


def _parent_signup_payload() -> dict:
    return {
        "email": _unique_email("parent"),
        "password": secrets.token_urlsafe(16),
        "display_name": "Parent McParentface",
        "terms_accepted": True,
    }


def _child_create_payload(**overrides: object) -> dict:
    base = {
        "email": _unique_email("child"),
        "password": secrets.token_urlsafe(16),
        "display_name": "Kid Alex",
        "date_of_birth": "2017-05-14",
        "avatar_id": 3,
    }
    base.update(overrides)
    return base


@pytest.fixture
def signed_up_parent(client: TestClient, cleanup_users: list[str]) -> dict:
    """Create a fresh parent + return {payload, body, token}."""
    payload = _parent_signup_payload()
    r = client.post("/auth/signup", json=payload)
    assert r.status_code == 201, r.text
    body = r.json()
    cleanup_users.append(body["user"]["id"])
    return {
        "payload": payload,
        "body": body,
        "token": body["session"]["access_token"],
    }


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# --- POST /parent/children ---------------------------------------------------


def test_create_child_happy_path(
    client: TestClient,
    signed_up_parent: dict,
    cleanup_users: list[str],
) -> None:
    parent_id = signed_up_parent["body"]["user"]["id"]
    payload = _child_create_payload()

    r = client.post(
        "/parent/children",
        json=payload,
        headers=_auth_headers(signed_up_parent["token"]),
    )
    assert r.status_code == 201, r.text

    child = r.json()["child"]
    cleanup_users.append(child["user_id"])

    assert child["email"] == payload["email"]
    assert child["display_name"] == payload["display_name"]
    assert child["parent_id"] == parent_id
    assert child["avatar_id"] == payload["avatar_id"]
    assert child["date_of_birth"] == payload["date_of_birth"]
    # Defaults from the migration:
    assert child["current_zone"] == 1
    assert child["coins"] == 0
    assert child["total_xp"] == 0
    assert child["difficulty_ceiling"] == 10
    assert child["streak_current"] == 0
    assert child["streak_best"] == 0
    assert child["daily_coins_earned"] == 0
    assert child["current_difficulty"] == 1


def test_create_child_requires_bearer_token(client: TestClient) -> None:
    r = client.post("/parent/children", json=_child_create_payload())
    assert r.status_code == 401
    assert r.json()["code"] == "not_authenticated"


def test_create_child_rejects_when_caller_is_a_child(
    client: TestClient,
    signed_up_parent: dict,
    cleanup_users: list[str],
) -> None:
    """A child user, even with a valid bearer token, must not create children."""
    # First parent creates a child.
    child_payload = _child_create_payload()
    r = client.post(
        "/parent/children",
        json=child_payload,
        headers=_auth_headers(signed_up_parent["token"]),
    )
    assert r.status_code == 201, r.text
    cleanup_users.append(r.json()["child"]["user_id"])

    # Child logs in.
    login = client.post(
        "/auth/login",
        json={"email": child_payload["email"], "password": child_payload["password"]},
    )
    assert login.status_code == 200, login.text
    child_token = login.json()["session"]["access_token"]

    # Child tries to create another child — must be 403.
    r2 = client.post(
        "/parent/children",
        json=_child_create_payload(),
        headers=_auth_headers(child_token),
    )
    assert r2.status_code == 403
    assert r2.json()["code"] == "forbidden_role"


def test_create_child_rejects_duplicate_email(
    client: TestClient,
    signed_up_parent: dict,
    cleanup_users: list[str],
) -> None:
    payload = _child_create_payload()
    r1 = client.post(
        "/parent/children",
        json=payload,
        headers=_auth_headers(signed_up_parent["token"]),
    )
    assert r1.status_code == 201, r1.text
    cleanup_users.append(r1.json()["child"]["user_id"])

    r2 = client.post(
        "/parent/children",
        json=payload,
        headers=_auth_headers(signed_up_parent["token"]),
    )
    assert r2.status_code == 409
    assert r2.json()["code"] == "email_already_registered"


def test_create_child_rejects_weak_password(
    client: TestClient,
    signed_up_parent: dict,
) -> None:
    r = client.post(
        "/parent/children",
        json=_child_create_payload(password="short"),
        headers=_auth_headers(signed_up_parent["token"]),
    )
    # Pydantic catches the length constraint before Supabase does.
    assert r.status_code == 422


# --- Child can log in --------------------------------------------------------


def test_created_child_can_log_in(
    client: TestClient,
    signed_up_parent: dict,
    cleanup_users: list[str],
) -> None:
    child_payload = _child_create_payload()
    r = client.post(
        "/parent/children",
        json=child_payload,
        headers=_auth_headers(signed_up_parent["token"]),
    )
    assert r.status_code == 201, r.text
    child = r.json()["child"]
    cleanup_users.append(child["user_id"])
    parent_id = signed_up_parent["body"]["user"]["id"]

    # Log in as the child.
    login = client.post(
        "/auth/login",
        json={"email": child_payload["email"], "password": child_payload["password"]},
    )
    assert login.status_code == 200, login.text
    body = login.json()
    assert body["user"]["role"] == "child"
    assert body["user"]["parent_id"] == parent_id
    assert body["user"]["email"] == child_payload["email"]
    assert body["user"]["display_name"] == child_payload["display_name"]
    assert body["session"]["access_token"]

    # /auth/me with the child's token reports the same.
    me = client.get(
        "/auth/me",
        headers=_auth_headers(body["session"]["access_token"]),
    )
    assert me.status_code == 200
    assert me.json()["role"] == "child"
    assert me.json()["parent_id"] == parent_id


# --- /parent/settings --------------------------------------------------------


def test_parent_settings_auto_created_at_signup(
    client: TestClient,
    signed_up_parent: dict,
) -> None:
    """The signup trigger must seed a parent_settings row with TDD defaults."""
    parent_id = signed_up_parent["body"]["user"]["id"]
    parent_email = signed_up_parent["payload"]["email"]

    r = client.get("/parent/settings", headers=_auth_headers(signed_up_parent["token"]))
    assert r.status_code == 200, r.text
    s = r.json()

    assert s["parent_id"] == parent_id
    assert s["daily_limit_mins"] == 45
    assert s["session_limit_mins"] == 30
    assert s["auto_scaling"] is True
    assert s["difficulty_ceiling"] == 10
    assert s["star_threshold_coins"] == 500
    assert s["stars_earned"] == 0
    assert s["stars_redeemed"] == 0
    assert s["audio_volume"] == 80
    assert s["notification_email"] == parent_email


def test_parent_settings_patch_partial_update(
    client: TestClient,
    signed_up_parent: dict,
) -> None:
    r = client.patch(
        "/parent/settings",
        json={"daily_limit_mins": 60, "audio_volume": 50},
        headers=_auth_headers(signed_up_parent["token"]),
    )
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["daily_limit_mins"] == 60
    assert s["audio_volume"] == 50
    # Untouched fields keep their defaults.
    assert s["session_limit_mins"] == 30
    assert s["difficulty_ceiling"] == 10


def test_parent_settings_patch_rejects_out_of_range(
    client: TestClient,
    signed_up_parent: dict,
) -> None:
    r = client.patch(
        "/parent/settings",
        json={"difficulty_ceiling": 99},  # CHECK is 1..10
        headers=_auth_headers(signed_up_parent["token"]),
    )
    assert r.status_code == 422


def test_parent_settings_rejects_child_caller(
    client: TestClient,
    signed_up_parent: dict,
    cleanup_users: list[str],
) -> None:
    child_payload = _child_create_payload()
    r = client.post(
        "/parent/children",
        json=child_payload,
        headers=_auth_headers(signed_up_parent["token"]),
    )
    assert r.status_code == 201, r.text
    cleanup_users.append(r.json()["child"]["user_id"])

    login = client.post(
        "/auth/login",
        json={"email": child_payload["email"], "password": child_payload["password"]},
    )
    child_token = login.json()["session"]["access_token"]

    r = client.get("/parent/settings", headers=_auth_headers(child_token))
    assert r.status_code == 403
    assert r.json()["code"] == "forbidden_role"
