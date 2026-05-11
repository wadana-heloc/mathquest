# test_report_agent.py
# Unit tests for the MathQuest report agent.
# Tests cover: _filter_trick_lines, _build_system_prompt, _build_user_message,
# and generate_report. No real API calls are made — the Anthropic client is
# always mocked with unittest.mock.MagicMock.
# Run with: pytest test_report_agent.py -v

import json
import os
import pytest
from unittest.mock import MagicMock, patch

from report_agent import (
    _filter_trick_lines,
    _build_system_prompt,
    _build_user_message,
    generate_report,
)
from schemas import (
    ReportPayload,
    ChildInfo,
    OverallStats,
    CategoryStat,
    DifficultyStat,
    TrickSummary,
    TrickInProgress,
    StruggledProblem,
)
from constants import ALL_TRICKS, BASE_SYSTEM_PROMPT
from config import PROMPT_CACHING_ENABLED


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

def _make_payload(**overrides) -> dict:
    # What: builds a minimal valid raw payload dict for tests.
    #       Overrides replace top-level keys, allowing edge-case testing.
    # Return: dict — a raw payload compatible with ReportPayload
    # Example input: overrides={"overall": {"attempts": 5, ...}}
    # Example output: {..."overall": {"attempts": 5, ...}...}

    # dict — baseline payload matching the example in BACKEND_CONTRACT.md
    base = {
        "child": {
            "name": "Yusuf",
            "age": 9,
            "grade": 3,
            "zone": 2,
            "current_difficulty": 4,
            "difficulty_ceiling": 7,
            "streak_current": 5,
            "streak_best": 9,
        },
        "period_days": 30,
        "overall": {
            "attempts": 87,
            "accuracy": 0.68,
            "avg_seconds": 24,
            "avg_hints_per_problem": 0.4,
        },
        "by_category": [
            {"category": "arithmetic", "attempts": 40, "accuracy": 0.85, "avg_seconds": 12},
            {"category": "pattern",    "attempts": 22, "accuracy": 0.41, "avg_seconds": 34},
        ],
        "difficulty_curve": [
            {"level": 1, "attempts": 18, "accuracy": 0.95},
            {"level": 4, "attempts": 14, "accuracy": 0.51},
        ],
        "tricks": {
            "unlocked": ["A3", "C5"],
            "in_progress": [
                {"id": "A1", "name": "×11 Digit-Sum Rule", "phase": "practice", "accuracy": 0.44}
            ],
            "not_yet_started": 22,
        },
        "struggled_problems": [
            {"stem": "What is 11 × 47?", "category": "pattern", "difficulty": 4, "hints_used": 2, "failed_twice": True}
        ],
        "trend": "improving",
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# TestFilterTrickLines
# ---------------------------------------------------------------------------

class TestFilterTrickLines:

    def test_returns_only_encountered_tricks(self):
        # What: only tricks whose IDs are in encountered_ids appear in the output.
        # Return: str with lines only for A1 and C5

        # set[str] — two specific trick IDs
        ids = {"A1", "C5"}

        # str — filtered output
        result = _filter_trick_lines(ids)

        assert "A1" in result
        assert "C5" in result
        # A2 was not in the set and must be absent
        assert "A2" not in result

    def test_returns_empty_string_for_empty_set(self):
        # What: no tricks encountered → no lines inserted; returns empty string.
        # Return: ""

        # str — result for an empty set
        result = _filter_trick_lines(set())

        assert result == ""

    def test_format_is_id_dash_name_colon_description(self):
        # What: each line follows the "ID — Name: Description" pattern.
        # Return: str with lines matching the format

        # set[str] — single trick
        result = _filter_trick_lines({"A1"})

        # str — the first (and only) line
        line = result.strip().split("\n")[0]
        assert line.startswith("A1 — ")
        assert ":" in line

    def test_all_25_tricks_returned_when_all_encountered(self):
        # What: when all trick IDs are in the set, all 25 lines are returned.
        # Return: str with 25 newline-separated lines

        # set[str] — all trick IDs
        all_ids = {t["id"] for t in ALL_TRICKS}

        # str — all 25 trick lines
        result = _filter_trick_lines(all_ids)

        # int — number of lines in the output
        line_count = len(result.strip().split("\n"))
        assert line_count == 25

    def test_unknown_ids_are_silently_ignored(self):
        # What: IDs not in ALL_TRICKS are ignored without raising an error.
        # Return: str containing only valid trick lines

        # str — result with one valid and one unknown ID
        result = _filter_trick_lines({"A1", "Z9"})

        assert "A1" in result
        assert "Z9" not in result


# ---------------------------------------------------------------------------
# TestBuildSystemPrompt
# ---------------------------------------------------------------------------

class TestBuildSystemPrompt:

    def test_trick_lines_injected_into_prompt(self):
        # What: the provided trick_lines string replaces the placeholder.
        # Return: list with one dict whose "text" key contains trick_lines

        # str — sample trick lines
        trick_lines = "A1 — ×11 Digit-Sum Rule: some description"

        # list[dict] — system prompt blocks
        blocks = _build_system_prompt(trick_lines)

        assert trick_lines in blocks[0]["text"]

    def test_placeholder_not_present_in_output(self):
        # What: the raw placeholder string is not left in the assembled prompt.
        # Return: list with one dict whose "text" contains no placeholder

        # list[dict] — system prompt blocks with empty trick lines
        blocks = _build_system_prompt("")

        assert "{INSERT_FILTERED_TRICK_LINES}" not in blocks[0]["text"]

    def test_returns_list_with_one_block(self):
        # What: the return value is always a list of exactly one content block.
        # Return: list of length 1

        # list[dict] — system prompt blocks
        blocks = _build_system_prompt("A1 — test")

        assert isinstance(blocks, list)
        assert len(blocks) == 1

    def test_cache_control_present_when_caching_enabled(self):
        # What: when PROMPT_CACHING_ENABLED is True, cache_control is added.
        # Return: list with a block containing cache_control key

        # list[dict] — system prompt blocks
        with patch("report_agent.PROMPT_CACHING_ENABLED", True):
            blocks = _build_system_prompt("A1 — test")

        assert "cache_control" in blocks[0]
        assert blocks[0]["cache_control"] == {"type": "ephemeral"}

    def test_no_cache_control_when_caching_disabled(self):
        # What: when PROMPT_CACHING_ENABLED is False, cache_control is absent.
        # Return: list with a block that has no cache_control key

        # list[dict] — system prompt blocks with caching off
        with patch("report_agent.PROMPT_CACHING_ENABLED", False):
            blocks = _build_system_prompt("A1 — test")

        assert "cache_control" not in blocks[0]


# ---------------------------------------------------------------------------
# TestBuildUserMessage
# ---------------------------------------------------------------------------

class TestBuildUserMessage:

    def test_contains_generate_instruction(self):
        # What: the user message always starts with the "Generate" instruction.
        # Return: str starting with the expected phrase

        # ReportPayload — validated payload
        payload = ReportPayload.model_validate(_make_payload())

        # str — user message
        msg = _build_user_message(payload)

        assert msg.startswith("Generate the progress report for this child:")

    def test_payload_json_embedded_in_message(self):
        # What: the payload JSON appears in the message, including the child name.
        # Return: str containing child name

        # ReportPayload — validated payload
        payload = ReportPayload.model_validate(_make_payload())

        # str — user message
        msg = _build_user_message(payload)

        assert "Yusuf" in msg

    def test_json_is_valid(self):
        # What: the embedded JSON block is parseable — no truncation or corruption.
        # Return: str where the JSON section parses without error

        # ReportPayload — validated payload
        payload = ReportPayload.model_validate(_make_payload())

        # str — user message
        msg = _build_user_message(payload)

        # str — the JSON portion after the instruction line and blank line
        json_part = msg.split("\n\n", 1)[1]
        parsed = json.loads(json_part)
        assert parsed["child"]["name"] == "Yusuf"

    def test_trend_field_preserved(self):
        # What: trend value is serialised correctly into the user message.
        # Return: str containing the trend value

        # ReportPayload — validated payload with "declining" trend
        payload = ReportPayload.model_validate(_make_payload(trend="declining"))

        # str — user message
        msg = _build_user_message(payload)

        assert "declining" in msg


# ---------------------------------------------------------------------------
# TestGenerateReport
# ---------------------------------------------------------------------------

def _mock_anthropic_response(text: str) -> MagicMock:
    # What: builds a MagicMock that mimics the Anthropic messages.create() response
    #       with a single text block containing the provided text.
    # Return: MagicMock — shaped like anthropic.types.Message
    # Example input: "**What's Going Well**..."
    # Example output: MagicMock with .content[0].type="text" and .content[0].text=text

    # MagicMock — fake content block
    block = MagicMock()
    block.type = "text"
    block.text = text

    # MagicMock — fake message object
    message = MagicMock()
    message.content = [block]

    return message


class TestGenerateReport:

    def test_happy_path_returns_report_string(self):
        # What: a valid payload with enough attempts → report string returned.
        # Return: {"report": str}

        # str — fake report text from the mock API
        fake_report = "**What's Going Well**\nGreat work!"

        with patch("report_agent.anthropic.Anthropic") as MockClient:
            MockClient.return_value.messages.create.return_value = (
                _mock_anthropic_response(fake_report)
            )
            # dict — result
            result = generate_report(_make_payload())

        assert result["report"] == fake_report
        assert "reason" not in result

    def test_accepts_raw_dict_input(self):
        # What: a raw dict (not a pre-validated ReportPayload) is accepted and validated.
        # Return: {"report": str}

        # str — fake report text
        fake_report = "Some report content."

        with patch("report_agent.anthropic.Anthropic") as MockClient:
            MockClient.return_value.messages.create.return_value = (
                _mock_anthropic_response(fake_report)
            )
            # dict — result from a raw dict input
            result = generate_report(_make_payload())

        assert result["report"] == fake_report

    def test_accepts_report_payload_instance(self):
        # What: a pre-validated ReportPayload instance is also accepted.
        # Return: {"report": str}

        # ReportPayload — pre-validated instance
        payload = ReportPayload.model_validate(_make_payload())

        # str — fake report text
        fake_report = "Pre-validated path works."

        with patch("report_agent.anthropic.Anthropic") as MockClient:
            MockClient.return_value.messages.create.return_value = (
                _mock_anthropic_response(fake_report)
            )
            # dict — result
            result = generate_report(payload)

        assert result["report"] == fake_report

    def test_mock_mode_skips_api(self):
        # What: when MOCK_API=true env var is set, the real API is not called.
        # Return: {"report": str} with the fixture content

        with patch.dict(os.environ, {"MOCK_API": "true"}):
            with patch("report_agent.anthropic.Anthropic") as MockClient:
                # dict — result in mock mode
                result = generate_report(_make_payload())

        MockClient.assert_not_called()
        assert result["report"] is not None
        assert isinstance(result["report"], str)

    def test_api_exception_returns_api_error(self):
        # What: if the Anthropic client raises an exception, a graceful error dict is returned.
        # Return: {"report": None, "reason": "api_error"}

        with patch("report_agent.anthropic.Anthropic") as MockClient:
            MockClient.return_value.messages.create.side_effect = Exception("network failure")
            # dict — result after API failure
            result = generate_report(_make_payload())

        assert result["report"] is None
        assert result["reason"] == "api_error"

    def test_only_encountered_tricks_sent_to_prompt(self):
        # What: the system prompt sent to the API contains only the child's encountered tricks,
        #       not all 25. This is verified by checking the trick lines injected.
        # Return: the system prompt arg contains A1, A3, C5 but not A2 or D5

        with patch("report_agent.anthropic.Anthropic") as MockClient:
            MockClient.return_value.messages.create.return_value = (
                _mock_anthropic_response("report")
            )
            generate_report(_make_payload())

        # dict — keyword args passed to messages.create
        call_kwargs = MockClient.return_value.messages.create.call_args[1]

        # list[dict] — the system blocks sent in the call
        system_blocks = call_kwargs["system"]

        # str — the assembled system prompt text
        prompt_text = system_blocks[0]["text"]

        # Encountered: A1 (in_progress), A3 and C5 (unlocked)
        assert "A1" in prompt_text
        assert "A3" in prompt_text
        assert "C5" in prompt_text
        # Not encountered: A2 and D5 must be absent
        assert "A2 —" not in prompt_text
        assert "D5 —" not in prompt_text

    def test_no_in_progress_tricks_still_works(self):
        # What: a child with no in_progress tricks still generates a report.
        # Return: {"report": str}

        # dict — payload with empty in_progress list
        payload = _make_payload()
        payload["tricks"]["in_progress"] = []

        # str — fake report
        fake_report = "No tricks in progress report."

        with patch("report_agent.anthropic.Anthropic") as MockClient:
            MockClient.return_value.messages.create.return_value = (
                _mock_anthropic_response(fake_report)
            )
            # dict — result
            result = generate_report(payload)

        assert result["report"] == fake_report

    def test_multi_block_response_joined(self):
        # What: if the API returns multiple text blocks, they are all joined into one string.
        # Return: {"report": str} with both blocks concatenated

        # MagicMock — two text blocks
        block_a = MagicMock()
        block_a.type = "text"
        block_a.text = "Part one."

        block_b = MagicMock()
        block_b.type = "text"
        block_b.text = " Part two."

        # MagicMock — message with two blocks
        message = MagicMock()
        message.content = [block_a, block_b]

        with patch("report_agent.anthropic.Anthropic") as MockClient:
            MockClient.return_value.messages.create.return_value = message
            # dict — result
            result = generate_report(_make_payload())

        assert result["report"] == "Part one. Part two."

    def test_non_text_blocks_ignored(self):
        # What: content blocks that are not text type are silently ignored.
        # Return: {"report": str} with only text block content

        # MagicMock — one non-text block and one text block
        tool_block = MagicMock()
        tool_block.type = "tool_use"
        tool_block.text = "should not appear"  # text attr shouldn't matter

        text_block = MagicMock()
        text_block.type = "text"
        text_block.text = "Real report."

        message = MagicMock()
        message.content = [tool_block, text_block]

        with patch("report_agent.anthropic.Anthropic") as MockClient:
            MockClient.return_value.messages.create.return_value = message
            # dict — result
            result = generate_report(_make_payload())

        assert result["report"] == "Real report."
