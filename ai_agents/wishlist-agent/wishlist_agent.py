# wishlist_agent.py
"""
Calls the Anthropic Claude API to price a child's wish in coins for MathQuest.
Exposes price_wish() — a plain function the backend imports and calls directly.
Returns a PriceResponse (wish_id, cost, category, reasoning). Never touches the
database — the backend writes the result. Always returns a value; falls back to
a safe default on any error so the backend is never left without a value to write.

Backend integration:
    from wishlist_agent import price_wish
    from wishlist_schemas import PriceRequest

    result = price_wish(PriceRequest(wish_id=..., title=..., grade=...))
"""

import os
import json
import logging
import traceback
import anthropic
from dotenv import load_dotenv
from wishlist_schemas import PriceRequest, PriceResponse
from wishlist_config import (
    MODEL,
    MAX_TOKENS,
    API_TIMEOUT,
    MAX_TITLE_LENGTH,
    FALLBACK_COST,
    FALLBACK_CATEGORY,
    FALLBACK_REASONING,
)

# Load from local .env first, then fall back to the shared ai_agents/.env
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# str — the exact system prompt sent to Claude on every request
# Cost bands and coin-earning rules are sourced from the AI engineer spec.
# Do not edit without updating the spec reference.
SYSTEM_PROMPT = """You are a reward-cost advisor for MathQuest, a math game for children.

A child earns coins by solving math questions:
- Correct answer: 10 coins
- Correct with insight (fast + no hints): 30 coins
- Correct after hint 1: 7 coins
- Correct after hint 2: 5 coins
- Correct after hint 3: 3 coins
- Daily cap: 500 coins per day

Your job: given a wish title and the child's school grade, suggest a coin cost.
The cost must be motivating but reachable — not frustrating, not trivial.

Cost bands:
- Small (screen time, snack, small treat): 200–500 coins (1–2 days of play)
- Medium (meal out, movie, activity, outing): 800–1500 coins (3–5 days)
- Large (toy, special trip, console game): 2000–5000 coins (1–3 weeks)

Respond ONLY with valid JSON. No preamble. No markdown fences. No explanation outside JSON.
Required schema:
{
  "cost": <integer>,
  "category": "screen_time" | "food" | "toy" | "experience" | "other",
  "reasoning": "<one sentence max>"
}"""

# dict — fallback payload used when Claude is unavailable or returns invalid data
FALLBACK = {
    "cost": FALLBACK_COST,
    "category": FALLBACK_CATEGORY,
    "reasoning": FALLBACK_REASONING,
}


def _sanitise_title(title: str) -> str:
    """
    What it does:
        Strips whitespace and truncates the wish title to the configured maximum.
        Returns an empty string when the title is blank after stripping, which
        signals the caller to skip the Claude call and return the fallback.

    Returns:
        str — stripped and truncated title, possibly empty

    Example input:
        "  Pizza night with the family and extra toppings please  "

    Example output:
        "Pizza night with the family and extra toppings please"
    """
    # str — whitespace stripped so "  " counts as empty
    stripped = title.strip()
    # str — truncated to the configured max; safe to slice even if shorter
    return stripped[:MAX_TITLE_LENGTH]


def _build_user_message(grade: int, title: str) -> str:
    """
    What it does:
        Assembles the user-turn message sent to Claude on every request.
        The format matches the example in the AI engineer spec exactly.

    Returns:
        str — the full user message passed in the messages array

    Example input:
        grade = 5, title = "Pizza night"

    Example output:
        'Child grade: 5\nWish: "Pizza night"'
    """
    # str — exact format from the spec; no extra whitespace
    return f'Child grade: {grade}\nWish: "{title}"'


def _parse_claude_response(text: str) -> dict:
    """
    What it does:
        Parses the JSON string Claude returns and extracts the three required fields.
        Raises on invalid JSON or missing keys — the caller's except block handles that.

    Returns:
        dict with keys: cost (int), category (str), reasoning (str)

    Example input:
        '{"cost": 1000, "category": "food", "reasoning": "A meal out is medium effort."}'

    Example output:
        {"cost": 1000, "category": "food", "reasoning": "A meal out is medium effort."}
    """
    # str — strip markdown fences Claude sometimes adds despite the system prompt
    clean = text.strip()
    if clean.startswith("```"):
        clean = clean.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    # dict — raw parsed JSON; raises json.JSONDecodeError on invalid input
    parsed = json.loads(clean)
    # dict — validated and typed fields; raises KeyError if Claude omits a field
    return {
        "cost": int(parsed["cost"]),
        "category": str(parsed["category"]),
        "reasoning": str(parsed["reasoning"]),
    }


def price_wish(req: PriceRequest) -> PriceResponse:
    """
    What it does:
        Sanitises the incoming wish title, calls Claude to get a coin price, and
        returns the result. On any failure it returns the fallback so the backend
        always gets a value to write to the database.
        The parent can manually adjust the cost if the fallback lands.

    Returns:
        PriceResponse — wish_id, cost, category, reasoning

    Example input:
        PriceRequest(wish_id="550e8400-...", title="Pizza night", grade=5)

    Example output (on success):
        PriceResponse(wish_id="550e8400-...", cost=1000, category="food", reasoning="...")

    Example output (on failure):
        PriceResponse(wish_id="550e8400-...", cost=500, category="other",
                      reasoning="Pricing unavailable — suggested default.")
    """
    try:
        # str — sanitised title; empty string triggers an immediate fallback
        title = _sanitise_title(req.title)
        if not title:
            return PriceResponse(wish_id=req.wish_id, **FALLBACK)

        # anthropic.Anthropic — reads ANTHROPIC_API_KEY from environment automatically;
        # never pass the key explicitly, never log it
        client = anthropic.Anthropic()

        # anthropic.types.Message — raises on any API or timeout error
        message = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            temperature=0,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _build_user_message(req.grade, title)}],
            timeout=API_TIMEOUT,
        )

        # dict — parsed fields from Claude's JSON response; raises on bad JSON or missing keys
        data = _parse_claude_response(message.content[0].text)

        return PriceResponse(wish_id=req.wish_id, **data)

    except Exception:
        # Log the full traceback so failures are visible in logs and during local runs.
        # We still return the fallback — the backend must always get a value to write.
        logging.error("price_wish failed for wish_id=%s — returning fallback\n%s",
                      req.wish_id, traceback.format_exc())
        return PriceResponse(wish_id=req.wish_id, **FALLBACK)
