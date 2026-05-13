# wishlist_schemas.py
# Pydantic models for the MathQuest Wishlist Pricing Service.
# Imported by wishlist_agent.py for request validation and response serialisation.
# File is agent-prefixed to avoid sys.modules collisions when multiple agents share sys.path.

from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------


class PriceRequest(BaseModel):
    # What: validates the JSON body the backend sends to /internal/price-wish.
    # Extra fields are silently ignored by Pydantic — enforces the "no PII" rule from the spec.

    wish_id: str   # str — UUID identifying the wish row
    title: str     # str — the child's wish text (e.g. "Pizza night")
    grade: int     # int — the child's school grade (1–12)


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------


class PriceResponse(BaseModel):
    # What: defines the shape returned to the backend on both success and fallback.
    # The backend writes these four fields directly to the wish_items row.

    wish_id: str    # str — echoed back so the backend knows which row to update
    cost: int       # int — coin cost (200–5000 on success, 500 on fallback)
    category: str   # str — one of screen_time | food | toy | experience | other
    reasoning: str  # str — one-sentence explanation shown to the parent
