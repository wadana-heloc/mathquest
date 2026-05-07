'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiGet, apiPost, apiPatch } from '@/lib/api/client'
import type { Problem, AttemptResult, HintResult, Zone, ProblemCategory, Hint } from '@/types/game'

// ─────────────────────────────────────────────────────────────────────────────
// Backend API response shapes
// ─────────────────────────────────────────────────────────────────────────────

interface ApiHintItem { level: number; text: string; cost: number }

interface ApiProblem {
  id: string
  zone: number
  category: string
  difficulty: number
  stem: string
  answer_type: string
  hints: ApiHintItem[]
  flavor_text: string | null
  tags: string[]
}

interface ProblemsListResponse {
  problems: ApiProblem[]
  phase_signal: string | null
}

interface AttemptResponse {
  correct: boolean
  coins_awarded: number
  insight_detected: boolean
  new_balance: number
  streak_count: number
  trick_unlocked: string | null
  daily_cap_reached: boolean
  new_difficulty: number
  phase_update: string | null
  trick_advance: string | null
}

interface HintApiResponse {
  hint_text: string
  cost_paid: number
  new_balance: number
}

interface StreakResponse {
  streak_current: number
  streak_best: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Phaser ID helpers  (Z2-OBJ-01, Z2-BOSS-01, …)
// ─────────────────────────────────────────────────────────────────────────────

const objId = (zone: number, i: number) => `Z${zone}-OBJ-${String(i + 1).padStart(2, '0')}`
const bossId = (zone: number, i: number) => `Z${zone}-BOSS-${String(i + 1).padStart(2, '0')}`

// ─────────────────────────────────────────────────────────────────────────────
// 1. Fetch problems for a zone
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchProblems(zone: number, difficulty?: number): Promise<Problem[]> {
  const params = new URLSearchParams({ zone: String(zone) })
  // Pass difficulty=10 when none is specified so the backend's
  // lte("difficulty", effective) filter returns all zone problems,
  // not just those at or below the child's current_difficulty.
  params.set('difficulty', String(difficulty ?? 10))

  const data = await apiGet<ProblemsListResponse>(`/problems?${params}`)

  console.log(`[fetchProblems] Fetched ${data.problems.length} problems for zone=${zone}, difficulty_lte=${params.get('difficulty')}`)
  console.log(`3333 data.problems: ${JSON.stringify(data.problems, null, 2)}`)

  if (!data.problems.length) {
    console.error(`[fetchProblems] API returned empty for zone=${zone}. Ensure the problems table has seeded data.`)
    return []
  }

  const OBSTACLE_SLOTS = 8
  const BOSS_SLOTS = 3
  const result: Problem[] = []

  for (let i = 0; i < OBSTACLE_SLOTS; i++) {
    const p = data.problems[i % data.problems.length]
    result.push({
      id: objId(zone, i),
      backend_id: p.id,
      zone: p.zone as Zone,
      category: p.category as ProblemCategory,
      difficulty: p.difficulty,
      trick_id: null,
      stem: p.stem,
      shortcut_time_threshold_ms: 5000,
      hints: p.hints as Hint[],
      flavor_text: p.flavor_text ?? '',
      tags: p.tags,
      answer_type: p.answer_type as 'exact' | 'range' | 'set',
    })
  }

  const hardest = [...data.problems].sort((a, b) => b.difficulty - a.difficulty)
  for (let i = 0; i < BOSS_SLOTS; i++) {
    const p = hardest[i % hardest.length]
    result.push({
      id: bossId(zone, i),
      backend_id: p.id,
      zone: p.zone as Zone,
      category: p.category as ProblemCategory,
      difficulty: p.difficulty,
      trick_id: null,
      stem: p.stem,
      shortcut_time_threshold_ms: 5000,
      hints: p.hints as Hint[],
      flavor_text: p.flavor_text ?? '',
      tags: p.tags,
      answer_type: p.answer_type as 'exact' | 'range' | 'set',
    })
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Submit an answer
// ─────────────────────────────────────────────────────────────────────────────

export async function submitAnswer(payload: {
  problem_id: string
  backend_id?: string
  answer: number | string
  duration_ms: number
  hint_level_used: 0 | 1 | 2 | 3
  session_id: string
  difficulty?: number
}): Promise<AttemptResult> {
  const data = await apiPost<AttemptResponse>('/problems/attempt', {
    problem_id: payload.backend_id ?? payload.problem_id,
    answer: String(payload.answer),
    duration_ms: payload.duration_ms,
    hint_level_used: payload.hint_level_used,
    session_id: payload.session_id,
  })

  return {
    correct: data.correct,
    coins_delta: data.coins_awarded,
    insight_detected: data.insight_detected,
    new_coin_balance: data.new_balance,
    hint_level_used: payload.hint_level_used,
    streak_count: data.streak_count,
    daily_cap_reached: data.daily_cap_reached,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Advance current zone — no backend endpoint, Supabase only
// ─────────────────────────────────────────────────────────────────────────────

export async function advanceZone(completedZone: number): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { data: child } = await admin
    .from('children')
    .select('id, current_zone')
    .eq('user_id', user.id)
    .single()

  if (!child) throw new Error('Child profile not found')

  const current = (child as { id: string; current_zone: number }).current_zone
  if (current <= completedZone) {
    await admin
      .from('children')
      .update({ current_zone: completedZone + 1 })
      .eq('id', (child as { id: string; current_zone: number }).id)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Update streak
// ─────────────────────────────────────────────────────────────────────────────

export async function updateStreak(
  correct: boolean,
): Promise<{ streak_current: number; streak_best: number }> {
  return apiPatch<StreakResponse>('/child/streak', { correct })
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Request a hint
// ─────────────────────────────────────────────────────────────────────────────

export async function requestHint(payload: {
  problem_id: string
  backend_id?: string
  hint_level: 1 | 2 | 3
  session_id: string
}): Promise<HintResult> {
  const data = await apiPost<HintApiResponse>('/problems/hint', {
    problem_id: payload.backend_id ?? payload.problem_id,
    hint_level: payload.hint_level,
    session_id: payload.session_id,
  })

  return {
    hint_text: data.hint_text,
    coin_cost: data.cost_paid,
    new_coin_balance: data.new_balance,
  }
}
