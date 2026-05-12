'use server'

import { apiGet } from '@/lib/api/client'

// ── Child-facing server actions ────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChildStatsSummary {
  lifetime: {
    total_attempted:  number   // all problems ever tried
    total_correct:    number   // all correct answers ever  →  shown as XP / "Mastered"
    correct_rate:     number   // percentage 0–100
    fastest_solve_ms: number   // personal best solve time in ms (0 = no data yet)
    fastest_problem:  string   // stem of that problem
    tricks_unlocked:  number   // total tricks discovered
    total_insights:   number   // total insight moments   →  shown as Stars ⭐
  }
  today: {
    attempted:        number   // problems tried today
    correct:          number   // correct answers today
    daily_goal:       number   // parent-set daily target (default 5)
    hints_used:       number   // hints used today
    fastest_today_ms: number   // fastest correct solve today (0 = none yet)
  }
  this_week: {
    attempted:        number
    correct:          number
    correct_rate:     number
    days_active:      number   // days the child played in the last 7 days
  }
}

export interface ChildStoriesSummary {
  total_approved: number   // approved stories the child can read  →  shown as Stories 📖
  total_chapters: number   // total chapters across all approved stories
}

const MOCK_STORIES: ChildStoriesSummary = {
  total_approved: 0,
  total_chapters: 0,
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function fetchChildStatsSummary(): Promise<ChildStatsSummary> {
  return apiGet<ChildStatsSummary>('/child/stats/summary')
}

export async function fetchChildStoriesSummary(): Promise<ChildStoriesSummary> {
  // TODO: replace with real endpoint when backend is ready
  // return apiGet<ChildStoriesSummary>('/child/stories')
  return MOCK_STORIES
}
