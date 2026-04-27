"""Unified API error shape.

Follows the TDD §10.1 contract::

    { "error": "<human message>", "code": "<SNAKE_CASE_CODE>", "status": <int> }

Any exception raised inside a route that is not an :class:`APIError` gets
converted to a generic ``internal_error`` by the exception handler wired in
:mod:`app.main`. Never leak raw stack traces in responses, but always log
them server-side so the operator can diagnose.
"""

from __future__ import annotations

import logging

from fastapi import Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class APIError(Exception):
    """Base class for every error we raise on purpose.

    Subclass, or instantiate directly with a specific code.
    """

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "bad_request"

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code


# --- Auth-specific errors ----------------------------------------------------


class InvalidCredentials(APIError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "invalid_credentials"


class EmailAlreadyRegistered(APIError):
    status_code = status.HTTP_409_CONFLICT
    code = "email_already_registered"


class WeakPassword(APIError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "weak_password"


class TermsNotAccepted(APIError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "terms_not_accepted"


class NotAuthenticated(APIError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "not_authenticated"


class InvalidRefreshToken(APIError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "invalid_refresh_token"


class AuthServiceUnavailable(APIError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "auth_service_unavailable"


# --- Authorization (caller is authenticated but not allowed) -----------------


class ForbiddenRole(APIError):
    """The caller's role does not permit this action.

    Distinct from :class:`NotAuthenticated`: the JWT is valid, but the role
    on the matching ``public.users`` row is wrong (e.g. a child trying to
    create another child, which only parents may do).
    """

    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden_role"


# --- Parent / child management -----------------------------------------------


class ChildCreateFailed(APIError):
    """Something went wrong creating the child after auth.users was made.

    Used to signal that the auth user was created but a downstream step
    (e.g. inserting into public.children) failed. The handler that raises
    this is responsible for rolling back the auth user so we don't leave
    a half-built account behind.
    """

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    code = "child_create_failed"


# --- Exception handlers ------------------------------------------------------


async def api_error_handler(_: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message, "code": exc.code, "status": exc.status_code},
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    # Log the full traceback server-side so the operator can diagnose,
    # but never return str(exc) or stack info to the client.
    logger.exception(
        "Unhandled exception on %s %s", request.method, request.url.path
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "An unexpected error occurred.",
            "code": "internal_error",
            "status": 500,
        },
    )
