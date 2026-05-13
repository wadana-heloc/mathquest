# wishlist_config.py
# All configuration constants for the MathQuest Wishlist Pricing Service.
# Nothing is hardcoded in wishlist_agent.py — every literal lives here.

# str — exact Anthropic model ID; Haiku is fast and cheap, no reasoning depth needed
MODEL = "claude-haiku-4-5-20251001"

# int — maximum tokens Claude may return; JSON response is always under 80 tokens
MAX_TOKENS = 100

# float — seconds to wait for the Claude API before giving up; backend waits 10s max
API_TIMEOUT = 10.0

# int — maximum characters accepted in a wish title before truncation
MAX_TITLE_LENGTH = 120

# int — coin cost returned when Claude is unavailable
FALLBACK_COST = 500

# str — category returned when Claude is unavailable
FALLBACK_CATEGORY = "other"

# str — reasoning returned when Claude is unavailable
FALLBACK_REASONING = "Pricing unavailable — suggested default."
