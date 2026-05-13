# main.py
# Local development entry point for the MathQuest Wishlist Pricing Service.
#
# IN PRODUCTION this file is not used. The backend engineer imports wishlist_router
# directly into the existing backend FastAPI app:
#
#     from ai_agents.wishlist_agent import wishlist_router
#     app.include_router(wishlist_router)
#
# That mounts /internal/price-wish alongside all other backend routes so everything
# runs in one process — no separate server needed.
#
# Run locally (dev/testing only):
#     uvicorn main:app --host 0.0.0.0 --port 8001 --reload

from fastapi import FastAPI
from wishlist_agent import wishlist_router

# FastAPI — standalone dev app; title appears in the auto-generated /docs UI
app = FastAPI(title="MathQuest Wishlist Pricing Service (dev)")

app.include_router(wishlist_router)
