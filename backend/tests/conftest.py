"""Shared pytest fixtures.

These are **integration tests**. They talk to a real Supabase project (the
dev one, configured via ``backend/.env.test``). Each test that creates a
user is responsible for cleaning up via the ``cleanup_users`` fixture.

Requirements for the test project:

* Email confirmation DISABLED (Dashboard → Auth → Providers → Email →
  Confirm email = off). Signup tests call ``sign_in_with_password``
  immediately after creation and need an active session.
* Migrations 0001 and 0002 applied.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def required_env() -> None:
    """Fail fast if the test project credentials are missing."""
    missing = [
        k
        for k in (
            "SUPABASE_URL",
            "SUPABASE_ANON_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
            "SUPABASE_JWT_SECRET",
        )
        if not os.environ.get(k)
    ]
    if missing:
        pytest.skip(
            "Integration tests need these env vars (usually in backend/.env.test): "
            + ", ".join(missing)
        )


@pytest.fixture(scope="session")
def client(required_env: None) -> Iterator[TestClient]:
    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c


@pytest.fixture
def cleanup_users(required_env: None) -> Iterator[list[str]]:
    """Accumulate user ids to delete after the test.

    Usage::

        def test_something(client, cleanup_users):
            r = client.post("/auth/signup", json={...})
            cleanup_users.append(r.json()["user"]["id"])
    """
    from app.supabase_clients import get_admin_supabase

    ids: list[str] = []
    yield ids

    admin = get_admin_supabase()
    for uid in ids:
        try:
            admin.auth.admin.delete_user(uid)
        except Exception:
            # Best effort; don't fail the test run on cleanup issues.
            pass
