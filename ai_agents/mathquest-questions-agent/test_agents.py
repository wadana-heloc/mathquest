# test_agents.py
# Unit tests for the MathQuest agent pipeline.
# Run with: pytest test_agents.py -v
# All tests are offline — no real API calls, no credentials required.
# Anthropic client is mocked with unittest.mock.MagicMock wherever needed.

import json
import os
import pytest
from unittest.mock import MagicMock, patch

from difficulty_engine import (
    compute_session_adjustment,
    get_eligible_tricks,
    compute_difficulty_target,
    compute_trick_mastery,
    TRICK_SEQUENCE,
    PREREQUISITES,
)
from schemas import ChildData, SessionStats, RecentProblem, ChildProfileInput
from config import (
    DIFFICULTY_MIN,
    DIFFICULTY_MAX,
    MIN_PROBLEMS_PER_LEVEL,
    MODEL_NAME,
    AGENT1_MAX_TOKENS,
    AGENT2_MAX_TOKENS,
    RECENT_PROBLEMS_CAP,
)
from agent_generator import (
    generate_problem,
    _build_system_prompt,
    _build_user_message,
    _MOCK_PROBLEM_FIXTURE,
)
from agent_reviewer import (
    review_problem,
    _build_system_prompt as _reviewer_build_system_prompt,
    _build_user_message as _reviewer_build_user_message,
    _MOCK_REVIEWER_FIXTURE,
)
from orchestrator import run_pipeline, _strip_internal_fields, _load_fallback


# ---------------------------------------------------------------------------
# Helpers — build valid Pydantic objects with sensible defaults.
# Tests override only the fields relevant to what they are checking.
# ---------------------------------------------------------------------------

def make_session_stats(avg_time_ms=30000, streak=3, solved_today=5):
    # SessionStats — default represents a normally-paced child
    return SessionStats(
        problems_solved_today=solved_today,
        current_streak=streak,
        avg_time_per_problem_ms=avg_time_ms,
    )


def make_recent_problem(solved=True, hints_used=0, duration_ms=5000, trick_id="A1", difficulty=4):
    # RecentProblem — default represents a clean, unaided correct answer at difficulty 4
    return RecentProblem(
        trick_id=trick_id,
        problem="test problem",
        solved=solved,
        hints_used=hints_used,
        difficulty=difficulty,
        duration_ms=duration_ms,
        insight_detected=False,
        attempts=1,
    )


def make_child(current_difficulty=4, ceiling=10, unlocked=None, avg_time_ms=30000):
    # ChildData — default is a mid-level child with A1 and A2 unlocked
    return ChildData(
        age=8,
        grade=3,
        current_zone=2,
        current_difficulty=current_difficulty,
        difficulty_ceiling=ceiling,
        unlocked_tricks=unlocked if unlocked is not None else ["A1", "A2"],
        session_stats=make_session_stats(avg_time_ms=avg_time_ms),
    )


def make_child_profile_input(num_recent=2):
    # ChildProfileInput — wraps make_child with a list of recent problems
    return ChildProfileInput(
        child=make_child(),
        recent_problems=[make_recent_problem() for _ in range(num_recent)],
    )


# ---------------------------------------------------------------------------
# TestComputeSessionAdjustment
# ---------------------------------------------------------------------------

class TestComputeSessionAdjustment:

    def test_maintain_normal_performance(self):
        # Child is solving problems at a normal pace with some hints — maintain
        stats = make_session_stats(avg_time_ms=40000)
        problems = [make_recent_problem(hints_used=1), make_recent_problem(hints_used=1)]
        result = compute_session_adjustment(stats, problems)
        assert result["delta"] == 0
        assert result["reason"] == "maintain"

    def test_advance_no_hints_fast_no_failures(self):
        # Child solved everything quickly with no hints — advance
        stats = make_session_stats(avg_time_ms=20000)
        problems = [make_recent_problem(solved=True, hints_used=0) for _ in range(3)]
        result = compute_session_adjustment(stats, problems)
        assert result["delta"] == 1
        assert result["reason"] == "advance"

    def test_consolidate_by_hints(self):
        # Total hints across problems >= 3 → consolidate
        stats = make_session_stats(avg_time_ms=20000)
        problems = [
            make_recent_problem(hints_used=1),
            make_recent_problem(hints_used=1),
            make_recent_problem(hints_used=1),
        ]
        result = compute_session_adjustment(stats, problems)
        assert result["delta"] == 0
        assert result["reason"] == "consolidate"

    def test_consolidate_by_failures(self):
        # Two unsolved problems → consolidate
        stats = make_session_stats(avg_time_ms=20000)
        problems = [
            make_recent_problem(solved=False),
            make_recent_problem(solved=False),
            make_recent_problem(solved=True),
        ]
        result = compute_session_adjustment(stats, problems)
        assert result["delta"] == 0
        assert result["reason"] == "consolidate"

    def test_consolidate_by_slow_duration(self):
        # avg_time_per_problem_ms > 90000 → consolidate
        stats = make_session_stats(avg_time_ms=90001)
        problems = [make_recent_problem()]
        result = compute_session_adjustment(stats, problems)
        assert result["delta"] == 0
        assert result["reason"] == "consolidate"

    def test_consolidate_takes_priority_over_advance_conditions(self):
        # Child is fast (advance by time) but used 3 hints (consolidate by hints)
        # Consolidate is checked first and must win
        stats = make_session_stats(avg_time_ms=20000)
        problems = [
            make_recent_problem(hints_used=1),
            make_recent_problem(hints_used=1),
            make_recent_problem(hints_used=1),
        ]
        result = compute_session_adjustment(stats, problems)
        assert result["reason"] == "consolidate"

    def test_boundary_hints_exactly_at_threshold(self):
        # Exactly 3 total hints → consolidate (>= threshold)
        stats = make_session_stats(avg_time_ms=40000)
        problems = [make_recent_problem(hints_used=3)]
        result = compute_session_adjustment(stats, problems)
        assert result["reason"] == "consolidate"

    def test_boundary_hints_one_below_threshold(self):
        # Exactly 2 total hints → not consolidate by hints alone
        stats = make_session_stats(avg_time_ms=40000)
        problems = [make_recent_problem(hints_used=2)]
        result = compute_session_adjustment(stats, problems)
        assert result["reason"] != "consolidate"

    def test_boundary_duration_exactly_at_consolidate_threshold(self):
        # avg_time == 90000ms → not consolidate (rule is strictly >)
        stats = make_session_stats(avg_time_ms=90000)
        problems = [make_recent_problem()]
        result = compute_session_adjustment(stats, problems)
        assert result["reason"] != "consolidate"

    def test_boundary_advance_duration_exactly_at_threshold(self):
        # avg_time == 25000ms → not advance (rule is strictly <)
        stats = make_session_stats(avg_time_ms=25000)
        problems = [make_recent_problem(hints_used=0, solved=True)]
        result = compute_session_adjustment(stats, problems)
        assert result["delta"] != 1

    def test_boundary_advance_duration_one_below_threshold(self):
        # avg_time == 24999ms with no hints, no failures → advance
        stats = make_session_stats(avg_time_ms=24999)
        problems = [make_recent_problem(hints_used=0, solved=True)]
        result = compute_session_adjustment(stats, problems)
        assert result["delta"] == 1
        assert result["reason"] == "advance"

    def test_one_failure_does_not_consolidate(self):
        # Only 1 failed problem — threshold is 2, so no consolidate by failures
        stats = make_session_stats(avg_time_ms=40000)
        problems = [make_recent_problem(solved=False), make_recent_problem(solved=True)]
        result = compute_session_adjustment(stats, problems)
        assert result["reason"] != "consolidate"

    def test_empty_recent_problems_fast_session(self):
        # No history but avg_time is fast → advance (0 hints, 0 failures, fast)
        stats = make_session_stats(avg_time_ms=20000)
        result = compute_session_adjustment(stats, [])
        assert result["delta"] == 1
        assert result["reason"] == "advance"

    def test_result_always_has_delta_and_reason(self):
        # Every path must return a dict with both required keys
        stats = make_session_stats()
        problems = [make_recent_problem()]
        result = compute_session_adjustment(stats, problems)
        assert "delta" in result
        assert "reason" in result


# ---------------------------------------------------------------------------
# TestGetEligibleTricks
# ---------------------------------------------------------------------------

class TestGetEligibleTricks:

    def test_unlocked_plus_two_next(self):
        # Child has A1, A2, A3 unlocked → A4 and A5 are next (no prerequisites)
        result = get_eligible_tricks(["A1", "A2", "A3"], [])
        assert "A1" in result
        assert "A2" in result
        assert "A3" in result
        assert "A4" in result
        assert "A5" in result

    def test_no_unlocked_tricks(self):
        # Child has nothing unlocked → gets first two tricks with no prerequisites
        result = get_eligible_tricks([], [])
        assert result == ["A1", "A2"]

    def test_all_tricks_unlocked(self):
        # Child has all 25 tricks → returns all 25, nothing extra
        result = get_eligible_tricks(TRICK_SEQUENCE, [])
        assert sorted(result) == sorted(TRICK_SEQUENCE)
        assert len(result) == 25

    def test_one_trick_remaining(self):
        # Child has all except D5; D5 requires A5 which is unlocked → D5 is added
        all_but_last = TRICK_SEQUENCE[:-1]
        result = get_eligible_tricks(all_but_last, [])
        assert "D5" in result
        assert len(result) == 25

    def test_no_duplicates_in_output(self):
        # Unlocked tricks must not appear twice in the result
        unlocked = ["A1", "A2"]
        result = get_eligible_tricks(unlocked, [])
        assert len(result) == len(set(result))

    def test_unlocked_tricks_preserved_in_output(self):
        # All originally unlocked tricks are present in the result
        unlocked = ["A1", "A3", "B1"]
        result = get_eligible_tricks(unlocked, [])
        for trick in unlocked:
            assert trick in result

    def test_next_tricks_come_from_sequence_order(self):
        # Child has A1 only → A2 and A3 introduced next (both have no prerequisites)
        # B1 has no prerequisites but comes after A2 and A3 in TRICK_SEQUENCE — not added
        result = get_eligible_tricks(["A1"], [])
        assert "A2" in result
        assert "A3" in result
        assert "B1" not in result

    def test_custom_trick_list(self):
        # get_eligible_tricks accepts a custom sequence (useful for testing subsets)
        custom = ["X1", "X2", "X3", "X4"]
        result = get_eligible_tricks(["X1"], [], all_tricks=custom)
        assert "X1" in result
        assert "X2" in result
        assert "X3" in result
        assert "X4" not in result  # only 2 new tricks added

    def test_struggling_trick_appears_before_solid_trick(self):
        # A trick with a recent failure should be listed before tricks with clean history
        problems = [make_recent_problem(trick_id="A2", solved=False)]
        result = get_eligible_tricks(["A1", "A2"], problems)
        assert result.index("A2") < result.index("A1")

    def test_new_trick_blocked_when_prerequisite_not_unlocked(self):
        # A6 requires A4. If A4 is not unlocked, A6 must not appear in the eligible list.
        result = get_eligible_tricks(["A1", "A2", "A3", "A5"], [])
        assert "A6" not in result

    def test_new_trick_introduced_when_prerequisite_unlocked(self):
        # A6 requires A4. Once A4 is unlocked, A6 can be introduced as a new trick.
        result = get_eligible_tricks(["A1", "A2", "A3", "A4", "A5"], [])
        assert "A6" in result


# ---------------------------------------------------------------------------
# TestComputeDifficultyTarget
# ---------------------------------------------------------------------------

class TestComputeDifficultyTarget:

    def test_advance_increases_difficulty_by_one(self):
        # Fast child, no hints, no failures, and enough problems at this level → advance
        child = make_child(current_difficulty=4, ceiling=10, avg_time_ms=20000)
        problems = [make_recent_problem(solved=True, hints_used=0, difficulty=4) for _ in range(MIN_PROBLEMS_PER_LEVEL)]
        result = compute_difficulty_target(child, problems)
        assert result == 5

    def test_maintain_keeps_current_difficulty(self):
        # Normal performance → difficulty unchanged
        child = make_child(current_difficulty=4, ceiling=10, avg_time_ms=40000)
        problems = [make_recent_problem(hints_used=1)]
        result = compute_difficulty_target(child, problems)
        assert result == 4

    def test_consolidate_keeps_current_difficulty(self):
        # Struggling child → difficulty held, not decreased
        child = make_child(current_difficulty=4, ceiling=10, avg_time_ms=40000)
        problems = [make_recent_problem(hints_used=3)]
        result = compute_difficulty_target(child, problems)
        assert result == 4

    def test_ceiling_clamps_advance(self):
        # Child is at their ceiling with enough volume — advance fires but is clamped
        child = make_child(current_difficulty=5, ceiling=5, avg_time_ms=20000)
        problems = [make_recent_problem(solved=True, hints_used=0, difficulty=5) for _ in range(MIN_PROBLEMS_PER_LEVEL)]
        result = compute_difficulty_target(child, problems)
        assert result == 5

    def test_difficulty_max_clamps_advance(self):
        # Child is at global DIFFICULTY_MAX with enough volume — must not exceed it
        child = make_child(current_difficulty=DIFFICULTY_MAX, ceiling=DIFFICULTY_MAX, avg_time_ms=20000)
        problems = [make_recent_problem(solved=True, hints_used=0, difficulty=DIFFICULTY_MAX) for _ in range(MIN_PROBLEMS_PER_LEVEL)]
        result = compute_difficulty_target(child, problems)
        assert result == DIFFICULTY_MAX

    def test_difficulty_min_preserved(self):
        # Child is at DIFFICULTY_MIN with maintain → stays at minimum
        child = make_child(current_difficulty=DIFFICULTY_MIN, ceiling=10, avg_time_ms=40000)
        problems = [make_recent_problem(hints_used=1)]
        result = compute_difficulty_target(child, problems)
        assert result == DIFFICULTY_MIN

    def test_long_term_advancement_fires_at_80_percent(self):
        # 10 problems, exactly 8 correct (80%) with maintain session → long-term advance
        child = make_child(current_difficulty=4, ceiling=10, avg_time_ms=40000)
        # 8 solved + 2 unsolved = 80%, but 2 unsolved would trigger consolidate...
        # Use a child whose session stats are "maintain" (1 hint, no failures, avg time ok)
        # but recent_problems has 1 failure — however that triggers consolidate by failures
        # So we need session stats that produce maintain while having 10 problems with 80% correct.
        # Use a custom session stats: avg_time in maintain range, 1 hint total (below threshold)
        child2 = ChildData(
            age=8,
            grade=3,
            current_zone=2,
            current_difficulty=4,
            difficulty_ceiling=10,
            unlocked_tricks=["A1"],
            session_stats=SessionStats(
                problems_solved_today=10,
                current_streak=2,
                avg_time_per_problem_ms=40000,
            ),
        )
        # 10 problems: 8 solved, 2 unsolved — but 2 failures triggers consolidate!
        # Use 8 solved + 2 solved with 1 hint each (1 hint each = 2 total, below threshold)
        problems = (
            [make_recent_problem(solved=True, hints_used=1)] * 2
            + [make_recent_problem(solved=True, hints_used=0)] * 8
        )
        result = compute_difficulty_target(child2, problems)
        # Session: 2 hints (below 3), 0 failures, avg 40000 (maintain) → delta=0
        # Long-term: 10/10 correct = 100% >= 80% → +1
        assert result == 5

    def test_long_term_advancement_requires_10_problems(self):
        # Only 9 problems — long-term rule must not fire even with 100% correct
        child = make_child(current_difficulty=4, ceiling=10, avg_time_ms=40000)
        problems = [make_recent_problem(hints_used=1)] * 9
        result = compute_difficulty_target(child, problems)
        assert result == 4

    def test_long_term_advancement_below_80_percent(self):
        # 10 problems, 7 solved + 3 unsolved = 70% correct rate
        # 3 failures triggers consolidate (delta=0); long-term then checks 70% < 80% → no advance
        child = make_child(current_difficulty=4, ceiling=10, avg_time_ms=40000)
        problems = (
            [make_recent_problem(solved=True, hints_used=0)] * 7
            + [make_recent_problem(solved=False, hints_used=0)] * 3
        )
        result = compute_difficulty_target(child, problems)
        assert result == 4

    def test_no_double_advance_when_session_already_advanced(self):
        # Session signals advance (delta=+1) AND 10-problem window is 100% correct
        # Long-term rule must be skipped to avoid advancing by 2
        child = make_child(current_difficulty=4, ceiling=10, avg_time_ms=20000)
        problems = [make_recent_problem(solved=True, hints_used=0)] * 10
        result = compute_difficulty_target(child, problems)
        # Session advance: delta=+1 → target=5
        # Long-term: skipped because delta != 0
        assert result == 5

    def test_long_term_advance_respects_ceiling(self):
        # Long-term rule fires but ceiling prevents going above it
        child = ChildData(
            age=8,
            grade=3,
            current_zone=2,
            current_difficulty=5,
            difficulty_ceiling=5,
            unlocked_tricks=["A1"],
            session_stats=SessionStats(
                problems_solved_today=10,
                current_streak=5,
                avg_time_per_problem_ms=40000,
            ),
        )
        problems = [make_recent_problem(solved=True, hints_used=1)] * 2 + [make_recent_problem(solved=True, hints_used=0)] * 8
        result = compute_difficulty_target(child, problems)
        # Long-term fires (100% correct, delta=0), target would be 6, ceiling clamps to 5
        assert result == 5

    def test_advance_blocked_when_too_few_problems_at_level(self):
        # Child is excelling (fast, no hints) but has fewer than MIN_PROBLEMS_PER_LEVEL
        # correct solves at the current difficulty — advance must be held back.
        child = make_child(current_difficulty=4, ceiling=10, avg_time_ms=20000)
        problems = [make_recent_problem(solved=True, hints_used=0, difficulty=4) for _ in range(MIN_PROBLEMS_PER_LEVEL - 1)]
        result = compute_difficulty_target(child, problems)
        assert result == 4

    def test_long_term_advance_blocked_by_insufficient_volume_at_level(self):
        # 10 problems satisfy the long-term window, but only 3 are at the current
        # difficulty — the volume requirement blocks the long-term advance.
        child = make_child(current_difficulty=4, ceiling=10, avg_time_ms=40000)
        problems = (
            [make_recent_problem(solved=True, hints_used=0, difficulty=4)] * 3
            + [make_recent_problem(solved=True, hints_used=0, difficulty=3)] * 7
        )
        result = compute_difficulty_target(child, problems)
        assert result == 4

    def test_result_is_always_int(self):
        # Return type must always be int, never float
        child = make_child(current_difficulty=3, ceiling=10, avg_time_ms=20000)
        problems = [make_recent_problem()]
        result = compute_difficulty_target(child, problems)
        assert isinstance(result, int)

    def test_result_never_below_difficulty_min(self):
        # No path through the engine should produce a result below DIFFICULTY_MIN
        child = make_child(current_difficulty=DIFFICULTY_MIN, ceiling=10, avg_time_ms=95000)
        problems = [make_recent_problem(solved=False), make_recent_problem(solved=False)]
        result = compute_difficulty_target(child, problems)
        assert result >= DIFFICULTY_MIN


# ---------------------------------------------------------------------------
# TestComputeTrickMastery
# ---------------------------------------------------------------------------

class TestComputeTrickMastery:

    def test_empty_input_returns_empty_dict(self):
        # No recent problems → no mastery data
        result = compute_trick_mastery([])
        assert result == {}

    def test_single_correct_problem(self):
        # One correct, hint-free problem → correct=1, failed=0, total_hints=0
        problems = [make_recent_problem(trick_id="A1", solved=True, hints_used=0)]
        result = compute_trick_mastery(problems)
        assert result["A1"]["correct"] == 1
        assert result["A1"]["failed"] == 0
        assert result["A1"]["total_hints"] == 0

    def test_single_failed_problem(self):
        # One failed problem with hints → failed=1, correct=0, hints accumulated
        problems = [make_recent_problem(trick_id="A1", solved=False, hints_used=2)]
        result = compute_trick_mastery(problems)
        assert result["A1"]["failed"] == 1
        assert result["A1"]["correct"] == 0
        assert result["A1"]["total_hints"] == 2

    def test_multiple_problems_same_trick(self):
        # Three problems on B1: 2 correct, 1 failed, hints summed
        problems = [
            make_recent_problem(trick_id="B1", solved=True, hints_used=0),
            make_recent_problem(trick_id="B1", solved=True, hints_used=1),
            make_recent_problem(trick_id="B1", solved=False, hints_used=0),
        ]
        result = compute_trick_mastery(problems)
        assert result["B1"]["correct"] == 2
        assert result["B1"]["failed"] == 1
        assert result["B1"]["total_hints"] == 1

    def test_multiple_different_tricks(self):
        # Two different tricks each appear as separate keys
        problems = [
            make_recent_problem(trick_id="A1", solved=True, hints_used=0),
            make_recent_problem(trick_id="A2", solved=False, hints_used=1),
        ]
        result = compute_trick_mastery(problems)
        assert "A1" in result
        assert "A2" in result
        assert result["A1"]["correct"] == 1
        assert result["A2"]["failed"] == 1

    def test_hints_accumulated_across_multiple_problems(self):
        # Hints from all problems on the same trick are summed together
        problems = [
            make_recent_problem(trick_id="C1", solved=True, hints_used=2),
            make_recent_problem(trick_id="C1", solved=True, hints_used=3),
        ]
        result = compute_trick_mastery(problems)
        assert result["C1"]["total_hints"] == 5

    def test_output_always_has_three_keys_per_trick(self):
        # Every trick entry must have correct, failed, and total_hints
        problems = [make_recent_problem(trick_id="D1")]
        result = compute_trick_mastery(problems)
        assert "correct" in result["D1"]
        assert "failed" in result["D1"]
        assert "total_hints" in result["D1"]


# ---------------------------------------------------------------------------
# TestBuildSystemPrompt
# ---------------------------------------------------------------------------

class TestBuildSystemPrompt:

    def test_returns_a_list(self):
        # Anthropic expects system as a list of content blocks
        result = _build_system_prompt()
        assert isinstance(result, list)

    def test_returns_exactly_one_block(self):
        # One system prompt block is all Agent 1 needs
        result = _build_system_prompt()
        assert len(result) == 1

    def test_block_type_is_text(self):
        # Anthropic content blocks must declare their type
        result = _build_system_prompt()
        assert result[0]["type"] == "text"

    def test_text_is_non_empty(self):
        # The system prompt must actually contain instructions
        result = _build_system_prompt()
        assert len(result[0]["text"]) > 0

    def test_cache_control_present_when_caching_enabled(self):
        # When PROMPT_CACHING_ENABLED is True the block must carry cache_control
        with patch("agent_generator.PROMPT_CACHING_ENABLED", True):
            result = _build_system_prompt()
        assert "cache_control" in result[0]
        assert result[0]["cache_control"] == {"type": "ephemeral"}

    def test_no_cache_control_when_caching_disabled(self):
        # When PROMPT_CACHING_ENABLED is False the block must not carry cache_control
        with patch("agent_generator.PROMPT_CACHING_ENABLED", False):
            result = _build_system_prompt()
        assert "cache_control" not in result[0]


# ---------------------------------------------------------------------------
# TestBuildUserMessage
# ---------------------------------------------------------------------------

class TestBuildUserMessage:

    def test_difficulty_target_in_message(self):
        # The difficulty target must appear in the user message so Agent 1 sees it
        profile = make_child_profile_input()
        result = _build_user_message(profile, 7, ["A1"])
        assert "7" in result

    def test_eligible_trick_id_in_message(self):
        # The eligible trick's ID must appear in the message
        profile = make_child_profile_input()
        result = _build_user_message(profile, 4, ["A1"])
        assert "A1" in result

    def test_eligible_trick_description_in_message(self):
        # The trick description (not just the ID) must be included so Agent 1
        # knows what the trick actually does
        profile = make_child_profile_input()
        result = _build_user_message(profile, 4, ["A1"])
        assert "Digit-Sum" in result

    def test_unknown_trick_id_silently_skipped(self):
        # A trick_id not in the reference must not crash — just skip it
        profile = make_child_profile_input()
        result = _build_user_message(profile, 4, ["A1", "FAKE_TRICK"])
        assert "FAKE_TRICK" not in result
        assert "A1" in result

    def test_recent_problems_capped(self):
        # Only the last RECENT_PROBLEMS_CAP problems must appear in the message.
        # Each RecentProblem has a "solved" field — count its occurrences as a proxy.
        profile = make_child_profile_input(num_recent=RECENT_PROBLEMS_CAP + 3)
        result = _build_user_message(profile, 4, ["A1"])
        # json.dumps renders booleans as "true"/"false"; count "solved" key occurrences
        assert result.count('"solved"') == RECENT_PROBLEMS_CAP

    def test_child_age_in_message(self):
        # The child's age must appear in the serialised profile
        profile = make_child_profile_input()
        result = _build_user_message(profile, 4, ["A1"])
        assert str(profile.child.age) in result


# ---------------------------------------------------------------------------
# TestGenerateProblem
# ---------------------------------------------------------------------------

class TestGenerateProblem:

    def _make_mock_client(self, response_text):
        # Helper — builds a MagicMock Anthropic client that returns response_text
        # as the first content block's text, simulating a real API response.
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=response_text)]
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_response
        return mock_client

    def test_mock_mode_returns_fixture(self):
        # When MOCK_API=true the fixture is returned without any API call
        with patch.dict(os.environ, {"MOCK_API": "true"}):
            result = generate_problem(make_child_profile_input(), 4, ["A1"])
        assert result == _MOCK_PROBLEM_FIXTURE

    def test_mock_mode_does_not_call_api(self):
        # When MOCK_API=true the Anthropic client must never be constructed
        with patch("agent_generator.anthropic.Anthropic") as mock_cls:
            with patch.dict(os.environ, {"MOCK_API": "true"}):
                generate_problem(make_child_profile_input(), 4, ["A1"])
        mock_cls.assert_not_called()

    def test_returns_parsed_dict_on_success(self):
        # A valid JSON response from the API must be returned as a Python dict
        mock_client = self._make_mock_client(json.dumps(_MOCK_PROBLEM_FIXTURE))
        with patch("agent_generator.anthropic.Anthropic", return_value=mock_client):
            with patch.dict(os.environ, {"MOCK_API": "false"}):
                result = generate_problem(make_child_profile_input(), 4, ["A1"])
        assert result == _MOCK_PROBLEM_FIXTURE

    def test_returns_none_on_invalid_json(self):
        # If the API returns text that is not valid JSON, return None
        mock_client = self._make_mock_client("not valid json {{{{")
        with patch("agent_generator.anthropic.Anthropic", return_value=mock_client):
            with patch.dict(os.environ, {"MOCK_API": "false"}):
                result = generate_problem(make_child_profile_input(), 4, ["A1"])
        assert result is None

    def test_returns_none_on_api_exception(self):
        # If the API raises any exception, return None so the orchestrator can retry
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = Exception("network error")
        with patch("agent_generator.anthropic.Anthropic", return_value=mock_client):
            with patch.dict(os.environ, {"MOCK_API": "false"}):
                result = generate_problem(make_child_profile_input(), 4, ["A1"])
        assert result is None

    def test_api_called_with_correct_model(self):
        # The model name must come from config, never hardcoded
        mock_client = self._make_mock_client(json.dumps(_MOCK_PROBLEM_FIXTURE))
        with patch("agent_generator.anthropic.Anthropic", return_value=mock_client):
            with patch.dict(os.environ, {"MOCK_API": "false"}):
                generate_problem(make_child_profile_input(), 4, ["A1"])
        kwargs = mock_client.messages.create.call_args.kwargs
        assert kwargs["model"] == MODEL_NAME

    def test_api_called_with_correct_max_tokens(self):
        # max_tokens must come from config — never exceed the Agent 1 limit
        mock_client = self._make_mock_client(json.dumps(_MOCK_PROBLEM_FIXTURE))
        with patch("agent_generator.anthropic.Anthropic", return_value=mock_client):
            with patch.dict(os.environ, {"MOCK_API": "false"}):
                generate_problem(make_child_profile_input(), 4, ["A1"])
        kwargs = mock_client.messages.create.call_args.kwargs
        assert kwargs["max_tokens"] == AGENT1_MAX_TOKENS

    def test_system_prompt_passed_to_api(self):
        # The system parameter must be present in the API call
        mock_client = self._make_mock_client(json.dumps(_MOCK_PROBLEM_FIXTURE))
        with patch("agent_generator.anthropic.Anthropic", return_value=mock_client):
            with patch.dict(os.environ, {"MOCK_API": "false"}):
                generate_problem(make_child_profile_input(), 4, ["A1"])
        kwargs = mock_client.messages.create.call_args.kwargs
        assert "system" in kwargs
        assert isinstance(kwargs["system"], list)

    def test_user_message_passed_to_api(self):
        # The messages list must contain exactly one user turn
        mock_client = self._make_mock_client(json.dumps(_MOCK_PROBLEM_FIXTURE))
        with patch("agent_generator.anthropic.Anthropic", return_value=mock_client):
            with patch.dict(os.environ, {"MOCK_API": "false"}):
                generate_problem(make_child_profile_input(), 4, ["A1"])
        kwargs = mock_client.messages.create.call_args.kwargs
        assert kwargs["messages"][0]["role"] == "user"


# ---------------------------------------------------------------------------
# Shared fixtures for reviewer tests
# ---------------------------------------------------------------------------

# dict — a minimal valid trick description (A1) used across reviewer tests
_SAMPLE_TRICK = {
    "trick_id": "A1",
    "name": "×11 Digit-Sum Rule",
    "category": "A",
    "category_name": "Pattern Shortcuts",
    "description": "11 × AB = A(A+B)B for two-digit numbers where A+B < 10.",
}


# ---------------------------------------------------------------------------
# TestReviewerBuildSystemPrompt
# ---------------------------------------------------------------------------

class TestReviewerBuildSystemPrompt:

    def test_returns_a_list(self):
        result = _reviewer_build_system_prompt()
        assert isinstance(result, list)

    def test_returns_exactly_one_block(self):
        result = _reviewer_build_system_prompt()
        assert len(result) == 1

    def test_block_type_is_text(self):
        result = _reviewer_build_system_prompt()
        assert result[0]["type"] == "text"

    def test_text_is_non_empty(self):
        result = _reviewer_build_system_prompt()
        assert len(result[0]["text"]) > 0

    def test_cache_control_present_when_caching_enabled(self):
        with patch("agent_reviewer.PROMPT_CACHING_ENABLED", True):
            result = _reviewer_build_system_prompt()
        assert "cache_control" in result[0]
        assert result[0]["cache_control"] == {"type": "ephemeral"}

    def test_no_cache_control_when_caching_disabled(self):
        with patch("agent_reviewer.PROMPT_CACHING_ENABLED", False):
            result = _reviewer_build_system_prompt()
        assert "cache_control" not in result[0]


# ---------------------------------------------------------------------------
# TestReviewerBuildUserMessage
# ---------------------------------------------------------------------------

class TestReviewerBuildUserMessage:

    def test_trick_id_in_message(self):
        # The trick description must appear so Agent 2 knows what trick to evaluate
        result = _reviewer_build_user_message(_MOCK_PROBLEM_FIXTURE, _SAMPLE_TRICK)
        assert "A1" in result

    def test_problem_answer_in_message(self):
        # The problem JSON must appear in full so Agent 2 can check every field
        result = _reviewer_build_user_message(_MOCK_PROBLEM_FIXTURE, _SAMPLE_TRICK)
        assert str(_MOCK_PROBLEM_FIXTURE["answer"]) in result

    def test_trick_description_in_message(self):
        # The trick description text must be present so Agent 2 can verify alignment
        result = _reviewer_build_user_message(_MOCK_PROBLEM_FIXTURE, _SAMPLE_TRICK)
        assert "Digit-Sum" in result

    def test_child_profile_not_in_message(self):
        # Agent 2 must never receive the child profile — not needed, wastes tokens
        result = _reviewer_build_user_message(_MOCK_PROBLEM_FIXTURE, _SAMPLE_TRICK)
        assert "recent_problems" not in result
        assert "unlocked_tricks" not in result


# ---------------------------------------------------------------------------
# TestReviewProblem
# ---------------------------------------------------------------------------

class TestReviewProblem:

    def _make_mock_client(self, response_text):
        # Helper — builds a MagicMock client returning response_text as the API response
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=response_text)]
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_response
        return mock_client

    def test_mock_mode_returns_fixture(self):
        # When MOCK_API=true the approval fixture is returned without any API call
        with patch.dict(os.environ, {"MOCK_API": "true"}):
            result = review_problem(_MOCK_PROBLEM_FIXTURE, _SAMPLE_TRICK)
        assert result == _MOCK_REVIEWER_FIXTURE

    def test_mock_mode_does_not_call_api(self):
        # When MOCK_API=true the Anthropic client must never be constructed
        with patch("agent_reviewer.anthropic.Anthropic") as mock_cls:
            with patch.dict(os.environ, {"MOCK_API": "true"}):
                review_problem(_MOCK_PROBLEM_FIXTURE, _SAMPLE_TRICK)
        mock_cls.assert_not_called()

    def test_returns_parsed_dict_on_success(self):
        # A valid JSON response from the API must be returned as a Python dict
        mock_client = self._make_mock_client(json.dumps(_MOCK_REVIEWER_FIXTURE))
        with patch("agent_reviewer.anthropic.Anthropic", return_value=mock_client):
            with patch.dict(os.environ, {"MOCK_API": "false"}):
                result = review_problem(_MOCK_PROBLEM_FIXTURE, _SAMPLE_TRICK)
        assert result == _MOCK_REVIEWER_FIXTURE

    def test_returns_none_on_invalid_json(self):
        # If the API returns text that is not valid JSON, return None
        mock_client = self._make_mock_client("not valid json {{{{")
        with patch("agent_reviewer.anthropic.Anthropic", return_value=mock_client):
            with patch.dict(os.environ, {"MOCK_API": "false"}):
                result = review_problem(_MOCK_PROBLEM_FIXTURE, _SAMPLE_TRICK)
        assert result is None

    def test_returns_none_on_api_exception(self):
        # If the API raises any exception, return None so the orchestrator can fall back
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = Exception("network error")
        with patch("agent_reviewer.anthropic.Anthropic", return_value=mock_client):
            with patch.dict(os.environ, {"MOCK_API": "false"}):
                result = review_problem(_MOCK_PROBLEM_FIXTURE, _SAMPLE_TRICK)
        assert result is None

    def test_api_called_with_correct_model(self):
        # The model name must come from config, never hardcoded
        mock_client = self._make_mock_client(json.dumps(_MOCK_REVIEWER_FIXTURE))
        with patch("agent_reviewer.anthropic.Anthropic", return_value=mock_client):
            with patch.dict(os.environ, {"MOCK_API": "false"}):
                review_problem(_MOCK_PROBLEM_FIXTURE, _SAMPLE_TRICK)
        kwargs = mock_client.messages.create.call_args.kwargs
        assert kwargs["model"] == MODEL_NAME

    def test_api_called_with_agent2_max_tokens(self):
        # Agent 2 must use AGENT2_MAX_TOKENS (300), not Agent 1's limit (600)
        mock_client = self._make_mock_client(json.dumps(_MOCK_REVIEWER_FIXTURE))
        with patch("agent_reviewer.anthropic.Anthropic", return_value=mock_client):
            with patch.dict(os.environ, {"MOCK_API": "false"}):
                review_problem(_MOCK_PROBLEM_FIXTURE, _SAMPLE_TRICK)
        kwargs = mock_client.messages.create.call_args.kwargs
        assert kwargs["max_tokens"] == AGENT2_MAX_TOKENS

    def test_max_tokens_less_than_generator(self):
        # The reviewer token limit must be strictly less than the generator's
        assert AGENT2_MAX_TOKENS < AGENT1_MAX_TOKENS

    def test_system_prompt_passed_to_api(self):
        mock_client = self._make_mock_client(json.dumps(_MOCK_REVIEWER_FIXTURE))
        with patch("agent_reviewer.anthropic.Anthropic", return_value=mock_client):
            with patch.dict(os.environ, {"MOCK_API": "false"}):
                review_problem(_MOCK_PROBLEM_FIXTURE, _SAMPLE_TRICK)
        kwargs = mock_client.messages.create.call_args.kwargs
        assert "system" in kwargs
        assert isinstance(kwargs["system"], list)

    def test_user_message_passed_to_api(self):
        mock_client = self._make_mock_client(json.dumps(_MOCK_REVIEWER_FIXTURE))
        with patch("agent_reviewer.anthropic.Anthropic", return_value=mock_client):
            with patch.dict(os.environ, {"MOCK_API": "false"}):
                review_problem(_MOCK_PROBLEM_FIXTURE, _SAMPLE_TRICK)
        kwargs = mock_client.messages.create.call_args.kwargs
        assert kwargs["messages"][0]["role"] == "user"


# ---------------------------------------------------------------------------
# TestStripInternalFields
# ---------------------------------------------------------------------------

class TestStripInternalFields:

    def test_removes_shortcut_path(self):
        # shortcut_path must never reach the child client
        problem = dict(_MOCK_PROBLEM_FIXTURE)
        result = _strip_internal_fields(problem)
        assert "shortcut_path" not in result

    def test_removes_brute_force_path(self):
        # brute_force_path must never reach the child client
        problem = dict(_MOCK_PROBLEM_FIXTURE)
        result = _strip_internal_fields(problem)
        assert "brute_force_path" not in result

    def test_preserves_all_other_fields(self):
        # All non-internal fields must pass through unchanged
        problem = dict(_MOCK_PROBLEM_FIXTURE)
        result = _strip_internal_fields(problem)
        for key in problem:
            if key not in ("shortcut_path", "brute_force_path"):
                assert key in result
                assert result[key] == problem[key]

    def test_does_not_mutate_original(self):
        # The original problem dict must not be modified
        problem = dict(_MOCK_PROBLEM_FIXTURE)
        _strip_internal_fields(problem)
        assert "shortcut_path" in problem
        assert "brute_force_path" in problem

    def test_safe_when_fields_already_absent(self):
        # Must not raise if the internal fields were never present
        problem = {"id": "p_001", "answer": 42}
        result = _strip_internal_fields(problem)
        assert result == {"id": "p_001", "answer": 42}


# ---------------------------------------------------------------------------
# TestLoadFallback
# ---------------------------------------------------------------------------

class TestLoadFallback:

    def test_returns_dict(self):
        # Always returns a dict regardless of whether a file exists
        result = _load_fallback("A1", 4)
        assert isinstance(result, dict)

    def test_internal_fields_stripped(self):
        # The returned problem must not contain internal fields
        result = _load_fallback("A1", 4)
        assert "shortcut_path" not in result
        assert "brute_force_path" not in result

    def test_missing_file_returns_mock_fixture(self):
        # When no fallback file exists, the mock fixture is returned (stripped)
        result = _load_fallback("Z9", 99)
        assert result["trick_id"] == _MOCK_PROBLEM_FIXTURE["trick_id"]
        assert result["answer"] == _MOCK_PROBLEM_FIXTURE["answer"]

    def test_loads_from_file_when_exists(self):
        # When a matching file exists it must be loaded and returned.
        # We mock only the terminal path object so exists() and read_text()
        # return controlled values without touching the real filesystem.
        fallback_data = dict(_MOCK_PROBLEM_FIXTURE)
        fallback_data["id"] = "fallback_test"

        # MagicMock — stands in for the resolved fallback_path inside _load_fallback
        mock_fallback_path = MagicMock()
        mock_fallback_path.exists.return_value = True
        mock_fallback_path.read_text.return_value = json.dumps(fallback_data)

        with patch("orchestrator.Path") as mock_path_cls:
            # Path(__file__).parent / "fallback_problems" / "B1_d3.json"
            # = mock_path_cls() -> .parent -> / -> / -> mock_fallback_path
            mock_path_cls.return_value.parent.__truediv__.return_value.__truediv__.return_value = mock_fallback_path

            result = _load_fallback("B1", 3)

        assert result["id"] == "fallback_test"


# ---------------------------------------------------------------------------
# TestRunPipeline
# ---------------------------------------------------------------------------

class TestRunPipeline:

    def _approved_review(self):
        # Builds a mock review_problem that always approves
        return MagicMock(return_value=_MOCK_REVIEWER_FIXTURE)

    def test_happy_path_returns_stripped_problem(self):
        # Full pipeline succeeds on first attempt — result has no internal fields
        with patch("orchestrator.generate_problem", return_value=_MOCK_PROBLEM_FIXTURE):
            with patch("orchestrator.review_problem", return_value=_MOCK_REVIEWER_FIXTURE):
                result = run_pipeline(make_child_profile_input())
        assert "shortcut_path" not in result
        assert "brute_force_path" not in result
        assert result["answer"] == _MOCK_PROBLEM_FIXTURE["answer"]

    def test_returns_corrected_problem_when_rejected_with_correction(self):
        # Agent 2 rejects but provides a corrected problem — corrected version is returned
        corrected = dict(_MOCK_PROBLEM_FIXTURE)
        corrected["id"] = "corrected_001"
        review_with_correction = {
            "approved": False,
            "issues": ["difficulty mismatch"],
            "corrected_problem": corrected,
        }
        with patch("orchestrator.generate_problem", return_value=_MOCK_PROBLEM_FIXTURE):
            with patch("orchestrator.review_problem", return_value=review_with_correction):
                result = run_pipeline(make_child_profile_input())
        assert result["id"] == "corrected_001"

    def test_falls_back_when_generator_always_returns_none(self):
        # Agent 1 fails on every attempt — fallback must be returned
        with patch("orchestrator.generate_problem", return_value=None):
            with patch("orchestrator.time.sleep"):
                result = run_pipeline(make_child_profile_input())
        assert isinstance(result, dict)
        assert "answer" in result

    def test_falls_back_when_pydantic_validation_always_fails(self):
        # Agent 1 returns malformed JSON that fails Pydantic — fallback returned
        with patch("orchestrator.generate_problem", return_value={"bad": "data"}):
            with patch("orchestrator.time.sleep"):
                result = run_pipeline(make_child_profile_input())
        assert isinstance(result, dict)

    def test_falls_back_when_reviewer_always_returns_none(self):
        # Agent 2 always fails — fallback returned after retries
        with patch("orchestrator.generate_problem", return_value=_MOCK_PROBLEM_FIXTURE):
            with patch("orchestrator.review_problem", return_value=None):
                with patch("orchestrator.time.sleep"):
                    result = run_pipeline(make_child_profile_input())
        assert isinstance(result, dict)

    def test_retries_before_fallback(self):
        # generate_problem should be called MAX_RETRIES + 1 times before fallback
        from config import MAX_RETRIES
        with patch("orchestrator.generate_problem", return_value=None) as mock_gen:
            with patch("orchestrator.time.sleep"):
                run_pipeline(make_child_profile_input())
        assert mock_gen.call_count == MAX_RETRIES + 1

    def test_sleep_called_between_retries(self):
        # time.sleep must be called between attempts (not before the first)
        from config import MAX_RETRIES
        with patch("orchestrator.generate_problem", return_value=None):
            with patch("orchestrator.time.sleep") as mock_sleep:
                run_pipeline(make_child_profile_input())
        assert mock_sleep.call_count == MAX_RETRIES

    def test_result_is_always_a_dict(self):
        # run_pipeline must never return None — always a dict
        with patch("orchestrator.generate_problem", return_value=None):
            with patch("orchestrator.time.sleep"):
                result = run_pipeline(make_child_profile_input())
        assert result is not None
        assert isinstance(result, dict)
