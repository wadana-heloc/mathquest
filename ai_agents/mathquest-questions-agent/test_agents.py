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
    CALIBRATION_DELTA,
    CALIBRATION_SLOW_DELTA,
    CALIBRATION_DROP,
    ADVANCE_DURATION_THRESHOLD_MS,
    CONSOLIDATE_HINTS_THRESHOLD,
    CONSOLIDATE_DURATION_THRESHOLD_MS,
    MIN_PROBLEMS_PER_LEVEL,
    MODEL_NAME,
    AGENT1_MAX_TOKENS,
    AGENT2_MAX_TOKENS,
    RECENT_PROBLEMS_CAP,
    MIN_BANK_SIZE,
    DISCOVERY_PROBLEMS_REQUIRED,
    MIN_PRACTICE_PROBLEMS,
    MASTERY_THRESHOLD,
    WEIGHT_RETRY,
    WEIGHT_UNSEEN,
    WEIGHT_PHASE_FIT,
    WEIGHT_DIFFICULTY_PENALTY,
    MAX_PROBLEMS_PER_TRICK,
)
from problem_recommender import (
    score_candidate,
    pick_best_problem,
    check_phase_signal,
    build_response,
    recommend,
)
from difficulty_adjuster import (
    compute_difficulty_adjustment,
    check_mastery,
    compute_phase_update,
    build_adjuster_response,
    process_answer,
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
        # The bank JSON must be nested as {trick_id: {str(difficulty): problem}}.
        fallback_problem = dict(_MOCK_PROBLEM_FIXTURE)
        fallback_problem["id"] = "fallback_test"
        # dict — bank JSON keyed by trick_id → str(difficulty) → problem, matching
        # the format _load_fallback expects when it calls bank.get(trick_id)
        bank_json = {"B1": {"3": fallback_problem}}

        # MagicMock — stands in for the resolved bank_path inside _load_fallback
        mock_fallback_path = MagicMock()
        mock_fallback_path.exists.return_value = True
        mock_fallback_path.read_text.return_value = json.dumps(bank_json)

        with patch("orchestrator.Path") as mock_path_cls:
            # Path(__file__).parent / "fallback_problems" / "fallback_bank.json"
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


# ---------------------------------------------------------------------------
# Helpers for recommender / adjuster tests
# ---------------------------------------------------------------------------

def make_candidate(
    id="p_001",
    trick_id="A1",
    difficulty=4,
    grade=3,
    phase_tag="practice",
    previously_failed=False,
):
    # dict — a single candidate problem with sensible defaults
    return {
        "id": id,
        "trick_id": trick_id,
        "difficulty": difficulty,
        "grade": grade,
        "phase_tag": phase_tag,
        "previously_failed": previously_failed,
    }


def make_recommender_child(
    current_phase="practice",
    current_difficulty=4,
    discovery_problems_seen=0,
    current_trick="A1",
):
    # dict — a child profile for recommender tests
    return {
        "id": 42,
        "age": 8,
        "grade": 3,
        "current_zone": 2,
        "current_difficulty": current_difficulty,
        "difficulty_ceiling": 10,
        "current_trick": current_trick,
        "current_phase": current_phase,
        "unlocked_tricks": ["A1", "A2"],
        "discovery_problems_seen": discovery_problems_seen,
        "session_stats": {
            "problems_solved_today": 5,
            "current_streak": 3,
            "avg_time_per_problem_ms": 4200,
        },
    }


def make_answer_result(correct=True, hints_used=0, duration_ms=20000, attempts=1):
    # dict — one answer result for adjuster tests
    return {
        "correct": correct,
        "hints_used": hints_used,
        "duration_ms": duration_ms,
        "attempts": attempts,
    }


def make_recent_performance(n=10, correct=True, hints_used=0, duration_ms=3000, difficulty=4):
    # list[dict] — n identical performance entries for adjuster tests
    return [
        {"correct": correct, "hints_used": hints_used, "duration_ms": duration_ms, "difficulty": difficulty}
        for _ in range(n)
    ]


# ---------------------------------------------------------------------------
# TestScoreCandidate
# ---------------------------------------------------------------------------

class TestScoreCandidate:

    def test_phase_match_gives_higher_score_than_mismatch(self):
        # A candidate whose phase matches the child's phase should score higher
        child = make_recommender_child(current_phase="practice")
        match = make_candidate(phase_tag="practice")
        mismatch = make_candidate(phase_tag="discovery")
        assert score_candidate(match, child) > score_candidate(mismatch, child)

    def test_previously_failed_gets_higher_score_than_unseen(self):
        # A retry (previously_failed=True) should outscore a fresh unseen problem
        child = make_recommender_child()
        retry = make_candidate(previously_failed=True)
        unseen = make_candidate(previously_failed=False)
        assert score_candidate(retry, child) > score_candidate(unseen, child)

    def test_difficulty_delta_penalises_off_target_problems(self):
        # A problem 2 levels above current_difficulty should score lower than on-target
        child = make_recommender_child(current_difficulty=4)
        on_target = make_candidate(difficulty=4)
        off_target = make_candidate(difficulty=6)
        assert score_candidate(on_target, child) > score_candidate(off_target, child)

    def test_all_weights_sum_correctly_for_perfect_fit(self):
        # Perfect fit: unseen, phase matches, difficulty exact → WEIGHT_UNSEEN + WEIGHT_PHASE_FIT
        child = make_recommender_child(current_phase="practice", current_difficulty=4)
        perfect = make_candidate(phase_tag="practice", difficulty=4, previously_failed=False)
        expected = WEIGHT_UNSEEN + WEIGHT_PHASE_FIT
        assert score_candidate(perfect, child) == expected

    def test_retry_candidate_score_includes_retry_weight(self):
        # Retry candidate: previously_failed=True, phase match, difficulty exact
        # Score = WEIGHT_RETRY + WEIGHT_PHASE_FIT (no WEIGHT_UNSEEN because previously_failed)
        child = make_recommender_child(current_phase="practice", current_difficulty=4)
        retry = make_candidate(phase_tag="practice", difficulty=4, previously_failed=True)
        expected = WEIGHT_RETRY + WEIGHT_PHASE_FIT
        assert score_candidate(retry, child) == expected

    def test_difficulty_penalty_is_applied_per_unit(self):
        # Two-unit mismatch should subtract 2 * WEIGHT_DIFFICULTY_PENALTY
        child = make_recommender_child(current_difficulty=4)
        candidate = make_candidate(difficulty=6, phase_tag="discovery", previously_failed=False)
        expected = WEIGHT_UNSEEN - 2 * WEIGHT_DIFFICULTY_PENALTY
        assert score_candidate(candidate, child) == expected


# ---------------------------------------------------------------------------
# TestPickBestProblem
# ---------------------------------------------------------------------------

class TestPickBestProblem:

    def test_returns_highest_scoring_candidate(self):
        # The candidate with the perfect-fit score should win
        child = make_recommender_child(current_phase="practice", current_difficulty=4)
        good = make_candidate(id="good", phase_tag="practice", difficulty=4, previously_failed=False)
        bad = make_candidate(id="bad", phase_tag="discovery", difficulty=7, previously_failed=False)
        result = pick_best_problem([good, bad], child)
        assert result["id"] == "good"

    def test_returns_none_when_candidates_empty(self):
        # Empty list must return None, not raise
        child = make_recommender_child()
        assert pick_best_problem([], child) is None

    def test_prefers_retry_over_unseen(self):
        # A previously-failed problem should beat an unseen one with equal other factors
        child = make_recommender_child(current_phase="practice", current_difficulty=4)
        retry = make_candidate(id="retry", phase_tag="practice", difficulty=4, previously_failed=True)
        unseen = make_candidate(id="unseen", phase_tag="practice", difficulty=4, previously_failed=False)
        result = pick_best_problem([unseen, retry], child)
        assert result["id"] == "retry"

    def test_returns_single_candidate_when_only_one(self):
        # One candidate must always be returned regardless of score
        child = make_recommender_child()
        only = make_candidate(id="only")
        result = pick_best_problem([only], child)
        assert result["id"] == "only"

    def test_result_is_a_dict(self):
        # pick_best_problem must return a dict, not an index or score
        child = make_recommender_child()
        candidates = [make_candidate(), make_candidate(id="p_002")]
        result = pick_best_problem(candidates, child)
        assert isinstance(result, dict)


# ---------------------------------------------------------------------------
# TestCheckPhaseSignal
# ---------------------------------------------------------------------------

class TestCheckPhaseSignal:

    def test_returns_reveal_when_discovery_count_reaches_threshold(self):
        # Exactly at the threshold — should trigger reveal
        child = make_recommender_child(current_phase="discovery")
        result = check_phase_signal(child, DISCOVERY_PROBLEMS_REQUIRED)
        assert result == "reveal"

    def test_returns_reveal_when_count_exceeds_threshold(self):
        # Above the threshold — still triggers reveal
        child = make_recommender_child(current_phase="discovery")
        result = check_phase_signal(child, DISCOVERY_PROBLEMS_REQUIRED + 1)
        assert result == "reveal"

    def test_returns_none_when_count_below_threshold(self):
        # One below the threshold — must not trigger reveal yet
        child = make_recommender_child(current_phase="discovery")
        result = check_phase_signal(child, DISCOVERY_PROBLEMS_REQUIRED - 1)
        assert result is None

    def test_returns_none_when_not_in_discovery_phase(self):
        # In practice phase — phase signal must never fire
        child = make_recommender_child(current_phase="practice")
        result = check_phase_signal(child, DISCOVERY_PROBLEMS_REQUIRED)
        assert result is None

    def test_returns_none_when_count_zero(self):
        # Zero problems seen in discovery — must not trigger
        child = make_recommender_child(current_phase="discovery")
        result = check_phase_signal(child, 0)
        assert result is None


# ---------------------------------------------------------------------------
# TestBuildResponse
# ---------------------------------------------------------------------------

class TestBuildResponse:

    def _make_unseen_candidates(self, n, trick_id="A1", difficulty=4, grade=3):
        # Build n unseen candidates with given attributes
        return [
            make_candidate(id=f"p_{i:03d}", trick_id=trick_id, difficulty=difficulty,
                           grade=grade, previously_failed=False)
            for i in range(n)
        ]

    def test_needs_refill_true_when_remaining_below_threshold(self):
        # Fewer than MIN_BANK_SIZE unseen left after serving → needs_refill=True
        child = make_recommender_child()
        # MIN_BANK_SIZE - 1 unseen candidates → remaining = MIN_BANK_SIZE - 2 after serving
        candidates = self._make_unseen_candidates(MIN_BANK_SIZE - 1)
        best = candidates[0]
        result = build_response(best, candidates, child, None)
        assert result["needs_refill"] is True

    def test_needs_refill_false_when_remaining_at_or_above_threshold(self):
        # MIN_BANK_SIZE + 1 unseen → remaining = MIN_BANK_SIZE after serving → no refill
        child = make_recommender_child()
        candidates = self._make_unseen_candidates(MIN_BANK_SIZE + 1)
        best = candidates[0]
        result = build_response(best, candidates, child, None)
        assert result["needs_refill"] is False

    def test_refill_context_is_none_when_no_refill_needed(self):
        # When needs_refill is False, refill_context must be None
        child = make_recommender_child()
        candidates = self._make_unseen_candidates(MIN_BANK_SIZE + 1)
        best = candidates[0]
        result = build_response(best, candidates, child, None)
        assert result["refill_context"] is None

    def test_refill_context_contains_correct_fields_when_refill_needed(self):
        # refill_context must carry trick_id, difficulty, and grade from best
        child = make_recommender_child()
        candidates = self._make_unseen_candidates(MIN_BANK_SIZE - 1, trick_id="B1", difficulty=5, grade=4)
        best = candidates[0]
        result = build_response(best, candidates, child, None)
        assert result["needs_refill"] is True
        assert result["refill_context"]["trick_id"] == "B1"
        assert result["refill_context"]["difficulty"] == 5
        assert result["refill_context"]["grade"] == 4

    def test_phase_signal_reveal_returns_no_problem(self):
        # When phase_signal is "reveal", problem_id must be None
        child = make_recommender_child()
        candidates = self._make_unseen_candidates(10)
        best = candidates[0]
        result = build_response(best, candidates, child, "reveal")
        assert result["problem_id"] is None
        assert result["phase_signal"] == "reveal"

    def test_phase_signal_sets_needs_refill_false(self):
        # A phase transition response never triggers a refill
        child = make_recommender_child()
        candidates = self._make_unseen_candidates(1)
        best = candidates[0]
        result = build_response(best, candidates, child, "reveal")
        assert result["needs_refill"] is False

    def test_normal_response_has_problem_id(self):
        # Without a phase signal, problem_id must be the best candidate's id
        child = make_recommender_child()
        candidates = self._make_unseen_candidates(MIN_BANK_SIZE + 1)
        best = candidates[0]
        result = build_response(best, candidates, child, None)
        assert result["problem_id"] == best["id"]


# ---------------------------------------------------------------------------
# TestComputeDifficultyAdjustment
# ---------------------------------------------------------------------------

class TestComputeDifficultyAdjustment:

    def test_advances_when_hints_zero_fast_correct(self):
        # No hints, fast answer, correct, single attempt → advance
        answer = make_answer_result(correct=True, hints_used=0, duration_ms=20000, attempts=1)
        result = compute_difficulty_adjustment(answer, 4, 10)
        assert result["new_difficulty"] == 5
        assert result["reason"] == "advance"

    def test_holds_when_hints_at_or_above_threshold(self):
        # 3 hints used → consolidate; difficulty must not increase
        answer = make_answer_result(correct=True, hints_used=3, duration_ms=20000, attempts=1)
        result = compute_difficulty_adjustment(answer, 4, 10)
        assert result["new_difficulty"] == 4
        assert result["reason"] == "consolidate"

    def test_holds_when_failed_attempts_reach_threshold(self):
        # 3 attempts (2 failures) before a correct answer → consolidate
        answer = make_answer_result(correct=True, hints_used=0, duration_ms=20000, attempts=3)
        result = compute_difficulty_adjustment(answer, 4, 10)
        assert result["new_difficulty"] == 4
        assert result["reason"] == "consolidate"

    def test_does_not_exceed_difficulty_ceiling(self):
        # Advance fires but ceiling clamps the result
        answer = make_answer_result(correct=True, hints_used=0, duration_ms=20000, attempts=1)
        result = compute_difficulty_adjustment(answer, 5, 5)
        assert result["new_difficulty"] == 5

    def test_does_not_exceed_difficulty_max(self):
        # Advance fires at DIFFICULTY_MAX — must not go above it
        answer = make_answer_result(correct=True, hints_used=0, duration_ms=20000, attempts=1)
        result = compute_difficulty_adjustment(answer, DIFFICULTY_MAX, DIFFICULTY_MAX)
        assert result["new_difficulty"] == DIFFICULTY_MAX

    def test_result_has_required_keys(self):
        # Output must always have new_difficulty, reason, and calibration_active
        answer = make_answer_result()
        result = compute_difficulty_adjustment(answer, 4, 10)
        assert "new_difficulty" in result
        assert "reason" in result
        assert "calibration_active" in result

    def test_calibration_correct_jumps_by_delta(self):
        # Correct answer during calibration → difficulty advances by CALIBRATION_DELTA
        answer = make_answer_result(correct=True)
        result = compute_difficulty_adjustment(answer, 3, 10, calibration_active=True)
        assert result["new_difficulty"] == 3 + CALIBRATION_DELTA
        assert result["reason"] == "calibration_advance"
        assert result["calibration_active"] is True

    def test_calibration_wrong_drops_and_ends(self):
        # Wrong answer during calibration → drop by CALIBRATION_DROP, calibration ends
        answer = make_answer_result(correct=False, duration_ms=20000)
        result = compute_difficulty_adjustment(answer, 5, 10, calibration_active=True)
        assert result["new_difficulty"] == 5 - CALIBRATION_DROP
        assert result["reason"] == "calibration_complete"
        assert result["calibration_active"] is False

    def test_calibration_ends_when_ceiling_reached(self):
        # Correct answer but ceiling hit → calibration_active becomes False
        answer = make_answer_result(correct=True)
        result = compute_difficulty_adjustment(answer, 9, 10, calibration_active=True)
        # 9 + 2 = 11 → clamped to 10 (the ceiling)
        assert result["new_difficulty"] == 10
        assert result["calibration_active"] is False

    def test_calibration_wrong_at_minimum_stays_at_floor(self):
        # Wrong answer at DIFFICULTY_MIN → stays at DIFFICULTY_MIN, calibration ends
        answer = make_answer_result(correct=False, duration_ms=20000)
        result = compute_difficulty_adjustment(answer, DIFFICULTY_MIN, 10, calibration_active=True)
        assert result["new_difficulty"] == DIFFICULTY_MIN
        assert result["calibration_active"] is False

    def test_calibration_hesitant_on_hints(self):
        # Correct with 1 hint → hesitant → jump by CALIBRATION_SLOW_DELTA not CALIBRATION_DELTA
        answer = make_answer_result(correct=True, hints_used=1, duration_ms=20000)
        result = compute_difficulty_adjustment(answer, 3, 10, calibration_active=True)
        assert result["new_difficulty"] == 3 + CALIBRATION_SLOW_DELTA
        assert result["reason"] == "calibration_advance"
        assert result["calibration_active"] is True

    def test_calibration_hesitant_on_slow_duration(self):
        # Correct but at the slow threshold → hesitant → +CALIBRATION_SLOW_DELTA
        answer = make_answer_result(correct=True, hints_used=0, duration_ms=ADVANCE_DURATION_THRESHOLD_MS)
        result = compute_difficulty_adjustment(answer, 3, 10, calibration_active=True)
        assert result["new_difficulty"] == 3 + CALIBRATION_SLOW_DELTA
        assert result["reason"] == "calibration_advance"

    def test_calibration_hesitant_stays_active(self):
        # Hesitant correct answers keep calibration ON — only a wrong answer ends it
        answer = make_answer_result(correct=True, hints_used=3, duration_ms=80000)
        result = compute_difficulty_adjustment(answer, 5, 10, calibration_active=True)
        assert result["calibration_active"] is True

    def test_calibration_confident_needs_both_conditions(self):
        # Fast but with hints → hesitant (+CALIBRATION_SLOW_DELTA), not confident
        answer = make_answer_result(correct=True, hints_used=1, duration_ms=10000)
        result = compute_difficulty_adjustment(answer, 3, 10, calibration_active=True)
        assert result["new_difficulty"] == 3 + CALIBRATION_SLOW_DELTA

        # No hints but slow → hesitant (+CALIBRATION_SLOW_DELTA), not confident
        answer2 = make_answer_result(correct=True, hints_used=0, duration_ms=ADVANCE_DURATION_THRESHOLD_MS + 1)
        result2 = compute_difficulty_adjustment(answer2, 3, 10, calibration_active=True)
        assert result2["new_difficulty"] == 3 + CALIBRATION_SLOW_DELTA

    def test_normal_mode_returns_calibration_active_false(self):
        # Outside calibration the flag is always False in the response
        answer = make_answer_result(correct=True, hints_used=0, duration_ms=20000, attempts=1)
        result = compute_difficulty_adjustment(answer, 4, 10, calibration_active=False)
        assert result["calibration_active"] is False


# ---------------------------------------------------------------------------
# TestCheckMastery
# ---------------------------------------------------------------------------

class TestCheckMastery:

    def test_returns_true_at_exactly_80_percent(self):
        # 8 correct out of 10 = 80% → mastery
        perf = (
            make_recent_performance(n=8, correct=True)
            + make_recent_performance(n=2, correct=False)
        )
        assert check_mastery(perf, MIN_PROBLEMS_PER_LEVEL) is True

    def test_returns_false_at_70_percent(self):
        # 7 correct out of 10 = 70% → below threshold
        perf = (
            make_recent_performance(n=7, correct=True)
            + make_recent_performance(n=3, correct=False)
        )
        assert check_mastery(perf, MIN_PROBLEMS_PER_LEVEL) is False

    def test_returns_false_when_practice_problems_below_minimum(self):
        # 80% correct but too few problems solved at this level → no mastery
        perf = make_recent_performance(n=10, correct=True)
        assert check_mastery(perf, MIN_PROBLEMS_PER_LEVEL - 1) is False

    def test_returns_false_when_history_shorter_than_min_problems_per_level(self):
        # Fewer than MIN_PROBLEMS_PER_LEVEL entries — too short for any window
        perf = make_recent_performance(n=MIN_PROBLEMS_PER_LEVEL - 1, correct=True)
        assert check_mastery(perf, MIN_PROBLEMS_PER_LEVEL) is False

    def test_returns_true_with_short_but_sufficient_history(self):
        # History shorter than MIN_PRACTICE_PROBLEMS but >= MIN_PROBLEMS_PER_LEVEL
        # and 100% correct — adaptive window should allow mastery
        perf = make_recent_performance(n=MIN_PROBLEMS_PER_LEVEL, correct=True)
        assert check_mastery(perf, MIN_PROBLEMS_PER_LEVEL) is True

    def test_adaptive_window_uses_full_history_when_available(self):
        # With 10 entries the full window is used; 7/10 = 70% → below threshold
        perf = (
            make_recent_performance(n=7, correct=True)
            + make_recent_performance(n=3, correct=False)
        )
        assert check_mastery(perf, MIN_PROBLEMS_PER_LEVEL) is False

    def test_adaptive_window_uses_partial_history_below_cap(self):
        # 7 entries (> MIN_PROBLEMS_PER_LEVEL, < MIN_PRACTICE_PROBLEMS): window=7
        # 6/7 ≈ 86% > 80% → mastery
        perf = (
            make_recent_performance(n=6, correct=True)
            + make_recent_performance(n=1, correct=False)
        )
        assert check_mastery(perf, MIN_PROBLEMS_PER_LEVEL) is True

    def test_returns_true_at_100_percent_with_enough_volume(self):
        # 10/10 correct → definitely mastery
        perf = make_recent_performance(n=10, correct=True)
        assert check_mastery(perf, MIN_PROBLEMS_PER_LEVEL) is True

    def test_returns_false_at_empty_performance(self):
        # No history at all → False
        assert check_mastery([], MIN_PROBLEMS_PER_LEVEL) is False


# ---------------------------------------------------------------------------
# TestComputePhaseUpdate
# ---------------------------------------------------------------------------

class TestComputePhaseUpdate:

    def test_returns_practice_when_discovery_count_hits_threshold(self):
        # Discovery phase with enough problems seen → advance to practice
        phase_counters = {
            "discovery_problems_seen": DISCOVERY_PROBLEMS_REQUIRED,
            "practice_problems_solved": 0,
        }
        result = compute_phase_update(
            "discovery", phase_counters, False, "A1", ["A1", "A2"]
        )
        assert result["phase_update"] == "practice"
        assert result["trick_update"] is None

    def test_returns_both_none_when_discovery_count_below_threshold(self):
        # Not enough discovery problems seen → no transition
        phase_counters = {
            "discovery_problems_seen": DISCOVERY_PROBLEMS_REQUIRED - 1,
            "practice_problems_solved": 0,
        }
        result = compute_phase_update(
            "discovery", phase_counters, False, "A1", ["A1"]
        )
        assert result["phase_update"] is None
        assert result["trick_update"] is None

    def test_returns_discovery_and_trick_when_mastery_reached(self):
        # Practice phase + mastery → advance to next trick's discovery phase
        phase_counters = {
            "discovery_problems_seen": 0,
            "practice_problems_solved": MIN_PROBLEMS_PER_LEVEL,
        }
        # A1 is already unlocked; A2 has no prerequisites → A2 is next
        result = compute_phase_update(
            "practice", phase_counters, True, "A1", ["A1"]
        )
        assert result["phase_update"] == "discovery"
        assert result["trick_update"] == "A2"

    def test_returns_both_none_when_no_transition_condition_met(self):
        # Practice phase, mastery not reached → no transition
        phase_counters = {
            "discovery_problems_seen": 0,
            "practice_problems_solved": MIN_PROBLEMS_PER_LEVEL,
        }
        result = compute_phase_update(
            "practice", phase_counters, False, "A1", ["A1"]
        )
        assert result["phase_update"] is None
        assert result["trick_update"] is None

    def test_new_trick_is_prerequisite_gated(self):
        # A6 requires A4; with A4 unlocked, A6 should be the next trick after A5
        # A1–A5 all unlocked (no prerequisites blocked), next eligible is A6 (requires A4 ✓)
        unlocked = ["A1", "A2", "A3", "A4", "A5"]
        phase_counters = {
            "discovery_problems_seen": 0,
            "practice_problems_solved": MIN_PROBLEMS_PER_LEVEL,
        }
        result = compute_phase_update(
            "practice", phase_counters, True, "A5", unlocked
        )
        # A6 requires A4 which is unlocked → should be selected
        assert result["trick_update"] == "A6"

    def test_prerequisite_blocked_trick_not_selected(self):
        # A6 requires A4; without A4 unlocked, A6 must not be the next trick
        # A1, A2, A3, A5 unlocked but NOT A4 → A6 blocked
        unlocked = ["A1", "A2", "A3", "A5"]
        phase_counters = {
            "discovery_problems_seen": 0,
            "practice_problems_solved": MIN_PROBLEMS_PER_LEVEL,
        }
        result = compute_phase_update(
            "practice", phase_counters, True, "A5", unlocked
        )
        # A4 is not unlocked → A6 blocked; A4 itself has no prerequisites so it's next
        assert result["trick_update"] == "A4"
        assert result["trick_update"] != "A6"

    def test_advances_trick_when_cap_hit_without_mastery(self):
        # Cap hit (7 attempts) even with mastery_reached=False → must advance trick
        phase_counters = {
            "discovery_problems_seen": 0,
            "practice_problems_solved": 0,
            "practice_problems_attempted": MAX_PROBLEMS_PER_TRICK,
        }
        result = compute_phase_update(
            "practice", phase_counters, False, "A1", ["A1"]
        )
        assert result["phase_update"] == "discovery"
        assert result["trick_update"] == "A2"

    def test_no_advance_below_cap_without_mastery(self):
        # One below the cap and mastery not reached → no transition
        phase_counters = {
            "discovery_problems_seen": 0,
            "practice_problems_solved": 0,
            "practice_problems_attempted": MAX_PROBLEMS_PER_TRICK - 1,
        }
        result = compute_phase_update(
            "practice", phase_counters, False, "A1", ["A1"]
        )
        assert result["phase_update"] is None
        assert result["trick_update"] is None

    def test_cap_and_mastery_produce_same_output_shape(self):
        # Both cap hit and mastery produce phase_update="discovery" and a trick_update
        cap_counters = {
            "discovery_problems_seen": 0,
            "practice_problems_solved": 0,
            "practice_problems_attempted": MAX_PROBLEMS_PER_TRICK,
        }
        mastery_counters = {
            "discovery_problems_seen": 0,
            "practice_problems_solved": MIN_PROBLEMS_PER_LEVEL,
            "practice_problems_attempted": MIN_PROBLEMS_PER_LEVEL,
        }
        cap_result = compute_phase_update(
            "practice", cap_counters, False, "A1", ["A1"]
        )
        mastery_result = compute_phase_update(
            "practice", mastery_counters, True, "A1", ["A1"]
        )
        assert cap_result["phase_update"] == mastery_result["phase_update"] == "discovery"
        assert cap_result["trick_update"] == mastery_result["trick_update"] == "A2"


# ---------------------------------------------------------------------------
# TestBuildAdjusterResponse
# ---------------------------------------------------------------------------

class TestBuildAdjusterResponse:

    def _make_difficulty_result(self, new_difficulty=5, reason="advance", calibration_active=False):
        # dict — minimal difficulty result
        return {"new_difficulty": new_difficulty, "reason": reason, "calibration_active": calibration_active}

    def _make_phase_result(self, phase_update=None, trick_update=None):
        # dict — minimal phase result
        return {"phase_update": phase_update, "trick_update": trick_update}

    def test_assembles_all_fields_correctly(self):
        # Standard case: advance, no phase change
        result = build_adjuster_response(
            self._make_difficulty_result(5, "advance"),
            self._make_phase_result(),
            calibration_active=False,
        )
        assert result["new_difficulty_target"] == 5
        assert result["adjustment_reason"] == "advance"
        assert result["phase_update"] is None
        assert result["trick_update"] is None
        assert result["calibration_active"] is False

    def test_trick_update_none_when_no_mastery(self):
        # No trick transition → trick_update must be None
        result = build_adjuster_response(
            self._make_difficulty_result(),
            self._make_phase_result(phase_update=None, trick_update=None),
            calibration_active=False,
        )
        assert result["trick_update"] is None

    def test_phase_update_none_when_mid_practice(self):
        # Child is practising normally with no mastery → phase_update must be None
        result = build_adjuster_response(
            self._make_difficulty_result(4, "maintain"),
            self._make_phase_result(),
            calibration_active=False,
        )
        assert result["phase_update"] is None

    def test_difficulty_resets_to_one_on_trick_transition(self):
        # When a new trick is assigned, difficulty must reset to DIFFICULTY_MIN
        result = build_adjuster_response(
            self._make_difficulty_result(5, "advance"),
            self._make_phase_result(phase_update="discovery", trick_update="A2"),
            calibration_active=False,
        )
        assert result["new_difficulty_target"] == DIFFICULTY_MIN

    def test_calibration_restarts_on_trick_transition(self):
        # Trick transition always resets calibration_active to True regardless of input
        result = build_adjuster_response(
            self._make_difficulty_result(5, "advance"),
            self._make_phase_result(phase_update="discovery", trick_update="A2"),
            calibration_active=False,
        )
        assert result["calibration_active"] is True

    def test_calibration_preserved_when_no_trick_transition(self):
        # When no trick changes, calibration_active from the difficulty result is passed through
        result = build_adjuster_response(
            self._make_difficulty_result(3, "calibration_advance", calibration_active=True),
            self._make_phase_result(),
            calibration_active=True,
        )
        assert result["calibration_active"] is True

    def test_trick_and_phase_update_present_on_mastery(self):
        # Both trick_update and phase_update are forwarded from phase_result
        result = build_adjuster_response(
            self._make_difficulty_result(),
            self._make_phase_result(phase_update="discovery", trick_update="B1"),
            calibration_active=False,
        )
        assert result["trick_update"] == "B1"
        assert result["phase_update"] == "discovery"

    def test_result_always_has_five_keys(self):
        # Output dict must always contain all five required keys
        result = build_adjuster_response(
            self._make_difficulty_result(),
            self._make_phase_result(),
            calibration_active=False,
        )
        for key in ("new_difficulty_target", "adjustment_reason", "phase_update", "trick_update", "calibration_active"):
            assert key in result


# ---------------------------------------------------------------------------
# TestRecommend — coordinator function
# ---------------------------------------------------------------------------

class TestRecommend:

    def _make_candidates(self, n, previously_failed=False):
        # list[dict] — n candidates all matching practice phase at difficulty 4
        return [
            make_candidate(id=f"p_{i:03d}", phase_tag="practice",
                           difficulty=4, previously_failed=previously_failed)
            for i in range(n)
        ]

    def test_returns_problem_id_in_normal_case(self):
        # Practice phase with plenty of candidates → problem_id is set
        child = make_recommender_child(current_phase="practice", discovery_problems_seen=0)
        candidates = self._make_candidates(MIN_BANK_SIZE + 1)
        result = recommend(child, candidates)
        assert result["problem_id"] is not None
        assert result["phase_signal"] is None

    def test_returns_phase_signal_in_discovery(self):
        # Discovery phase at threshold → phase_signal="reveal", no problem_id
        child = make_recommender_child(
            current_phase="discovery",
            discovery_problems_seen=DISCOVERY_PROBLEMS_REQUIRED,
        )
        candidates = self._make_candidates(MIN_BANK_SIZE + 1)
        result = recommend(child, candidates)
        assert result["phase_signal"] == "reveal"
        assert result["problem_id"] is None

    def test_sets_needs_refill_when_bank_low(self):
        # Fewer candidates than MIN_BANK_SIZE → needs_refill=True
        child = make_recommender_child(current_phase="practice")
        candidates = self._make_candidates(MIN_BANK_SIZE - 1)
        result = recommend(child, candidates)
        assert result["needs_refill"] is True

    def test_result_has_all_required_keys(self):
        # Output must always have all four keys regardless of path taken
        child = make_recommender_child()
        candidates = self._make_candidates(MIN_BANK_SIZE + 1)
        result = recommend(child, candidates)
        for key in ("problem_id", "needs_refill", "refill_context", "phase_signal"):
            assert key in result

    def test_handles_empty_candidates(self):
        # No candidates → problem_id is None, needs_refill is True
        child = make_recommender_child(current_phase="practice")
        result = recommend(child, [])
        assert result["problem_id"] is None
        assert result["needs_refill"] is True

    def test_custom_scorer_is_used_instead_of_default(self):
        # A custom scorer that always picks "p_001" regardless of fit
        # proves the scorer parameter is wired through correctly
        child = make_recommender_child(current_phase="practice", current_difficulty=4)
        target = make_candidate(id="p_001", phase_tag="discovery", difficulty=9)
        other = make_candidate(id="p_002", phase_tag="practice", difficulty=4)

        def always_pick_first(candidate, _child):
            # returns 1 for p_001 and 0 for everything else
            return 1 if candidate["id"] == "p_001" else 0

        result = recommend(child, [target, other], scorer=always_pick_first)
        # Default scorer would pick p_002 (better phase and difficulty fit)
        # Custom scorer forces p_001 — confirms injection works
        assert result["problem_id"] == "p_001"

    def test_default_scorer_used_when_none_provided(self):
        # Without a scorer argument, the weighted formula picks the better-fit candidate
        child = make_recommender_child(current_phase="practice", current_difficulty=4)
        good = make_candidate(id="good", phase_tag="practice", difficulty=4)
        bad = make_candidate(id="bad", phase_tag="discovery", difficulty=9)
        result = recommend(child, [bad, good])
        assert result["problem_id"] == "good"


# ---------------------------------------------------------------------------
# TestProcessAnswer — coordinator function
# ---------------------------------------------------------------------------

class TestProcessAnswer:

    def _call(self, answer_result=None, current_difficulty=4, difficulty_ceiling=10,
              current_phase="practice", phase_counters=None, recent_performance=None,
              current_trick="A1", unlocked_tricks=None):
        # Helper — calls process_answer with sensible defaults.
        # calibration_active is derived internally by process_answer; not passed here.
        return process_answer(
            answer_result=answer_result or make_answer_result(),
            current_difficulty=current_difficulty,
            difficulty_ceiling=difficulty_ceiling,
            current_phase=current_phase,
            phase_counters=phase_counters or {
                "discovery_problems_seen": 0,
                "practice_problems_solved": MIN_PROBLEMS_PER_LEVEL,
                "practice_problems_attempted": MIN_PROBLEMS_PER_LEVEL,
            },
            recent_performance=recent_performance or make_recent_performance(n=5),
            current_trick=current_trick,
            unlocked_tricks=unlocked_tricks or ["A1"],
        )

    def test_result_has_all_required_keys(self):
        # Output must always have all five required keys including calibration_active
        result = self._call()
        for key in ("new_difficulty_target", "adjustment_reason", "phase_update", "trick_update", "calibration_active"):
            assert key in result

    def _calibration_counters(self):
        # phase_counters that put the child in calibration: zero wrong answers in practice
        return {"discovery_problems_seen": 0, "practice_problems_solved": 0, "practice_problems_attempted": 0}

    def _post_calibration_counters(self):
        # phase_counters that signal calibration is over: attempted > solved (at least one wrong),
        # and enough solved to satisfy mastery volume check.
        return {"discovery_problems_seen": 0, "practice_problems_solved": MIN_PROBLEMS_PER_LEVEL,
                "practice_problems_attempted": MIN_PROBLEMS_PER_LEVEL + 1}

    def test_calibration_advances_fast_on_correct(self):
        # practice_problems_attempted == 0 → calibration derived as True → jump by CALIBRATION_DELTA
        answer = make_answer_result(correct=True)
        result = self._call(
            answer_result=answer,
            current_difficulty=3,
            phase_counters=self._calibration_counters(),
            recent_performance=make_recent_performance(n=0),
        )
        assert result["new_difficulty_target"] == 3 + CALIBRATION_DELTA
        assert result["adjustment_reason"] == "calibration_advance"
        assert result["calibration_active"] is True

    def test_calibration_ends_on_first_wrong(self):
        # practice_problems_attempted == 0 → calibration True → wrong answer ends it
        answer = make_answer_result(correct=False, duration_ms=20000)
        result = self._call(
            answer_result=answer,
            current_difficulty=5,
            phase_counters=self._calibration_counters(),
            recent_performance=make_recent_performance(n=0),
        )
        assert result["new_difficulty_target"] == 5 - CALIBRATION_DROP
        assert result["adjustment_reason"] == "calibration_complete"
        assert result["calibration_active"] is False

    def test_calibration_fires_on_first_wrong_with_post_increment_counters(self):
        # The backend increments practice_problems_attempted BEFORE calling process_answer.
        # So the first wrong answer arrives with attempted=1, solved=0 (post-increment).
        # The timing correction must recover pre_wrong=0 and fire calibration_complete.
        answer = make_answer_result(correct=False, duration_ms=20000)
        result = self._call(
            answer_result=answer,
            current_difficulty=7,
            current_phase="practice",
            phase_counters={"discovery_problems_seen": 0, "practice_problems_solved": 1,
                            "practice_problems_attempted": 2},  # post-increment: 1 correct then 1 wrong
            recent_performance=make_recent_performance(n=0),
        )
        assert result["new_difficulty_target"] == 7 - CALIBRATION_DROP
        assert result["adjustment_reason"] == "calibration_complete"
        assert result["calibration_active"] is False

    def test_mastery_cannot_fire_during_calibration(self):
        # Even with 10/10 correct and enough practice_problems_solved, mastery must not
        # trigger a trick transition when calibration is active (no wrong answers yet).
        perf = make_recent_performance(n=10, correct=True)
        result = self._call(
            answer_result=make_answer_result(correct=True),
            current_difficulty=3,
            current_phase="practice",
            phase_counters={"discovery_problems_seen": 0, "practice_problems_solved": MIN_PROBLEMS_PER_LEVEL,
                            "practice_problems_attempted": MIN_PROBLEMS_PER_LEVEL},
            recent_performance=perf,
            current_trick="A1",
            unlocked_tricks=["A1"],
        )
        # Mastery suppressed → no trick transition, difficulty jumps by CALIBRATION_DELTA
        assert result["trick_update"] is None
        assert result["new_difficulty_target"] == 3 + CALIBRATION_DELTA

    def test_calibration_restarts_when_trick_advances(self):
        # After a trick advance, new trick counters are all zero → calibration restarts
        perf = make_recent_performance(n=10, correct=True)
        result = self._call(
            answer_result=make_answer_result(correct=True),
            current_difficulty=3,
            current_phase="practice",
            phase_counters=self._post_calibration_counters(),
            recent_performance=perf,
            current_trick="A1",
            unlocked_tricks=["A1"],
        )
        # Trick advanced → difficulty resets and calibration restarts
        assert result["trick_update"] == "A2"
        assert result["new_difficulty_target"] == DIFFICULTY_MIN
        assert result["calibration_active"] is True

    def test_advances_difficulty_on_clean_answer(self):
        # Fast, no hints, correct, single attempt → difficulty advances by +1 (normal mode).
        # practice_problems_attempted=1, practice_problems_solved=0 → one wrong in practice
        # → calibration is off → normal session-adjustment fires → +1 advance.
        answer = make_answer_result(correct=True, hints_used=0, duration_ms=20000, attempts=1)
        result = self._call(
            answer_result=answer,
            phase_counters={"discovery_problems_seen": 0, "practice_problems_solved": 0,
                            "practice_problems_attempted": 1},
        )
        assert result["new_difficulty_target"] == 5
        assert result["adjustment_reason"] == "advance"

    def test_phase_transitions_discovery_to_practice(self):
        # Discovery phase with enough problems seen → phase_update="practice"
        result = self._call(
            current_phase="discovery",
            phase_counters={
                "discovery_problems_seen": DISCOVERY_PROBLEMS_REQUIRED,
                "practice_problems_solved": 0,
            },
        )
        assert result["phase_update"] == "practice"
        assert result["trick_update"] is None

    def test_trick_advances_on_mastery(self):
        # Practice phase with 10 correct answers and enough volume → trick advances.
        # practice_problems_attempted > practice_problems_solved signals calibration is
        # over (at least one wrong answer happened before), so mastery can fire.
        perf = make_recent_performance(n=10, correct=True)
        result = self._call(
            current_phase="practice",
            phase_counters={
                "discovery_problems_seen": 0,
                "practice_problems_solved": MIN_PROBLEMS_PER_LEVEL,
                "practice_problems_attempted": MIN_PROBLEMS_PER_LEVEL + 1,
            },
            recent_performance=perf,
            current_trick="A1",
            unlocked_tricks=["A1"],
        )
        assert result["trick_update"] == "A2"
        assert result["phase_update"] == "discovery"
        assert result["new_difficulty_target"] == DIFFICULTY_MIN

    def test_no_transition_when_correct_rate_below_threshold(self):
        # 3/5 correct = 60% < 80% mastery threshold → no transition
        perf = (
            make_recent_performance(n=3, correct=True)
            + make_recent_performance(n=2, correct=False)
        )
        result = self._call(
            current_phase="practice",
            phase_counters={"discovery_problems_seen": 0, "practice_problems_solved": MIN_PROBLEMS_PER_LEVEL,
                            "practice_problems_attempted": MIN_PROBLEMS_PER_LEVEL + 1},
            recent_performance=perf,
        )
        assert result["phase_update"] is None
        assert result["trick_update"] is None

    def test_forces_trick_advance_at_cap(self):
        # 7 practice attempts with no mastery → trick_update is set, difficulty resets to 1
        result = self._call(
            current_phase="practice",
            phase_counters={
                "discovery_problems_seen": 0,
                "practice_problems_solved": 0,
                "practice_problems_attempted": MAX_PROBLEMS_PER_TRICK,
            },
            recent_performance=make_recent_performance(n=5, correct=False),
            current_trick="A1",
            unlocked_tricks=["A1"],
        )
        assert result["trick_update"] == "A2"
        assert result["phase_update"] == "discovery"
        assert result["new_difficulty_target"] == DIFFICULTY_MIN

    def test_no_force_advance_one_below_cap(self):
        # 6 practice attempts, no mastery → no transition yet
        result = self._call(
            current_phase="practice",
            phase_counters={
                "discovery_problems_seen": 0,
                "practice_problems_solved": 0,
                "practice_problems_attempted": MAX_PROBLEMS_PER_TRICK - 1,
            },
            recent_performance=make_recent_performance(n=5, correct=False),
            current_trick="A1",
            unlocked_tricks=["A1"],
        )
        assert result["trick_update"] is None
        assert result["phase_update"] is None
