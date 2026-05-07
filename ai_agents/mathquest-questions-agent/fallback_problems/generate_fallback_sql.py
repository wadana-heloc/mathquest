#!/usr/bin/env python3
"""
Reads fallback_bank.json and prints SQL INSERT statements for public.problems.

Usage:
    python generate_fallback_sql.py > fallback_inserts.sql
    # Then paste fallback_inserts.sql into the Supabase SQL Editor.

Prerequisites:
    Apply supabase/migrations/0018_add_missing_tricks.sql first.
    That migration adds the 8 tricks that are in the fallback bank
    but were absent from migration 0009.
"""

import json
import sys
from datetime import date
from pathlib import Path

FALLBACK_PATH = Path(__file__).parent / "fallback_bank.json"


def escape_str(s: str) -> str:
    # Doubles any single quote so the value is safe inside a SQL string literal.
    # E.g. "wizard's tome" -> "wizard''s tome"
    return str(s).replace("'", "''")


def grade_from_difficulty(d: int) -> int:
    # Maps difficulty (1-10) to school grade (3-7).
    # Game covers ages 7-12, approximately grades 3-7.
    if d <= 2:
        return 3   # age 7-8
    if d <= 4:
        return 4   # age 8-10
    if d <= 6:
        return 5   # age 10-11
    if d <= 8:
        return 6   # age 11-12
    return 7       # difficulty 9-10, age 12+


def hints_to_sql(hints: list) -> str:
    # Serialise the hint list as a jsonb SQL literal.
    return "'" + escape_str(json.dumps(hints)) + "'::jsonb"


def tags_to_sql(tags: list) -> str:
    # Convert a Python list of strings to a Postgres ARRAY literal.
    items = ", ".join(f"'{escape_str(t)}'" for t in tags)
    return f"ARRAY[{items}]"


def build_insert(trick_id: str, problem: dict, phase_tag: str) -> str:
    grade = grade_from_difficulty(problem["difficulty"])
    return f"""INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    grade, phase_tag
) VALUES (
    {problem["zone"]},
    '{escape_str(problem["category"])}',
    {problem["difficulty"]},
    '{trick_id}',
    ARRAY['{trick_id}'],
    '{escape_str(problem["stem"])}',
    '{escape_str(str(problem["answer"]))}',
    '{problem["answer_type"]}',
    '{escape_str(problem["brute_force_path"])}',
    '{escape_str(problem["shortcut_path"])}',
    {problem["shortcut_time_threshold_ms"]},
    {hints_to_sql(problem["hints"])},
    '{escape_str(problem["aha_moment"])}',
    '{escape_str(problem["flavor_text"])}',
    {tags_to_sql(problem["tags"])},
    {grade},
    '{phase_tag}'
);"""


def main() -> None:
    # Force UTF-8 output so × ² − and other Unicode in problem text survive
    # the redirect on Windows (default stdout is CP-1252 there).
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    data = json.loads(FALLBACK_PATH.read_text(encoding="utf-8"))

    inserts: list[str] = []
    skipped: list[str] = []

    for trick_id, difficulties in data.items():
        # BOSS entries have non-integer difficulty keys ("B1-P1", etc.) and
        # a different structure — they can't be inserted as regular problems.
        if trick_id == "BOSS":
            skipped.append("BOSS — non-integer difficulty keys, skip")
            continue

        # Collect only integer-keyed difficulties (guard against any future
        # non-integer keys that might be added to the bank).
        valid_diffs: list[int] = []
        for d in difficulties.keys():
            try:
                valid_diffs.append(int(d))
            except ValueError:
                skipped.append(f"{trick_id}/{d} — non-integer difficulty key, skip")

        if not valid_diffs:
            continue

        # Lowest difficulty in the bank for this trick = discovery phase.
        # All higher difficulties = practice phase.
        discovery_diff = min(valid_diffs)

        for diff_key, problem in difficulties.items():
            try:
                diff = int(diff_key)
            except ValueError:
                continue  # already logged above

            phase_tag = "discovery" if diff == discovery_diff else "practice"
            inserts.append(build_insert(trick_id, problem, phase_tag))

    today = date.today().isoformat()
    skip_note = "; ".join(skipped) if skipped else "none"

    print(f"-- Fallback bank import — generated {today}")
    print(f"-- {len(inserts)} problems across 25 tricks")
    print(f"-- Skipped: {skip_note}")
    print()
    for stmt in inserts:
        print(stmt)
        print()


if __name__ == "__main__":
    main()
