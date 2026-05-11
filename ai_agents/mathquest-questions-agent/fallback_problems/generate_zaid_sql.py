#!/usr/bin/env python3
"""
Reads zaid_questions_corrected.json and prints SQL INSERT statements for public.problems.

Usage:
    python generate_zaid_sql.py > zaid_inserts.sql
    # Then paste zaid_inserts.sql into the Supabase SQL Editor.

Category is mapped from trick_id prefix (A→pattern, B→invariant, C→mental, D→structural)
because the JSON's raw category strings don't match the table's CHECK constraint.
Zone is parsed from the problem's tags (e.g. "zone-1" → zone=1).
"""

import json
import re
import sys
from datetime import date
from pathlib import Path

ZAID_PATH = Path(__file__).parent / "zaid_questions_corrected.json"

# Maps trick_id prefix to the category values allowed by the DB CHECK constraint.
TRICK_PREFIX_TO_CATEGORY = {
    "A": "pattern",
    "B": "invariant",
    "C": "mental",
    "D": "structural",
}


def escape_str(s: str) -> str:
    # Doubles any single quote so the value is safe inside a SQL string literal.
    return str(s).replace("'", "''")


def category_from_trick_id(trick_id: str) -> str:
    # Derives DB category from the trick_id prefix (A1 → "pattern", C3 → "mental", etc.)
    prefix = trick_id[0].upper()
    return TRICK_PREFIX_TO_CATEGORY.get(prefix, "arithmetic")


def zone_from_tags(tags: list) -> int:
    # Extracts zone number from a tag like "zone-1". Defaults to 1 if not found.
    for tag in tags:
        match = re.match(r"^zone-(\d+)$", tag)
        if match:
            return int(match.group(1))
    return 1


def hints_to_sql(hints: list) -> str:
    # Serialises the hint list as a jsonb SQL literal.
    return "'" + escape_str(json.dumps(hints)) + "'::jsonb"


def tags_to_sql(tags: list) -> str:
    # Converts a Python list of strings to a Postgres ARRAY literal.
    items = ", ".join(f"'{escape_str(t)}'" for t in tags)
    return f"ARRAY[{items}]"


def nullable_int(value) -> str:
    # Returns the integer as a SQL literal, or NULL if missing/None.
    if value is None:
        return "NULL"
    return str(int(value))


def build_insert(problem: dict) -> str:
    zone = zone_from_tags(problem["tags"])
    trick_id = problem["trick_id"]
    category = category_from_trick_id(trick_id)
    return f"""INSERT INTO public.problems (
    zone, category, difficulty,
    trick_id, trick_ids,
    stem, answer, answer_type,
    brute_force_path, shortcut_path, shortcut_time_threshold_ms,
    hints, aha_moment, flavor_text, tags,
    estimated_brute_force_seconds, estimated_trick_seconds
) VALUES (
    {zone},
    '{category}',
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
    {nullable_int(problem.get("estimated_brute_force_seconds"))},
    {nullable_int(problem.get("estimated_trick_seconds"))}
);"""


def main() -> None:
    # Force UTF-8 output so Unicode in problem text survives redirect on Windows.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    data = json.loads(ZAID_PATH.read_text(encoding="utf-8"))
    problems = data["problems"]

    inserts: list[str] = []
    for p in problems:
        inserts.append(build_insert(p))

    today = date.today().isoformat()
    print(f"-- Zaid question bank import — generated {today}")
    print(f"-- {len(inserts)} problems from zaid_questions_corrected.json")
    print()
    for stmt in inserts:
        print(stmt)
        print()


if __name__ == "__main__":
    main()
