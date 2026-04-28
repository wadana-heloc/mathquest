# agent_generator.py
# Agent 1 (Generator) in the MathQuest pipeline.
# Receives the child profile, difficulty target, and eligible tricks from the
# orchestrator, then calls Claude to produce one math problem as a JSON object.
# Returns the parsed problem dict, or None if the API call or JSON parsing fails.
# Prompt caching is applied to the system prompt to minimise input token costs
# on repeated calls. Set MOCK_API=true in .env to skip the real API entirely.

import os
import json
from pathlib import Path

import anthropic
from dotenv import load_dotenv

from config import (
    MODEL_NAME,
    AGENT1_MAX_TOKENS,
    PROMPT_CACHING_ENABLED,
    RECENT_PROBLEMS_CAP,
)
from schemas import ChildProfileInput

# Load ANTHROPIC_API_KEY and MOCK_API from the .env file at import time
load_dotenv()


# ---------------------------------------------------------------------------
# Tricks reference — loaded once at import time, keyed by trick_id.
# Using a dict gives O(1) lookup when filtering to eligible tricks.
# ---------------------------------------------------------------------------

def _load_tricks_reference() -> dict:
    # What: reads tricks/tricks_reference.json and returns a dict keyed by trick_id.
    #       Called once at module level so the file is never re-read per request.
    # Return: dict[str, dict] — {trick_id: full trick object}
    # Example input: (no args — reads from fixed path relative to this file)
    # Example output: {"A1": {"trick_id": "A1", "name": "...", ...}, ...}

    # Path — absolute path to the tricks reference file
    tricks_path = Path(__file__).parent / "tricks" / "tricks_reference.json"

    # str — raw JSON text from file
    raw = tricks_path.read_text(encoding="utf-8")

    # list[dict] — all 25 trick objects from the JSON array
    tricks_list = json.loads(raw)["tricks"]

    # dict[str, dict] — keyed by trick_id for fast lookup
    return {t["trick_id"]: t for t in tricks_list}


# dict[str, dict] — module-level tricks reference, loaded once on import
_TRICKS_BY_ID = _load_tricks_reference()


# ---------------------------------------------------------------------------
# Mock fixture — returned when MOCK_API=true in .env.
# Must be a fully valid ProblemOutput-compatible dict so downstream
# Pydantic validation and the reviewer agent work correctly in mock mode.
# ---------------------------------------------------------------------------

# dict — hardcoded fixture problem for trick A1 (×11 Digit-Sum Rule)
_MOCK_PROBLEM_FIXTURE = {
    "id": "mock_001",
    "zone": 2,
    "category": "pattern",
    "difficulty": 4,
    "trick_id": "A1",
    "stem": "The vault door reads: 11 × 23 = ?",
    "answer": 253,
    "answer_type": "exact",
    "brute_force_path": "10 × 23 + 1 × 23 = 230 + 23 = 253",
    "shortcut_path": "Digit-sum: 2 + 3 = 5. Sandwich the sum between the digits: 2(5)3 = 253.",
    "shortcut_time_threshold_ms": 3000,
    "hints": [
        {"level": 1, "text": "What do you notice about the digits of 23?", "cost": 0},
        {"level": 2, "text": "Try adding the two digits of 23 together.", "cost": 5},
        {"level": 3, "text": "Place that sum between the original digits.", "cost": 15},
    ],
    "aha_moment": "When multiplying by 11, the middle digit is always the sum of the two outer digits.",
    "flavor_text": "The ancient vault cipher displays 11 × 23. Solve it to open the door.",
    "tags": ["multiplication", "×11", "two-digit", "zone-2"],
    "estimated_brute_force_seconds": 10,
    "estimated_trick_seconds": 2,
}


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------

# str — static system prompt text, shared across all Agent 1 calls.
# Contains the role, output schema, and rules — never child-specific data.
# Kept as a module-level constant so it is assembled once, not on every call.
_SYSTEM_PROMPT_TEXT = """You are Agent 1 (Generator) in the MathQuest pipeline.
MathQuest is a math adventure game for children that teaches mental shortcuts through story-driven puzzles.

Your task: generate exactly ONE math problem as a raw JSON object.

## Output Schema
Return ONLY a raw JSON object. No markdown fences, no explanation, no extra text — just the JSON.
Every field listed below is required.

{
  "id": "p_001",
  "zone": 2,
  "category": "pattern",
  "difficulty": 4,
  "trick_id": "A1",
  "stem": "The vault door reads: 11 × 23 = ?",
  "answer": 253,
  "answer_type": "exact",
  "brute_force_path": "10 × 23 + 1 × 23 = 230 + 23 = 253",
  "shortcut_path": "Digit-sum: 2+3=5, sandwich: 2(5)3 = 253",
  "shortcut_time_threshold_ms": 3000,
  "hints": [
    {"level": 1, "text": "...", "cost": 0},
    {"level": 2, "text": "...", "cost": 5},
    {"level": 3, "text": "...", "cost": 15}
  ],
  "aha_moment": "When multiplying by 11, the middle digit is always the sum of the two outer digits.",
  "flavor_text": "The ancient vault cipher displays 11 × 23. Solve it to open the door.",
  "tags": ["multiplication", "×11", "two-digit", "zone-2"],
  "estimated_brute_force_seconds": 10,
  "estimated_trick_seconds": 2
}

## Rules
- difficulty must EXACTLY match the target difficulty given in the user message
- trick_id must be one of the eligible tricks listed in the user message
- answer must be a single integer
- answer_type is always "exact"
- All 3 hint levels are required. Costs are fixed: level 1 = 0, level 2 = 5, level 3 = 15
- shortcut_path and brute_force_path are internal notes, never shown to the child

## Hint Rules — follow all five
A hint that leaves no thinking for the child is a skip, not a hint. Reject your own hint if it breaks any rule below.

Rule 1 — Core principle: after reading the hint, the child must still need to think. If they only have to execute, the hint went too far.

Rule 2 — Search space reduction: point toward a method or property, never through it. The child applies the shortcut themselves.

Rule 3 — Intermediate value rule: if a solution has steps A → B, you may prompt step A but must NEVER state the result of step A. Example violation: "Split 38 into 30+8. Add 30 to 47: 47+30=77." Stating 77 is a skip disguised as guidance.

Rule 4 — Classification rule: for parity, divisibility, or true/false sub-steps, restating the rule in the answer's form IS the answer. Prompt the child to recall and apply the rule, not receive it.

Rule 5 — Three-level ladder: each level narrows the search space further but none eliminates it entirely.
  H1: directs attention without naming the trick.
  H2: implies or names the method; asks the child to begin.
  H3: describes the solution structure without supplying any computed value.
- flavor_text must be age-appropriate and fit the game world
- estimated_trick_seconds must be significantly less than estimated_brute_force_seconds"""


def _build_system_prompt() -> list:
    # What: wraps the static system prompt text in the Anthropic content block format.
    #       Adds cache_control when prompt caching is enabled so Anthropic reuses the
    #       cached version within a 5-minute window, avoiding re-charging input tokens.
    # Return: list[dict] — Anthropic system content block(s)
    # Example input: (no args — reads module-level constants)
    # Example output: [{"type": "text", "text": "...", "cache_control": {...}}]

    # dict — the base content block for the system prompt
    block = {"type": "text", "text": _SYSTEM_PROMPT_TEXT}

    if PROMPT_CACHING_ENABLED:
        # cache_control marks this block for Anthropic's 5-minute prompt cache
        block["cache_control"] = {"type": "ephemeral"}

    # list[dict] — Anthropic expects system as a list of content blocks
    return [block]


def _build_user_message(
    child_profile: ChildProfileInput,
    difficulty_target: int,
    eligible_tricks: list,
) -> str:
    # What: assembles the user-turn message sent to Agent 1.
    #       Contains the difficulty target, eligible trick descriptions, and the
    #       child profile (recent_problems capped at RECENT_PROBLEMS_CAP).
    #       Eligible trick descriptions are included here (not in the system prompt)
    #       so the system prompt stays static and benefits from caching.
    # Return: str — formatted user message text
    # Example input: child_profile, difficulty_target=4, eligible_tricks=["A1", "A2"]
    # Example output: "Generate a problem...\ndiffculty_target: 4\n..."

    # list[dict] — only the eligible trick objects (filtered from the full reference)
    trick_descriptions = [
        _TRICKS_BY_ID[tid] for tid in eligible_tricks if tid in _TRICKS_BY_ID
    ]

    # dict — child profile serialised for the prompt; recent_problems capped to save tokens
    capped_profile = {
        "child": child_profile.child.model_dump(),
        "recent_problems": [
            p.model_dump() for p in child_profile.recent_problems[-RECENT_PROBLEMS_CAP:]
        ],
    }

    # str — the full user message combining all context Agent 1 needs
    return f"""Generate one math problem for the child described below.

difficulty_target: {difficulty_target}

eligible_tricks:
{json.dumps(trick_descriptions, indent=2)}

child_profile:
{json.dumps(capped_profile, indent=2)}"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_problem(
    child_profile: ChildProfileInput,
    difficulty_target: int,
    eligible_tricks: list,
) -> dict | None:
    # What: main entry point for Agent 1. Checks mock mode first, then calls the
    #       Anthropic API with the assembled system and user messages.
    #       Parses the response as JSON and returns the problem dict.
    #       Returns None if the API call fails or the response is not valid JSON —
    #       the orchestrator handles retries and fallback.
    # Return: dict (problem JSON) or None on failure
    # Example input: child_profile=<ChildProfileInput>, difficulty_target=4, eligible_tricks=["A1"]
    # Example output: {"id": "p_001", "trick_id": "A1", "answer": 253, ...}

    # bool — skip the real API and return a hardcoded fixture when True
    mock_mode = os.getenv("MOCK_API", "false").lower() == "true"
    if mock_mode:
        return _MOCK_PROBLEM_FIXTURE

    # str — Anthropic API key from environment; never hardcoded
    api_key = os.getenv("ANTHROPIC_API_KEY")

    # anthropic.Anthropic — client created per-call so mock mode never touches it
    client = anthropic.Anthropic(api_key=api_key)

    # list[dict] — system prompt content blocks, cached if PROMPT_CACHING_ENABLED
    system_blocks = _build_system_prompt()

    # str — user message containing child profile, difficulty target, eligible tricks
    user_text = _build_user_message(child_profile, difficulty_target, eligible_tricks)

    try:
        # anthropic.types.Message — raw API response
        response = client.messages.create(
            model=MODEL_NAME,
            max_tokens=AGENT1_MAX_TOKENS,
            system=system_blocks,
            messages=[{"role": "user", "content": user_text}],
        )

        # str — the text content of Agent 1's response, fences stripped
        raw_text = response.content[0].text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        # dict — parsed JSON problem object
        return json.loads(raw_text)

    except Exception:
        # Return None so the orchestrator can retry or fall back — never raise here
        return None
