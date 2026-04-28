# config.py
# All configuration constants for the MathQuest Story Generator.
# Nothing is hardcoded in generate_story.py — every literal lives here.

# str — Anthropic model ID to use for story generation
MODEL = "claude-sonnet-4-6"

# int — maximum tokens Claude may return per request
MAX_TOKENS = 1000

# int — maximum word count for generated stories, enforced via system prompt
MAX_STORY_WORDS = 600

# bool — when True, attaches ephemeral cache_control to the system prompt block
PROMPT_CACHING_ENABLED = True
