# agent_reviewer.py
# Agent 2 (Reviewer) in the MathQuest pipeline.
# Receives one generated problem and the description of the trick it targets,
# then calls Claude to validate math correctness, trick alignment, hint quality,
# schema completeness, and age-appropriateness.
# Returns a ReviewerOutput dict, or None if the API call or JSON parsing fails.
# Never receives the child profile or the full tricks reference — it only needs
# the problem and the relevant trick to do its job.

import os
import json

import anthropic
from dotenv import load_dotenv

from config import (
    MODEL_NAME,
    AGENT2_MAX_TOKENS,
    PROMPT_CACHING_ENABLED,
)

# Load ANTHROPIC_API_KEY and MOCK_API from the .env file at import time
load_dotenv()


# ---------------------------------------------------------------------------
# Mock fixture — returned when MOCK_API=true in .env.
# Represents an approved problem with no issues so the pipeline can flow
# end-to-end in development without spending real tokens.
# ---------------------------------------------------------------------------

# dict — hardcoded approval fixture matching the ReviewerOutput schema
_MOCK_REVIEWER_FIXTURE = {
    "approved": True,
    "issues": [],
    "corrected_problem": None,
}


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------

# str — static system prompt for Agent 2.
# Never contains problem data or trick descriptions — those go in the user message.
# Kept at module level so it is assembled once, not on every call.
_SYSTEM_PROMPT_TEXT = """You are Agent 2 (Reviewer) in the MathQuest pipeline.
MathQuest is a math adventure game for children. Your job is to protect children from
incorrect, misleading, or age-inappropriate math problems.

Your task: review the problem provided in the user message and return ONLY a raw JSON object.
No markdown fences, no explanation, no extra text — just the JSON.

## Checks to perform

1. Math correctness
   - Verify the answer field is mathematically correct.
   - Verify brute_force_path and shortcut_path both arrive at the same correct answer.

2. Trick alignment
   - The problem must genuinely require the specified trick to solve efficiently.
   - The shortcut_path must actually demonstrate the trick described.

3. Hint quality
   All 3 hint levels must be present with costs: level 1 = 0, level 2 = 5, level 3 = 15.
   Evaluate every hint against the five rules below. Add a specific issue string for each violation found.

   Rule 1 — Core principle: after reading the hint, does the child still need to think, or only execute?
     REJECT if: the hint leaves no reasoning step for the child.

   Rule 2 — Search space reduction: the hint must point toward a method or property, never through it.
     REJECT if: the hint tells the child what to compute and supplies the computation.

   Rule 3 — Intermediate value rule: if the solution has steps A → B, the hint may prompt step A but must never state the result of step A.
     REJECT if: any hint contains a computed intermediate value (e.g. "47+30=77", "digit sum = 5", "10×8=80").

   Rule 4 — Classification rule: for parity, divisibility, or true/false sub-steps, restating the rule in the answer's form IS the answer.
     REJECT if: a hint states the parity/divisibility conclusion directly (e.g. "Odd × Odd = Odd" when the question is the parity of the product).

   Rule 5 — Three-level ladder: H1 directs attention without naming the trick. H2 names the method and asks the child to begin. H3 describes the solution structure without any computed value.
     REJECT if: H3 contains the final answer, any intermediate result, or performs the last computation step for the child.

4. Schema completeness
   - All required fields must be present and have the correct types.
   - difficulty must be an integer. answer must be an integer.

5. Age-appropriateness
   - stem, hints, flavor_text, and aha_moment must use language suitable for a child.
   - No violent, frightening, or adult-themed content.

## Output Schema

{
  "approved": true,
  "issues": [],
  "corrected_problem": null
}

- If all checks pass: approved=true, issues=[], corrected_problem=null
- If checks fail: approved=false, issues=[list of specific problems found]
- If the problem can be corrected: provide corrected_problem as the full fixed JSON
- If the math is fundamentally wrong and cannot be patched: corrected_problem=null

## Rules
- A wrong answer is always a hard rejection — never approve incorrect math
- A hint that directly states the answer is always a hard rejection
- Be strict: this content is shown to children"""


def _build_system_prompt() -> list:
    # What: wraps the static system prompt in the Anthropic content block format.
    #       Adds cache_control when prompt caching is enabled so Anthropic reuses
    #       the cached version within a 5-minute window.
    # Return: list[dict] — Anthropic system content block(s)
    # Example input: (no args — reads module-level constants)
    # Example output: [{"type": "text", "text": "...", "cache_control": {...}}]

    # dict — the base content block
    block = {"type": "text", "text": _SYSTEM_PROMPT_TEXT}

    if PROMPT_CACHING_ENABLED:
        # cache_control marks this block for Anthropic's 5-minute prompt cache
        block["cache_control"] = {"type": "ephemeral"}

    # list[dict] — Anthropic expects system as a list of content blocks
    return [block]


def _build_user_message(problem: dict, trick_description: dict) -> str:
    # What: assembles the user-turn message for Agent 2.
    #       Contains only the problem to review and the description of the trick
    #       it targets. Nothing else — child profile and full tricks reference
    #       are deliberately excluded to save tokens.
    # Return: str — formatted user message text
    # Example input: problem={"trick_id": "A1", ...}, trick_description={"name": "×11", ...}
    # Example output: "Review the following problem...\nTrick:\n{...}\n\nProblem:\n{...}"

    # str — the full user message combining problem and its trick description
    return f"""Review the following MathQuest problem.

Trick being tested:
{json.dumps(trick_description, indent=2)}

Problem to review:
{json.dumps(problem, indent=2)}"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def review_problem(problem: dict, trick_description: dict) -> dict | None:
    # What: main entry point for Agent 2. Checks mock mode first, then calls the
    #       Anthropic API with the system prompt and the problem + trick message.
    #       Parses the response as JSON and returns a ReviewerOutput-compatible dict.
    #       Returns None if the API call fails or the response is not valid JSON —
    #       the orchestrator treats None as a failed review and falls back.
    # Return: dict (ReviewerOutput JSON) or None on failure
    # Example input: problem={"trick_id": "A1", "answer": 253, ...}, trick_description={...}
    # Example output: {"approved": True, "issues": [], "corrected_problem": None}

    # bool — skip the real API when True
    mock_mode = os.getenv("MOCK_API", "false").lower() == "true"
    if mock_mode:
        return _MOCK_REVIEWER_FIXTURE

    # str — Anthropic API key from environment; never hardcoded
    api_key = os.getenv("ANTHROPIC_API_KEY")

    # anthropic.Anthropic — client created per-call so mock mode never touches it
    client = anthropic.Anthropic(api_key=api_key)

    # list[dict] — system prompt content blocks, cached if PROMPT_CACHING_ENABLED
    system_blocks = _build_system_prompt()

    # str — user message containing only the problem and its trick description
    user_text = _build_user_message(problem, trick_description)

    try:
        # anthropic.types.Message — raw API response
        response = client.messages.create(
            model=MODEL_NAME,
            max_tokens=AGENT2_MAX_TOKENS,
            system=system_blocks,
            messages=[{"role": "user", "content": user_text}],
        )

        # str — the text content of Agent 2's response, fences stripped
        raw_text = response.content[0].text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        # dict — parsed ReviewerOutput JSON
        return json.loads(raw_text)

    except Exception:
        # Return None so the orchestrator can fall back — never raise here
        return None
