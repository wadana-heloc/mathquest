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


// ── Actions ───────────────────────────────────────────────────────────────────

export async function fetchChildStatsSummary(): Promise<ChildStatsSummary> {
  return apiGet<ChildStatsSummary>('/child/stats/summary')
}

export async function fetchChildStoriesSummary(): Promise<ChildStoriesSummary> {
  // Try list endpoint — may return LatestStory[]
  try {
    const list = await apiGet<LatestStory[]>('/child/stories')
    if (Array.isArray(list)) {
      return {
        total_approved: list.length,
        total_chapters: list.reduce((sum, s) => sum + s.chapters.length, 0),
      }
    }
  } catch { /* fall through */ }

  // Fall back to latest — at least tells us if ≥ 1 story exists
  try {
    const latest = await apiGet<LatestStory | null>('/child/stories/latest')
    return {
      total_approved: latest ? 1 : 0,
      total_chapters: latest ? latest.chapters.length : 0,
    }
  } catch {
    return { total_approved: 0, total_chapters: 0 }
  }
}

// ── Latest story ──────────────────────────────────────────────────────────────

export interface LatestStory {
  id: string
  child_id: string
  chapters: string[]
  word_count: number
  created_at: string
}

export async function fetchLatestStory(): Promise<LatestStory | null> {
  console.log('[fetchLatestStory] GET /child/stories/latest')
  try {
    const data = await apiGet<LatestStory | null>('/child/stories/latest')
    console.log('[fetchLatestStory] response:', data)
    return data
  } catch (err) {
    console.error('[fetchLatestStory] error:', err)
    return null
  }
}
