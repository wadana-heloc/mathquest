# generate_story.py
"""
Calls the Anthropic Claude API to generate a children's story for the MathQuest
adventure game. This module owns the system prompt, the API call, and the output
contract. It does not handle HTTP routing, auth, rate limiting, or database storage
— those belong to the backend team.

The backend team imports generate_story() and calls it from their server-side route
after they have verified the parent session and checked the rate limit.
"""

import os
import re
import anthropic
from dotenv import load_dotenv
from config import MODEL, MAX_TOKENS, PROMPT_CACHING_ENABLED

load_dotenv()

# str — the hardcoded system prompt sent to Claude on every request
# Safety and format rules sourced from PRD Section 11. Do not edit without updating the PRD reference.
_SYSTEM_PROMPT_TEXT = """You are a children's story writer for a math-themed adventure game called MathQuest.
You are writing for children aged 7-12.

STRICT RULES:
- No violence, death, cruelty, or frightening content
- No romantic content
- No political, religious, or ideological content
- No brand names or copyrighted characters
- No instructions for dangerous activities
- Stories must have a positive resolution
- Maximum length: 600 words
- Must include at least one moment where a character solves a problem by thinking carefully

STYLE GUIDANCE: Match the tone and vocabulary of the example story provided.
Use the style notes if provided. If no style notes, keep the tone from the example.

OUTPUT: Divide the story into 3 to 5 chapters. Label each chapter exactly as "CHAPTER 1:", "CHAPTER 2:", etc. on its own line, followed by 2 to 4 sentences of story content. No markdown. No bullet points. No other formatting. Begin immediately with "CHAPTER 1:" — no preamble, no title, no "Here is your story:"."""


def _build_system_prompt() -> list:
    """
    What it does:
        Builds the system prompt as a list of content blocks for the Anthropic API.
        When prompt caching is enabled, attaches ephemeral cache_control to reduce
        latency and cost on repeated calls by caching the system prompt server-side.

    Returns:
        list[dict] — one system prompt block, optionally with cache_control attached

    Example input:
        (no arguments)

    Example output (caching enabled):
        [{"type": "text", "text": "...", "cache_control": {"type": "ephemeral"}}]

    Example output (caching disabled):
        [{"type": "text", "text": "..."}]
    """
    # dict — base block with the prompt text; type is required by the Anthropic API
    block = {"type": "text", "text": _SYSTEM_PROMPT_TEXT}

    if PROMPT_CACHING_ENABLED:
        # dict — instructs Anthropic to cache this block across requests
        block["cache_control"] = {"type": "ephemeral"}

    # list[dict] — wrapped in a list as required by messages.create for the system parameter
    return [block]


def _parse_chapters(text: str) -> list:
    """
    What it does:
        Splits a chapter-labelled story into a list of chapter text strings.
        Expects labels like "CHAPTER 1:", "CHAPTER 2:", etc. produced by the system prompt.

    Returns:
        list[str] — one string per chapter, whitespace stripped, labels removed

    Example input:
        "CHAPTER 1: Mira walked up the hill.\n\nCHAPTER 2: She found a glowing door."

    Example output:
        ["Mira walked up the hill.", "She found a glowing door."]
    """
    # list[str] — split on "CHAPTER N:" pattern; the text before the first label is empty
    parts = re.split(r'CHAPTER\s+\d+\s*:', text)
    # list[str] — remove empty entries and strip surrounding whitespace from each chapter
    return [part.strip() for part in parts if part.strip()]


def generate_story(parent_prompt: str) -> dict:
    """
    What it does:
        Calls the Anthropic Claude API to generate a children's story from the
        parent's prompt. Raises on any API failure — the caller handles HTTP errors.

    Returns:
        dict with two keys:
            "chapters"   — list[str], story divided into chapters, each 2-4 sentences
            "word_count" — int, total word count across all chapters

    Example input:
        parent_prompt = "Write a story about a girl who loves math and finds a magic door."

    Example output:
        {
            "chapters": [
                "Mira had always loved numbers more than anything...",
                "Behind the door she found a room filled with glowing symbols...",
            ],
            "word_count": 312
        }
    """
    # anthropic.Anthropic — reads ANTHROPIC_API_KEY from environment automatically
    # never pass the key explicitly, never log it
    client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY') )

    # list[dict] — system prompt blocks, with or without cache_control
    system_blocks = _build_system_prompt()

    # anthropic.types.Message — full API response; raises on any Anthropic API error
    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=system_blocks,
        messages=[{"role": "user", "content": parent_prompt}],
    )

    # anthropic.types.TextBlock | None — the first text block in the response content list
    text_block = next(
        (block for block in response.content if block.type == "text"), None
    )

    if text_block is None:
        raise ValueError("Claude returned no text content")

    # str — full raw story text with leading and trailing whitespace removed
    content = text_block.text.strip()

    # list[str] — story split into individual chapter strings, labels stripped
    chapters = _parse_chapters(content)

    # int — total word count across all chapter texts, labels excluded
    word_count = sum(len(ch.split()) for ch in chapters)

    return {"chapters": chapters, "word_count": word_count}
