"""Request authentication: verifying the Supabase JWT on incoming calls.

The frontend sends the access token it received from ``POST /auth/login`` in
the ``Authorization: Bearer <token>`` header. We verify the signature and
return a lightweight :class:`AuthUser` to downstream handlers.

Supabase projects can issue access tokens under two different signing
schemes:

* **ES256 / RS256 (asymmetric, current default).** The project has a key
  pair; the private key stays with Supabase, and the public key is
  published at ``<project>/auth/v1/.well-known/jwks.json``. Each token
  header carries a ``kid`` (key id) naming the key that signed it. We
  fetch the JWKS, cache it for 10 minutes, pick the matching key by
  ``kid``, and verify.
* **HS256 (legacy, symmetric).** One shared secret that signs and
  verifies. Provided via ``SUPABASE_JWT_SECRET``. Still supported here
  for backward compatibility with older projects.

We deliberately do NOT trust any custom claim the client might set. The
role is re-read from ``public.users`` on every call that needs it.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JWTError

from app.errors import NotAuthenticated
from app.settings import Settings, get_settings

logger = logging.getLogger(__name__)

# --- JWKS cache --------------------------------------------------------------

_JWKS_TTL_SECONDS = 600  # 10 minutes.

# Module-level cache. Process-local; fine since JWKS reads are cheap and
# each uvicorn worker will warm its own cache on the first auth'd request.
_jwks_cache: dict[str, Any] = {"keys": [], "fetched_at": 0.0, "base_url": ""}


def _fetch_jwks(base_url: str) -> list[dict]:
    """Fetch the JSON Web Key Set from Supabase Auth."""
    url = f"{base_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    resp = httpx.get(url, timeout=5.0)
    resp.raise_for_status()
    data = resp.json()
    keys = data.get("keys")
    if not isinstance(keys, list):
        raise ValueError("Malformed JWKS response: 'keys' is not a list.")
    return keys


def _get_jwks(base_url: str, *, force_refresh: bool = False) -> list[dict]:
    """Return the cached JWKS, refetching if stale or if forced."""
    now = time.time()
    stale = (now - _jwks_cache["fetched_at"]) > _JWKS_TTL_SECONDS
    different_project = _jwks_cache["base_url"] != base_url
    if force_refresh or stale or different_project or not _jwks_cache["keys"]:
        _jwks_cache["keys"] = _fetch_jwks(base_url)
        _jwks_cache["fetched_at"] = now
        _jwks_cache["base_url"] = base_url
    return _jwks_cache["keys"]


def _find_key(keys: list[dict], kid: str | None) -> dict | None:
    if kid is None:
        return None
    return next((k for k in keys if k.get("kid") == kid), None)


# --- Verification ------------------------------------------------------------


@dataclass(frozen=True)
class AuthUser:
    """A verified caller. ``id`` matches ``auth.users.id`` and ``public.users.id``."""

    id: uuid.UUID
    email: str | None


def _decode(token: str, settings: Settings) -> dict:
    try:
        headers = jwt.get_unverified_header(token)
    except JWTError as e:
        raise NotAuthenticated("Malformed access token.") from e

    alg = headers.get("alg")
    kid = headers.get("kid")

    common_opts = {
        "options": {"verify_aud": True, "require_sub": True, "require_exp": True},
        "audience": "authenticated",
    }

    if alg == "HS256":
        # Legacy symmetric verification.
        secret = settings.supabase_jwt_secret.get_secret_value()
        try:
            return jwt.decode(token, secret, algorithms=["HS256"], **common_opts)
        except JWTError as e:
            raise NotAuthenticated("Invalid or expired access token.") from e

    if alg in ("ES256", "RS256", "EdDSA"):
        # Asymmetric verification via JWKS.
        keys = _get_jwks(settings.supabase_url)
        key = _find_key(keys, kid)
        if key is None:
            # The key may have been rotated since our last fetch.
            keys = _get_jwks(settings.supabase_url, force_refresh=True)
            key = _find_key(keys, kid)
        if key is None:
            logger.warning("JWT verification failed: unknown kid %r", kid)
            raise NotAuthenticated("Unknown signing key.")
        try:
            return jwt.decode(token, key, algorithms=[alg], **common_opts)
        except JWTError as e:
            raise NotAuthenticated("Invalid or expired access token.") from e

    raise NotAuthenticated(f"Unsupported signing algorithm: {alg!r}")


# HTTPBearer declares the "bearerAuth" security scheme in the OpenAPI
# spec, which is what makes the 🔒 Authorize button appear in Swagger UI
# and attaches the lock icon to protected endpoints.
#
# auto_error=False: we raise our own NotAuthenticated (to match the
# TDD §10 error shape) instead of FastAPI's default HTTPException.
_bearer_scheme = HTTPBearer(bearerFormat="JWT", auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthUser:
    """Dependency: extract and verify the bearer token, return the user.

    Raises :class:`NotAuthenticated` if the header is missing or the token
    does not verify.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise NotAuthenticated("Missing Authorization: Bearer <token> header.")

    claims = _decode(credentials.credentials, settings)

    sub = claims.get("sub")
    if not sub:
        raise NotAuthenticated("Token has no subject claim.")

    try:
        user_id = uuid.UUID(sub)
    except ValueError as e:
        raise NotAuthenticated("Token subject is not a valid UUID.") from e

    return AuthUser(id=user_id, email=claims.get("email"))
