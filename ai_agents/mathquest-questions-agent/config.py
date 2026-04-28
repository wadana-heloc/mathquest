# config.py
# Central configuration for the MathQuest agent pipeline.
# Every literal value used by any module lives here — model names, token limits,
# difficulty thresholds, retry settings. No other file may hardcode these values.
# To tune the system, edit this file only.


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

# str — Anthropic model ID used by both Agent 1 and Agent 2
MODEL_NAME = "claude-sonnet-4-5"


# ---------------------------------------------------------------------------
# Token limits
# These are tight because both agents return structured JSON, not prose.
# Keeping them low reduces cost and forces the agents to be concise.
# ---------------------------------------------------------------------------

# int — max tokens Agent 1 (Generator) may produce; one JSON object
AGENT1_MAX_TOKENS = 600

# int — max tokens Agent 2 (Reviewer) may produce; one small approval JSON
AGENT2_MAX_TOKENS = 300


# ---------------------------------------------------------------------------
# Prompt caching
# When True, system prompts are sent with cache_control so Anthropic reuses
# the cached version within a 5-minute window, avoiding re-charging input tokens.
# Set to False during development if you are iterating on the system prompt.
# ---------------------------------------------------------------------------

# bool — enable or disable prompt caching on Agent 1 and Agent 2 system prompts
PROMPT_CACHING_ENABLED = True


# ---------------------------------------------------------------------------
# Retry settings
# If an agent returns invalid JSON or fails Pydantic validation, the orchestrator
# retries once before falling back to the pre-made problem bank.
# ---------------------------------------------------------------------------

# int — maximum number of retry attempts per agent before triggering fallback
MAX_RETRIES = 1

# int — seconds to wait between a failed attempt and the next retry
RETRY_WAIT_SECONDS = 2


# ---------------------------------------------------------------------------
# Difficulty bounds
# Difficulty is always expressed on the 1–10 scale. These constants are used
# by the difficulty engine to clamp computed targets within valid range.
# ---------------------------------------------------------------------------

# int — minimum difficulty level (basic arithmetic)
DIFFICULTY_MIN = 1

# int — maximum difficulty level (competition-level problems)
DIFFICULTY_MAX = 10


# ---------------------------------------------------------------------------
# Difficulty advancement rule (PRD Section 09)
# The difficulty engine auto-advances when the child sustains a high correct
# rate over a rolling window of recent problems at the current difficulty.
# ---------------------------------------------------------------------------

# float — correct rate threshold required to advance difficulty (80%)
ADVANCEMENT_CORRECT_RATE = 0.80

# int — number of recent problems the correct rate is measured over
ADVANCEMENT_WINDOW = 10

# int — minimum number of correctly-solved problems at the current difficulty
# before the engine will advance. Prevents moving up after a single lucky solve.
MIN_PROBLEMS_PER_LEVEL = 5


# ---------------------------------------------------------------------------
# Session-level adjustment thresholds (PRD Section 09)
# These control the delta applied to difficulty_target within a session.
# The difficulty engine checks these in order: consolidate → advance → maintain.
# ---------------------------------------------------------------------------

# int — if hints_used in the session >= this value, hold difficulty (consolidate)
CONSOLIDATE_HINTS_THRESHOLD = 3

# int — if failed problems in the session >= this value, hold difficulty (consolidate)
CONSOLIDATE_FAILED_THRESHOLD = 2

# int — if avg_time_per_problem_ms > this value, hold difficulty (consolidate), in ms
CONSOLIDATE_DURATION_THRESHOLD_MS = 90000

# int — if avg_time_per_problem_ms < this value (and no hints, no failures), advance, in ms
ADVANCE_DURATION_THRESHOLD_MS = 25000


# ---------------------------------------------------------------------------
# Token efficiency — recent problems cap
# Only the last N problems are sent to Agent 1. Older history does not improve
# generation quality and wastes input tokens.
# ---------------------------------------------------------------------------

# int — maximum number of recent problems included in the Agent 1 prompt
RECENT_PROBLEMS_CAP = 5
