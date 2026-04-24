"""Supabase client factories.

Two clients, with very different trust levels:

* :func:`get_admin_supabase` — uses ``SUPABASE_SERVICE_ROLE_KEY``. Bypasses
  RLS. Can call admin APIs (``auth.admin.create_user``, user listing, etc.).
  Use only in code paths that have already authorized the caller.

* :func:`get_anon_supabase` — uses ``SUPABASE_ANON_KEY``. Subject to RLS.
  Used to perform password sign-in on behalf of the end user. The caller's
  JWT can be attached for per-request authorization.

Do not log either client's response objects raw — they may include tokens.
"""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.settings import Settings, get_settings


@lru_cache(maxsize=1)
def get_admin_supabase() -> Client:
    """Return a Supabase client authenticated as the service role.

    This client can read and write any row regardless of RLS. Treat calls
    that use it as privileged.
    """
    s: Settings = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key.get_secret_value())


@lru_cache(maxsize=1)
def get_anon_supabase() -> Client:
    """Return a Supabase client authenticated as anon.

    Used for flows that the end user themselves is driving — primarily
    password sign-in. Subject to RLS.
    """
    s: Settings = get_settings()
    return create_client(s.supabase_url, s.supabase_anon_key.get_secret_value())


def reset_client_cache() -> None:
    """Clear cached clients. Test-only; not used in production code paths."""
    get_admin_supabase.cache_clear()
    get_anon_supabase.cache_clear()
