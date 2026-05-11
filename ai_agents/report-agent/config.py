# config.py
# Central configuration for the MathQuest report agent.
# Every literal value used by any module lives here — model name, token limits,
# and data thresholds. No other file may hardcode these values.
# To tune the system, edit this file only.


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

# str — Anthropic model ID used by the report agent
MODEL_NAME = "claude-sonnet-4-6"


# ---------------------------------------------------------------------------
# Token limits
# The report agent produces ~280 words of prose.
# 280 words ≈ 400 tokens; 600 gives safe headroom without wasting spend.
# ---------------------------------------------------------------------------

# int — max tokens the report agent may produce
MAX_TOKENS = 600


# ---------------------------------------------------------------------------
# Prompt caching
# When True, the system prompt is sent with cache_control so Anthropic reuses
# the cached version within a 5-minute window, avoiding re-charging input tokens.
# Set to False during development if you are iterating on the system prompt.
# ---------------------------------------------------------------------------

# bool — enable or disable prompt caching on the system prompt
PROMPT_CACHING_ENABLED = True


# ---------------------------------------------------------------------------
# Caching (report-level, not prompt-level)
# Do not call the agent more than once per child per day.
# Suggested cache key pattern: report:{child_id}:{YYYY-MM-DD}
# ---------------------------------------------------------------------------

# int — how many seconds a generated report is valid before re-generation
REPORT_CACHE_TTL_SECONDS = 86400  # 24 hours
