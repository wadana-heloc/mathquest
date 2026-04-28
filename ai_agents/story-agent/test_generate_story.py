# test_generate_story.py
"""
Unit tests for generate_story.py.
No real API calls are made — all Anthropic client calls are mocked.
Tests verify our own logic: system prompt construction, message assembly,
output shape, input validation, and error handling.
"""

import pytest
from unittest.mock import MagicMock, patch
from generate_story import _build_system_prompt, generate_story


class TestBuildSystemPrompt:
    """
    Tests for _build_system_prompt().
    Covers: return type, block count, block type, prompt text presence,
            cache_control present when caching enabled, absent when disabled.
    """

    def test_returns_a_list(self):
        # list — result must always be a list
        result = _build_system_prompt()
        assert isinstance(result, list)

    def test_returns_exactly_one_block(self):
        # list — must contain exactly one block
        result = _build_system_prompt()
        assert len(result) == 1

    def test_block_type_is_text(self):
        # dict — the block must declare type "text"
        result = _build_system_prompt()
        assert result[0]["type"] == "text"

    def test_block_contains_non_empty_prompt_text(self):
        # str — the "text" field must be a non-empty string
        result = _build_system_prompt()
        assert isinstance(result[0]["text"], str)
        assert len(result[0]["text"]) > 0

    @patch("generate_story.PROMPT_CACHING_ENABLED", True)
    def test_cache_control_present_when_caching_enabled(self):
        # dict — cache_control must be set to ephemeral when caching is on
        result = _build_system_prompt()
        assert result[0].get("cache_control") == {"type": "ephemeral"}

    @patch("generate_story.PROMPT_CACHING_ENABLED", False)
    def test_no_cache_control_when_caching_disabled(self):
        # dict — cache_control key must not exist when caching is off
        result = _build_system_prompt()
        assert "cache_control" not in result[0]


class TestGenerateStory:
    """
    Tests for generate_story().
    Covers: happy path, whitespace stripping, word count accuracy,
            missing text block, API exception.
    """

    def _make_mock_response(self, text: str) -> MagicMock:
        """
        What it does:
            Builds a mock Anthropic API response containing a single text block.

        Returns:
            MagicMock shaped like anthropic.types.Message

        Example input:
            text = "Yousef climbed the steep path..."

        Example output:
            MagicMock with .content = [MagicMock(type="text", text="Yousef...")]
        """
        # MagicMock — fake TextBlock mimicking anthropic.types.TextBlock
        text_block = MagicMock()
        text_block.type = "text"
        text_block.text = text

        # MagicMock — fake Message response object
        response = MagicMock()
        response.content = [text_block]
        return response

    @patch("generate_story.anthropic.Anthropic")
    def test_returns_content_and_word_count_keys(self, mock_anthropic_class):
        # dict — result must contain both "content" and "word_count" keys
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.return_value = self._make_mock_response(
            "Yousef climbed the steep path to the gate."
        )

        # dict — result from generate_story given a parent prompt
        result = generate_story("Write a story about a boy who solves a math puzzle.")

        assert "content" in result
        assert "word_count" in result

    @patch("generate_story.anthropic.Anthropic")
    def test_content_matches_api_response(self, mock_anthropic_class):
        # str — content must match the text returned by the API
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.return_value = self._make_mock_response(
            "Yousef climbed the steep path to the gate."
        )

        # dict — result from generate_story
        result = generate_story("Write a story about a boy who solves a math puzzle.")

        assert result["content"] == "Yousef climbed the steep path to the gate."

    @patch("generate_story.anthropic.Anthropic")
    def test_word_count_is_correct(self, mock_anthropic_class):
        # int — word_count must equal the actual number of words in content
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.return_value = self._make_mock_response(
            "Yousef climbed the steep path to the gate."
        )

        # dict — 8 words in the story above
        result = generate_story("Write a story about a boy who solves a math puzzle.")

        assert result["word_count"] == 8

    @patch("generate_story.anthropic.Anthropic")
    def test_strips_leading_and_trailing_whitespace(self, mock_anthropic_class):
        # str — content must be stripped even when the API returns padded text
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.return_value = self._make_mock_response(
            "  A child crossed the bridge.  "
        )

        # dict — content must equal the stripped version
        result = generate_story("Write a story about a child.")

        assert result["content"] == "A child crossed the bridge."

    @patch("generate_story.anthropic.Anthropic")
    def test_word_count_reflects_stripped_content(self, mock_anthropic_class):
        # int — word_count must be computed after stripping, not from raw API text
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.return_value = self._make_mock_response(
            "  One two three.  "
        )

        # dict — word_count must match the word count of the stripped content
        result = generate_story("Write a story about a child.")

        assert result["word_count"] == len(result["content"].split())

    @patch("generate_story.anthropic.Anthropic")
    def test_raises_when_response_has_no_text_block(self, mock_anthropic_class):
        # MagicMock — response containing only a non-text block (e.g. tool_use)
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client

        # MagicMock — fake non-text block
        non_text_block = MagicMock()
        non_text_block.type = "tool_use"
        mock_response = MagicMock()
        mock_response.content = [non_text_block]
        mock_client.messages.create.return_value = mock_response

        with pytest.raises(ValueError, match="Claude returned no text content"):
            generate_story("Write a story about a child.")

    @patch("generate_story.anthropic.Anthropic")
    def test_raises_on_api_exception(self, mock_anthropic_class):
        # MagicMock — mock client that raises an exception on the API call
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.side_effect = Exception("API unavailable")

        with pytest.raises(Exception, match="API unavailable"):
            generate_story("Write a story about a child.")
