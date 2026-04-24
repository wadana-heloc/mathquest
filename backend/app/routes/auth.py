"""Authentication endpoints.

Design decisions — see ``docs/auth-flow.md``:

* The frontend never talks to Supabase Auth directly. It always posts to
  this API. That lets us enforce SC-06 (no child self-registration), apply
  server-side validation, shape errors per TDD §10, and keep the ``role`` a
  trusted value.

* Signup creates the parent via the admin API so we can set
  ``app_metadata.role='parent'``. ``raw_user_meta_data`` (user-writable) is
  used only for ``display_name``.

* Login uses the anon client's ``sign_in_with_password``. The Supabase JS
  semantics are identical to what the browser would do, but going through
  the backend lets us swap to httpOnly cookies later without a client
  change.

* Logout revokes the refresh token server-side. A stolen access token
  cannot be actively invalidated (JWTs are stateless), but revoking the
  refresh token stops rotation.
"""

from __future__ import annotations

import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials
from gotrue.errors import AuthApiError  # type: ignore[import-not-found]

# AuthWeakPasswordError was added in a later gotrue release. If the installed
# version is too old to have it, fall back to the base class so `except`
# clauses still work (they just won't match anything, which is harmless —
# weak-password errors will surface as AuthApiError instead).
try:
    from gotrue.errors import AuthWeakPasswordError  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover
    class AuthWeakPasswordError(AuthApiError):  # type: ignore[no-redef]
        pass

from app.errors import (
    AuthServiceUnavailable,
    EmailAlreadyRegistered,
    InvalidCredentials,
    InvalidRefreshToken,
    NotAuthenticated,
    TermsNotAccepted,
    WeakPassword,
)
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    Session,
    SignupRequest,
    UserPublic,
)
from app.security import AuthUser, _bearer_scheme, get_current_user
from app.settings import Settings, get_settings
from app.supabase_clients import get_admin_supabase, get_anon_supabase

router = APIRouter(prefix="/auth", tags=["auth"])


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def _session_from_supabase(session: Any) -> Session:
    """Convert a supabase-py Session object to our wire shape."""
    return Session(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_in=session.expires_in,
        expires_at=session.expires_at,
    )


def _fetch_profile(user_id: uuid.UUID) -> UserPublic:
    """Read the caller's own row from ``public.users``.

    Uses the admin client for reliability (the trigger may have just
    inserted the row in the same request, and we don't want to race RLS).
    """
    res = (
        get_admin_supabase()
        .table("users")
        .select("id, email, role, display_name, parent_id, created_at, last_active_at")
        .eq("id", str(user_id))
        .limit(1)
        .execute()
    )
    if not res.data:
        # Should be impossible: the trigger runs in the same tx as auth.users insert.
        raise NotAuthenticated("Profile row missing for authenticated user.")
    return UserPublic.model_validate(res.data[0])


# -----------------------------------------------------------------------------
# POST /auth/signup  — parent signup
# -----------------------------------------------------------------------------


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new parent account.",
)
async def signup(payload: SignupRequest) -> AuthResponse:
    """Create a parent account.

    * ``role`` is forced to ``'parent'`` server-side (SC-06).
    * ``display_name`` is stored in ``raw_user_meta_data`` and copied into
      ``public.users.display_name`` by the ``handle_new_user`` trigger.
    * If the Supabase project has email confirmation enabled, the response
      will have ``session=null`` and the user must click the email link
      before they can log in.
    """
    if not payload.terms_accepted:
        raise TermsNotAccepted(
            "You must confirm you are a parent or guardian to create an account."
        )

    admin = get_admin_supabase()

    try:
        result = admin.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                # In dev we skip email verification so developers can iterate.
                # Toggle this via the Supabase dashboard for prod (Settings
                # → Authentication → Email provider → Confirm email).
                "email_confirm": True,
                "app_metadata": {
                    "role": "parent",
                    "display_name": payload.display_name,
                },
                "user_metadata": {"display_name": payload.display_name},
            }
        )
    except AuthWeakPasswordError as e:
        raise WeakPassword(str(e)) from e
    except AuthApiError as e:
        # Supabase returns 422 with this message for the duplicate-email case.
        msg = (getattr(e, "message", None) or str(e)).lower()
        if "already" in msg and ("registered" in msg or "exists" in msg):
            raise EmailAlreadyRegistered(
                "An account with that email already exists."
            ) from e
        if "password" in msg and ("short" in msg or "weak" in msg):
            raise WeakPassword(str(e)) from e
        raise

    created = result.user
    if created is None:
        # Defensive: supabase-py returns user=None on unknown error shapes.
        raise EmailAlreadyRegistered(
            "The account could not be created. It may already exist."
        )

    profile = _fetch_profile(uuid.UUID(created.id))

    # admin.create_user does not produce a session. To give the UI an
    # immediate signed-in experience (dev-friendly), sign in right after.
    anon = get_anon_supabase()
    try:
        sign_in = anon.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
        session = _session_from_supabase(sign_in.session) if sign_in.session else None
    except AuthApiError:
        # Email confirmation is likely enabled. Return without a session;
        # the client should show a "check your email" screen.
        session = None

    return AuthResponse(user=profile, session=session)


# -----------------------------------------------------------------------------
# POST /auth/login  — parent or child
# -----------------------------------------------------------------------------


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Log in with email + password.",
)
async def login(payload: LoginRequest) -> AuthResponse:
    """Authenticate a user and return an access/refresh token pair."""
    anon = get_anon_supabase()
    try:
        result = anon.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
    except AuthApiError as e:
        # Supabase uses the same generic "Invalid login credentials" for
        # wrong-password AND unknown-email, which is the correct UX — do
        # not leak whether the email exists.
        raise InvalidCredentials("Invalid email or password.") from e

    if not result.user or not result.session:
        raise InvalidCredentials("Invalid email or password.")

    profile = _fetch_profile(uuid.UUID(result.user.id))
    return AuthResponse(user=profile, session=_session_from_supabase(result.session))


# -----------------------------------------------------------------------------
# POST /auth/refresh  — exchange a refresh token for a fresh pair
# -----------------------------------------------------------------------------


@router.post(
    "/refresh",
    response_model=AuthResponse,
    summary="Rotate the access/refresh token pair.",
)
async def refresh(
    payload: RefreshRequest,
    settings: Settings = Depends(get_settings),
) -> AuthResponse:
    """Exchange a valid refresh_token for a fresh access_token + refresh_token.

    Call this whenever the access_token is near expiry (default TTL 1h).
    The old refresh_token is invalidated on success; store the new one
    and discard the old.

    Not Bearer-authenticated — the refresh_token IS the credential. A
    valid refresh_token proves the caller's identity without a live
    access_token.
    """
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/token"
    try:
        resp = httpx.post(
            url,
            params={"grant_type": "refresh_token"},
            headers={
                "apikey": settings.supabase_anon_key.get_secret_value(),
                "Content-Type": "application/json",
            },
            json={"refresh_token": payload.refresh_token},
            timeout=5.0,
        )
    except httpx.RequestError as e:
        raise AuthServiceUnavailable(
            "Auth service is unreachable. Try again shortly."
        ) from e

    if resp.status_code != 200:
        # 400/401 from GoTrue when the refresh_token is unknown, already
        # used, or expired. We collapse those into a single response to
        # avoid leaking which specific failure mode occurred.
        raise InvalidRefreshToken(
            "The refresh token is invalid or has expired. Please log in again."
        )

    body = resp.json()
    try:
        user_id = uuid.UUID(body["user"]["id"])
    except (KeyError, ValueError, TypeError) as e:
        # Defensive: GoTrue returned 200 with an unexpected shape.
        raise InvalidRefreshToken("Unexpected auth service response.") from e

    profile = _fetch_profile(user_id)
    session = Session(
        access_token=body["access_token"],
        refresh_token=body["refresh_token"],
        expires_in=body["expires_in"],
        expires_at=body["expires_at"],
    )
    return AuthResponse(user=profile, session=session)


# -----------------------------------------------------------------------------
# POST /auth/logout
# -----------------------------------------------------------------------------


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke the caller's refresh token.",
)
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    current: AuthUser = Depends(get_current_user),  # verifies the JWT first
    settings: Settings = Depends(get_settings),
) -> None:
    """Invalidate the current session on the server side.

    Hits the GoTrue ``/auth/v1/logout`` endpoint with the caller's own
    access token (``scope=global`` revokes every refresh token for this
    user, across all their devices). The access token (JWT) remains
    valid until it expires on its own — there is no server-side
    blocklist by design. Revoking the refresh token is what stops
    further token rotation.
    """
    del current  # only used for its side effect: verifying the JWT.

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/logout"
    try:
        httpx.post(
            url,
            params={"scope": "global"},
            headers={
                "Authorization": f"Bearer {credentials.credentials}",
                "apikey": settings.supabase_anon_key.get_secret_value(),
            },
            timeout=5.0,
        )
        # Intentionally ignore the response: if the token was already
        # revoked (e.g. double-logout), GoTrue returns 401, which is
        # still a "logged out" end-state.
    except httpx.RequestError:
        # Network blip — swallow. The caller is logging out anyway.
        pass


# -----------------------------------------------------------------------------
# GET /auth/me
# -----------------------------------------------------------------------------


@router.get(
    "/me",
    response_model=UserPublic,
    summary="Return the caller's profile.",
)
async def me(current: AuthUser = Depends(get_current_user)) -> UserPublic:
    """Return ``public.users`` row for the caller.

    The ``role`` field in the response is the DB-derived value (never trust
    a client-supplied role claim — see TDD §9.1).
    """
    return _fetch_profile(current.id)
