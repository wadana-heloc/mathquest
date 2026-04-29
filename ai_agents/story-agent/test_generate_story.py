# test_generate_story.py
"""
Unit tests for generate_story.py.
No real API calls are made — all Anthropic client calls are mocked.
Tests verify our own logic: system prompt construction, message assembly,
output shape, input validation, and error handling.
"""

import pytest
from unittest.mock import MagicMock, patch
from generate_story import _build_system_prompt, _parse_chapters, generate_story


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


class TestParseChapters:
    """
    Tests for _parse_chapters().
    Covers: single chapter, multiple chapters, whitespace stripping, no labels.
    """

    def test_returns_list(self):
        # list — result must always be a list
        result = _parse_chapters("CHAPTER 1: Mira walked up the hill.")
        assert isinstance(result, list)

    def test_single_chapter_extracted(self):
        # list[str] — one chapter in, one string out, label removed
        result = _parse_chapters("CHAPTER 1: Mira walked up the hill.")
        assert result == ["Mira walked up the hill."]

    def test_multiple_chapters_extracted(self):
        # list[str] — each chapter becomes its own string, labels removed
        result = _parse_chapters(
            "CHAPTER 1: Mira walked up the hill.\n\nCHAPTER 2: She found a door."
        )
        assert result == ["Mira walked up the hill.", "She found a door."]

    def test_strips_whitespace_from_each_chapter(self):
        # list[str] — leading and trailing whitespace inside each chapter is removed
        result = _parse_chapters("CHAPTER 1:   Mira walked.   \n\nCHAPTER 2:   She found.   ")
        assert result[0] == "Mira walked."
        assert result[1] == "She found."

    def test_returns_full_text_as_single_chapter_when_no_labels(self):
        # list[str] — plain text with no chapter labels is returned as a single-item list
        result = _parse_chapters("No chapter labels here at all.")
        assert result == ["No chapter labels here at all."]

    def test_handles_varying_whitespace_around_colon(self):
        # list[str] — "CHAPTER 1 :" and "CHAPTER 1:" both match
        result = _parse_chapters("CHAPTER 1 : Mira found the door.")
        assert result == ["Mira found the door."]


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
    def test_returns_chapters_and_word_count_keys(self, mock_anthropic_class):
        # dict — result must contain both "chapters" and "word_count" keys
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.return_value = self._make_mock_response(
            "CHAPTER 1: Yousef climbed the steep path."
        )

        # dict — result from generate_story given a parent prompt
        result = generate_story("Write a story about a boy who solves a math puzzle.")

        assert "chapters" in result
        assert "word_count" in result

    @patch("generate_story.anthropic.Anthropic")
    def test_chapters_is_a_list(self, mock_anthropic_class):
        # list — "chapters" value must always be a list
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.return_value = self._make_mock_response(
            "CHAPTER 1: Yousef climbed the steep path."
        )

        # dict — result from generate_story
        result = generate_story("Write a story about a boy who solves a math puzzle.")

        assert isinstance(result["chapters"], list)

    @patch("generate_story.anthropic.Anthropic")
    def test_chapters_contain_correct_text(self, mock_anthropic_class):
        # list[str] — each chapter string must match the parsed text, label removed
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.return_value = self._make_mock_response(
            "CHAPTER 1: Yousef climbed the path.\n\nCHAPTER 2: He solved the puzzle."
        )

        # dict — result from generate_story
        result = generate_story("Write a story about a boy who solves a math puzzle.")

        assert result["chapters"] == [
            "Yousef climbed the path.",
            "He solved the puzzle.",
        ]

    @patch("generate_story.anthropic.Anthropic")
    def test_word_count_is_correct(self, mock_anthropic_class):
        # int — word_count must equal the total words across all chapter texts
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.return_value = self._make_mock_response(
            "CHAPTER 1: Yousef climbed the steep path to the gate."
        )

        # dict — 8 words in the chapter text above ("Yousef climbed the steep path to the gate.")
        result = generate_story("Write a story about a boy who solves a math puzzle.")

        assert result["word_count"] == 8

    @patch("generate_story.anthropic.Anthropic")
    def test_strips_whitespace_from_each_chapter(self, mock_anthropic_class):
        # list[str] — each chapter string must be stripped of surrounding whitespace
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.return_value = self._make_mock_response(
            "CHAPTER 1:   A child crossed the bridge.   "
        )

        # dict — chapter text must equal the stripped version
        result = generate_story("Write a story about a child.")

        assert result["chapters"][0] == "A child crossed the bridge."

    @patch("generate_story.anthropic.Anthropic")
    def test_word_count_excludes_chapter_labels(self, mock_anthropic_class):
        # int — chapter labels ("CHAPTER 1:") must not be counted in word_count
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.return_value = self._make_mock_response(
            "CHAPTER 1: One two three."
        )

        # dict — word_count must equal the sum of words across chapter texts only
        result = generate_story("Write a story about a child.")

        assert result["word_count"] == sum(len(ch.split()) for ch in result["chapters"])

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
