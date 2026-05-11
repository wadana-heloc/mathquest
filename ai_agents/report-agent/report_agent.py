# report_agent.py
# The MathQuest report agent — generates a ~280-word progress report for a
# parent based on their child's recent game activity.
# Single-turn call: one JSON payload in, one formatted report string out.
# Prompt caching is applied to the system prompt to minimise input token costs.
# Set MOCK_API=true in .env to skip the real API during development and tests.

import os
import json

import anthropic
from dotenv import load_dotenv

from config import MODEL_NAME, MAX_TOKENS, PROMPT_CACHING_ENABLED
from constants import ALL_TRICKS, BASE_SYSTEM_PROMPT
from schemas import ReportPayload

# Load ANTHROPIC_API_KEY and MOCK_API from the .env file at import time
load_dotenv()


# ---------------------------------------------------------------------------
# Mock fixture — returned when MOCK_API=true in .env.
# A realistic sample report so the rest of the system can be tested end-to-end
# without burning API tokens.
# ---------------------------------------------------------------------------

# str — hardcoded sample report used in mock mode
_MOCK_REPORT_FIXTURE = """\
**What's Going Well**
Yusuf is thriving in arithmetic — 85% accuracy across 40 problems is a genuine strength. He is also making real progress overall, solving 87 problems this month with a trend that is moving in the right direction.

**Where to Focus**
Pattern and mental math are the areas to work on. He answered pattern questions correctly only 41% of the time, often struggling with problems like "What is 11 × 47?" — which he has failed more than once. Invariant reasoning (30% accuracy) is also tough for him right now, though it is still early.

**How They Learn**
Yusuf uses hints sparingly (0.4 per problem on average), which suggests he prefers to try on his own before asking for help — a good habit. His accuracy drops noticeably at difficulty level 4 (51%), so he benefits from consolidating at level 3 before pushing higher.

**Tricks to Watch**
He is currently practising the ×11 Digit-Sum Rule (A1), which teaches that 11 × a two-digit number hides the digit sum in the middle. At 44% practice accuracy, he is getting the idea but needs more repetition. He has already unlocked Doubling Chains (A3) and ×5 via Half-of-Ten (C5) — both are solid wins.

**Tips for You (the Parent)**
Ask Yusuf "what is 11 × 36?" at the dinner table and let him narrate it: first digit, add the digits, last digit. Pause before giving any hints. When he gets it right, ask what would change if the digit sum were more than 9. On a car ride, point to a number plate and say "if I multiply that number by 9, is the answer odd or even, and how do you know?" Finally, count objects in groups and ask him to estimate the total before counting — this builds the Estimation and Bounds intuition he needs.\
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _filter_trick_lines(encountered_ids: set) -> str:
    # What: filters ALL_TRICKS to only the tricks in encountered_ids and formats
    #       them as "ID — Name: Description" lines for insertion into the system prompt.
    #       Sending only relevant tricks keeps the prompt compact and focused.
    # Return: str — newline-joined trick reference lines, or an empty string if none match
    # Example input: {"A1", "C5", "A3"}
    # Example output: "A1 — ×11 Digit-Sum Rule: 11 × AB = ...\nA3 — Doubling Chains: ..."

    # list[str] — formatted trick lines for each trick the child has encountered
    lines = [
        f"{t['id']} — {t['name']}: {t['description']}"
        for t in ALL_TRICKS
        if t["id"] in encountered_ids
    ]

    # str — joined lines ready for prompt insertion
    return "\n".join(lines)


def _build_system_prompt(trick_lines: str) -> list:
    # What: injects the filtered trick lines into BASE_SYSTEM_PROMPT and wraps
    #       the result in the Anthropic content block format. Adds cache_control
    #       when prompt caching is enabled so Anthropic reuses the cached version
    #       within a 5-minute window, avoiding re-charging input tokens.
    # Return: list[dict] — Anthropic system content block(s)
    # Example input: "A1 — ×11 Digit-Sum Rule: ..."
    # Example output: [{"type": "text", "text": "...", "cache_control": {"type": "ephemeral"}}]

    # str — system prompt with trick lines substituted in
    prompt_text = BASE_SYSTEM_PROMPT.replace("{INSERT_FILTERED_TRICK_LINES}", trick_lines)

    # dict — base content block for the system prompt
    block = {"type": "text", "text": prompt_text}

    if PROMPT_CACHING_ENABLED:
        # cache_control marks this block for Anthropic's 5-minute prompt cache
        block["cache_control"] = {"type": "ephemeral"}

    # list[dict] — Anthropic expects system as a list of content blocks
    return [block]


def _build_user_message(payload: ReportPayload) -> str:
    # What: serialises the validated ReportPayload to JSON and wraps it in the
    #       user-turn message the agent receives. This is the only user message.
    # Return: str — the full user message text
    # Example input: ReportPayload(child=ChildInfo(name="Yusuf", ...), ...)
    # Example output: "Generate the progress report for this child:\n\n{...json...}"

    # dict — payload serialised to a plain dict for JSON encoding
    payload_dict = payload.model_dump()

    # str — the user message combining the instruction and the JSON data
    return f"Generate the progress report for this child:\n\n{json.dumps(payload_dict, indent=2)}"


def generate_report(payload: dict | ReportPayload) -> dict:
    # What: main entry point. Accepts either a raw dict (validated internally)
    #       or a pre-validated ReportPayload. Filters the trick reference, builds
    #       the prompt, and calls Claude. Always generates a report regardless of
    #       attempt count. In mock mode (MOCK_API=true), skips the API entirely.
    # Return: dict — {"report": str} on success, {"report": None, "reason": "api_error"} on failure
    # Example input: {"child": {"name": "Yusuf", ...}, "overall": {"attempts": 87, ...}, ...}
    # Example output: {"report": "**What's Going Well**\nYusuf is thriving in arithmetic..."}

    # ReportPayload — validated model; raises ValidationError on bad input
    if not isinstance(payload, ReportPayload):
        payload = ReportPayload.model_validate(payload)

    # bool — skip the real API and return a hardcoded fixture when True
    mock_mode = os.getenv("MOCK_API", "false").lower() == "true"
    if mock_mode:
        return {"report": _MOCK_REPORT_FIXTURE}

    # set[str] — IDs of tricks this child has encountered (unlocked + in_progress)
    encountered_ids = set(payload.tricks.unlocked) | {
        t.id for t in payload.tricks.in_progress
    }

    # str — filtered trick reference lines for the system prompt
    trick_lines = _filter_trick_lines(encountered_ids)

    # list[dict] — system prompt content blocks, with caching if enabled
    system_blocks = _build_system_prompt(trick_lines)

    # str — user message containing the full payload JSON
    user_text = _build_user_message(payload)

    # str — Anthropic API key from environment; never hardcoded
    api_key = os.getenv("ANTHROPIC_API_KEY")

    # anthropic.Anthropic — API client; created inside the function so mock mode never touches it
    client = anthropic.Anthropic(api_key=api_key)

    try:
        # anthropic.types.Message — raw API response
        response = client.messages.create(
            model=MODEL_NAME,
            max_tokens=MAX_TOKENS,
            system=system_blocks,
            messages=[{"role": "user", "content": user_text}],
        )

        # str — the text content of the agent's response
        report = "".join(
            block.text for block in response.content if block.type == "text"
        )

        return {"report": report}

    except Exception as exc:
        print(f"[ReportAgent] failed: {type(exc).__name__}: {exc}")
        return {"report": None, "reason": "api_error"}
