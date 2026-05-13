# test_wishlist_agent.py
"""
Unit tests for wishlist_agent.py.
No real API calls are made — all Anthropic client calls are mocked.
Tests verify our own logic: input sanitisation, message assembly, response
parsing, and endpoint behaviour on success, fallback, and error paths.
"""

import json
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from wishlist_agent import _sanitise_title, _build_user_message, _parse_claude_response
from main import app

# TestClient — drives the FastAPI app over HTTP without a running server
http = TestClient(app)

# str — a stable wish_id reused across endpoint tests
WISH_ID = "550e8400-e29b-41d4-a716-446655440000"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_response(json_payload: dict) -> MagicMock:
    """
    What it does:
        Builds a mock Anthropic API response containing a single text block
        whose content is the JSON-serialised form of json_payload.

    Returns:
        MagicMock shaped like anthropic.types.Message

    Example input:
        {"cost": 1000, "category": "food", "reasoning": "A meal out."}

    Example output:
        MagicMock with .content[0].text == '{"cost": 1000, ...}'
    """
    # MagicMock — fake TextBlock
    text_block = MagicMock()
    text_block.text = json.dumps(json_payload)

    # MagicMock — fake Message response object
    response = MagicMock()
    response.content = [text_block]
    return response


# ---------------------------------------------------------------------------
# TestSanitiseTitle
# ---------------------------------------------------------------------------

class TestSanitiseTitle:
    """
    Tests for _sanitise_title().
    Covers: leading/trailing whitespace, truncation, blank-only input.
    """

    def test_strips_leading_and_trailing_whitespace(self):
        # str — result must have no surrounding whitespace
        assert _sanitise_title("  Pizza night  ") == "Pizza night"

    def test_strips_inner_newlines_at_edges(self):
        # str — newlines at the edges are stripped
        assert _sanitise_title("\nPizza night\n") == "Pizza night"

    def test_truncates_to_120_characters(self):
        # str — title longer than 120 chars must be truncated exactly at 120
        long_title = "a" * 200
        result = _sanitise_title(long_title)
        assert len(result) == 120

    def test_title_of_exact_max_length_is_unchanged(self):
        # str — title of exactly 120 chars must not be truncated further
        exact_title = "b" * 120
        assert _sanitise_title(exact_title) == exact_title

    def test_empty_string_returns_empty_string(self):
        # str — empty input stays empty (triggers fallback in the endpoint)
        assert _sanitise_title("") == ""

    def test_whitespace_only_returns_empty_string(self):
        # str — whitespace-only input is empty after strip (triggers fallback)
        assert _sanitise_title("   ") == ""

    def test_short_title_passes_through_unchanged(self):
        # str — short titles are returned as-is after stripping
        assert _sanitise_title("Lego set") == "Lego set"


# ---------------------------------------------------------------------------
# TestBuildUserMessage
# ---------------------------------------------------------------------------

class TestBuildUserMessage:
    """
    Tests for _build_user_message().
    Covers: format correctness, grade and title embedding, special characters.
    """

    def test_includes_grade(self):
        # str — the grade must appear in the message
        result = _build_user_message(5, "Pizza night")
        assert "5" in result

    def test_includes_title_in_quotes(self):
        # str — the title must be wrapped in double quotes
        result = _build_user_message(5, "Pizza night")
        assert '"Pizza night"' in result

    def test_contains_child_grade_label(self):
        # str — the label "Child grade:" must be present
        result = _build_user_message(3, "Screen time")
        assert "Child grade:" in result

    def test_contains_wish_label(self):
        # str — the label "Wish:" must be present
        result = _build_user_message(3, "Screen time")
        assert "Wish:" in result

    def test_exact_format_for_spec_example(self):
        # str — must match the exact format shown in the AI engineer spec
        expected = 'Child grade: 5\nWish: "Pizza night"'
        assert _build_user_message(5, "Pizza night") == expected

    def test_grade_1_works(self):
        # str — grade 1 (minimum) must appear correctly
        result = _build_user_message(1, "Snack")
        assert "1" in result

    def test_grade_12_works(self):
        # str — grade 12 (maximum) must appear correctly
        result = _build_user_message(12, "Console game")
        assert "12" in result


# ---------------------------------------------------------------------------
# TestParseClaudeResponse
# ---------------------------------------------------------------------------

class TestParseClaudeResponse:
    """
    Tests for _parse_claude_response().
    Covers: valid JSON, type coercion, whitespace tolerance, error paths.
    """

    def test_parses_valid_json(self):
        # dict — all three fields must be present with correct types
        text = '{"cost": 1000, "category": "food", "reasoning": "A meal out."}'
        result = _parse_claude_response(text)
        assert result == {"cost": 1000, "category": "food", "reasoning": "A meal out."}

    def test_cost_is_coerced_to_int(self):
        # int — cost must be an int even if Claude returns a float
        text = '{"cost": 1000.0, "category": "food", "reasoning": "A meal out."}'
        result = _parse_claude_response(text)
        assert isinstance(result["cost"], int)
        assert result["cost"] == 1000

    def test_category_is_coerced_to_str(self):
        # str — category must be a string
        text = '{"cost": 500, "category": "screen_time", "reasoning": "Short."}'
        result = _parse_claude_response(text)
        assert isinstance(result["category"], str)

    def test_reasoning_is_coerced_to_str(self):
        # str — reasoning must be a string
        text = '{"cost": 500, "category": "other", "reasoning": "Default."}'
        result = _parse_claude_response(text)
        assert isinstance(result["reasoning"], str)

    def test_strips_surrounding_whitespace_from_text(self):
        # dict — leading and trailing whitespace around the JSON must be tolerated
        text = '  {"cost": 500, "category": "other", "reasoning": "OK."}  '
        result = _parse_claude_response(text)
        assert result["cost"] == 500

    def test_raises_on_invalid_json(self):
        # json.JSONDecodeError — malformed JSON must propagate so the caller falls back
        with pytest.raises(Exception):
            _parse_claude_response("not json at all")

    def test_raises_on_missing_cost_key(self):
        # KeyError — missing required key must propagate so the caller falls back
        text = '{"category": "food", "reasoning": "A meal."}'
        with pytest.raises(KeyError):
            _parse_claude_response(text)

    def test_raises_on_missing_category_key(self):
        # KeyError — missing required key must propagate
        text = '{"cost": 1000, "reasoning": "A meal."}'
        with pytest.raises(KeyError):
            _parse_claude_response(text)


# ---------------------------------------------------------------------------
# TestPriceWishEndpoint
# ---------------------------------------------------------------------------

class TestPriceWishEndpoint:
    """
    Tests for POST /internal/price-wish.
    Covers: happy path, empty title fallback, long title handling,
            Claude API error fallback, always-200 contract.
    """

    @patch("wishlist_agent.anthropic.Anthropic")
    def test_happy_path_returns_cost_category_reasoning(self, mock_anthropic_class):
        # dict — successful Claude call must return parsed cost/category/reasoning
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.return_value = _make_mock_response(
            {"cost": 1000, "category": "food", "reasoning": "A meal out."}
        )

        # dict — HTTP response body
        response = http.post(
            "/internal/price-wish",
            json={"wish_id": WISH_ID, "title": "Pizza night", "grade": 5},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["wish_id"] == WISH_ID
        assert body["cost"] == 1000
        assert body["category"] == "food"
        assert body["reasoning"] == "A meal out."

    @patch("wishlist_agent.anthropic.Anthropic")
    def test_empty_title_returns_fallback_without_calling_claude(self, mock_anthropic_class):
        # dict — empty title must trigger fallback; Claude must NOT be called
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client

        response = http.post(
            "/internal/price-wish",
            json={"wish_id": WISH_ID, "title": "", "grade": 5},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["cost"] == 500
        assert body["category"] == "other"
        # Claude was not called
        mock_client.messages.create.assert_not_called()

    @patch("wishlist_agent.anthropic.Anthropic")
    def test_whitespace_only_title_returns_fallback(self, mock_anthropic_class):
        # dict — whitespace-only title counts as empty; same fallback path
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client

        response = http.post(
            "/internal/price-wish",
            json={"wish_id": WISH_ID, "title": "   ", "grade": 5},
        )

        assert response.status_code == 200
        assert response.json()["cost"] == 500
        mock_client.messages.create.assert_not_called()

    @patch("wishlist_agent.anthropic.Anthropic")
    def test_long_title_does_not_crash(self, mock_anthropic_class):
        # dict — title of 200 chars must be truncated and handled without error
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.return_value = _make_mock_response(
            {"cost": 500, "category": "other", "reasoning": "Generic."}
        )

        response = http.post(
            "/internal/price-wish",
            json={"wish_id": WISH_ID, "title": "a" * 200, "grade": 5},
        )

        assert response.status_code == 200

    @patch("wishlist_agent.anthropic.Anthropic")
    def test_claude_api_error_returns_fallback(self, mock_anthropic_class):
        # dict — Claude API exception must return fallback, never a 500
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.side_effect = Exception("API unavailable")

        response = http.post(
            "/internal/price-wish",
            json={"wish_id": WISH_ID, "title": "Pizza night", "grade": 5},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["cost"] == 500
        assert body["category"] == "other"

    @patch("wishlist_agent.anthropic.Anthropic")
    def test_invalid_json_from_claude_returns_fallback(self, mock_anthropic_class):
        # dict — malformed JSON from Claude must return fallback, never a 500
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client

        # MagicMock — Claude returns something that is not valid JSON
        bad_block = MagicMock()
        bad_block.text = "Sorry, I cannot help with that."
        bad_response = MagicMock()
        bad_response.content = [bad_block]
        mock_client.messages.create.return_value = bad_response

        response = http.post(
            "/internal/price-wish",
            json={"wish_id": WISH_ID, "title": "Pizza night", "grade": 5},
        )

        assert response.status_code == 200
        assert response.json()["cost"] == 500

    @patch("wishlist_agent.anthropic.Anthropic")
    def test_wish_id_is_always_echoed_back(self, mock_anthropic_class):
        # str — wish_id must be present in every response, success or fallback
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.side_effect = Exception("timeout")

        response = http.post(
            "/internal/price-wish",
            json={"wish_id": WISH_ID, "title": "Any wish", "grade": 3},
        )

        assert response.json()["wish_id"] == WISH_ID

    @patch("wishlist_agent.anthropic.Anthropic")
    def test_extra_fields_in_request_are_ignored(self, mock_anthropic_class):
        # dict — PII or extra fields sent by the backend must be silently dropped
        mock_client = MagicMock()
        mock_anthropic_class.return_value = mock_client
        mock_client.messages.create.return_value = _make_mock_response(
            {"cost": 300, "category": "screen_time", "reasoning": "Short."}
        )

        response = http.post(
            "/internal/price-wish",
            json={
                "wish_id": WISH_ID,
                "title": "Screen time",
                "grade": 3,
                "child_name": "Alice",     # PII — must be ignored
                "parent_id": "secret-123", # extra field — must be ignored
            },
        )

        assert response.status_code == 200
        # Response must not contain the extra fields
        body = response.json()
        assert "child_name" not in body
        assert "parent_id" not in body
