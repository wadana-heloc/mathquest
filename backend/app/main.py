"""FastAPI application entry point.

Run locally::

    cd backend
    python -m venv .venv && source .venv/Scripts/activate   # Windows bash
    pip install -e ".[dev]"
    cp .env.example .env  # fill in Supabase keys
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.errors import APIError, api_error_handler, unhandled_error_handler
from app.routes import auth as auth_routes
from app.settings import get_settings


def _configure_logging(env: str) -> None:
    """Send ``logging`` output to stdout so uvicorn prints it."""
    level = logging.DEBUG if env == "dev" else logging.INFO
    # force=True replaces any handler uvicorn installed first.
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
        force=True,
    )


def create_app() -> FastAPI:
    settings = get_settings()
    _configure_logging(settings.app_env)

    app = FastAPI(
        title="MathQuest API",
        version=__version__,
        docs_url="/docs" if settings.app_env == "dev" else None,
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.add_exception_handler(APIError, api_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unhandled_error_handler)

    app.include_router(auth_routes.router)

    @app.get("/healthz", tags=["meta"])
    async def healthz() -> dict[str, str]:
        """Liveness probe. Returns 200 whenever the process is up."""
        return {"status": "ok", "version": __version__}

    return app


app = create_app()
