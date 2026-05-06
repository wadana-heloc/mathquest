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

# int — maximum practice problems allowed on one trick before the child is moved
# on regardless of mastery. Prevents the child grinding the same trick endlessly.
MAX_PROBLEMS_PER_TRICK = 7


# ---------------------------------------------------------------------------
# Calibration mode (initial level-finding for new children or new tricks)
# When calibration_active is True the difficulty engine skips MIN_PROBLEMS_PER_LEVEL
# and jumps by CALIBRATION_DELTA on each correct answer so it finds the child's
# true level in a handful of problems instead of many. On the first wrong answer
# difficulty drops by CALIBRATION_DROP and calibration ends, switching to the
# normal session-adjustment rules.
# ---------------------------------------------------------------------------

# int — difficulty jump when a correct answer is clean (no hints, fast)
CALIBRATION_DELTA = 2

# int — difficulty jump when a correct answer is hesitant (hints used OR slow)
# Smaller than CALIBRATION_DELTA so the child climbs more carefully when uncertain
CALIBRATION_SLOW_DELTA = 1

# int — difficulty drop when the first wrong answer ends calibration
CALIBRATION_DROP = 1


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


# ---------------------------------------------------------------------------
# Problem bank and recommender settings
# Used by problem_recommender.py to decide when to trigger a refill and to
# check phase transitions. Never hardcode these in the module files.
# ---------------------------------------------------------------------------

# int — minimum unseen problems remaining before triggering a refill request
MIN_BANK_SIZE = 5

# int — number of discovery-phase problems before trick reveal is triggered
DISCOVERY_PROBLEMS_REQUIRED = 2

# int — number of practice problems required before mastery can be checked
MIN_PRACTICE_PROBLEMS = 10

# float — correct rate threshold to declare mastery and advance trick
MASTERY_THRESHOLD = 0.80


# ---------------------------------------------------------------------------
# Scoring weights for problem_recommender.py
# The recommender scores each candidate using these weights. Adjust here to
# change prioritization without touching the module logic.
# ---------------------------------------------------------------------------

# int — bonus score for a problem the child previously failed (highest value)
WEIGHT_RETRY = 30

# int — bonus score for a problem the child has never seen
WEIGHT_UNSEEN = 20

# int — bonus score when the problem's phase tag matches the child's current phase
WEIGHT_PHASE_FIT = 25

# int — penalty per unit of difficulty mismatch from the child's current level
WEIGHT_DIFFICULTY_PENALTY = 10
