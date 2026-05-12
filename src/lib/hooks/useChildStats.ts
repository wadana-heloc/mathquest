"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/hooks/useUser";
import {
  fetchChildStatsSummary,
  fetchChildStoriesSummary,
  type ChildStatsSummary,
  type ChildStoriesSummary,
} from "@/lib/child/actions";

export type { ChildStatsSummary, ChildStoriesSummary };

const EMPTY_SUMMARY: ChildStatsSummary = {
  lifetime: { total_attempted: 0, total_correct: 0, correct_rate: 0, fastest_solve_ms: 0, fastest_problem: "", tricks_unlocked: 0, total_insights: 0 },
  today:    { attempted: 0, correct: 0, daily_goal: 5, hints_used: 0, fastest_today_ms: 0 },
  this_week:{ attempted: 0, correct: 0, correct_rate: 0, days_active: 0 },
};

const EMPTY_STORIES: ChildStoriesSummary = { total_approved: 0, total_chapters: 0 };

export function useChildStats() {
  const { user, loading: userLoading } = useUser();
  const [summary, setSummary]   = useState<ChildStatsSummary>(EMPTY_SUMMARY);
  const [stories, setStories]   = useState<ChildStoriesSummary>(EMPTY_STORIES);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (userLoading) return;
    if (!user) { setLoading(false); return; }

    Promise.all([
      fetchChildStatsSummary(),
      fetchChildStoriesSummary(),
    ])
      .then(([sum, stor]) => { setSummary(sum); setStories(stor); })
      .catch(() => { /* silently keep empty defaults */ })
      .finally(() => setLoading(false));
  }, [user, userLoading]);

  return { summary, stories, loading };
}
