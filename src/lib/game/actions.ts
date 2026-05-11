'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiGet, apiPost, apiPatch } from '@/lib/api/client'
import type { Problem, AttemptResult, HintResult, Zone, ProblemCategory, Hint, TrickData } from '@/types/game'

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
// 1. Fetch a single problem (backend selects the right one for this child)
// ─────────────────────────────────────────────────────────────────────────────

function mapProblem(p: ApiProblem, phase_signal: string | null): { problem: Problem; phase_signal: string | null } {
  return {
    problem: {
      id: p.id,
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
    },
    phase_signal,
  }
}


export async function fetchProblem(): Promise<{ problem: Problem | null; phase_signal: string | null }> {
  const data = await apiGet<ProblemsListResponse>('/problems')
  console.log('[fetchProblem] response:', JSON.stringify(data))

  if (data.problems.length) {
    return mapProblem(data.problems[0], data.phase_signal ?? null)
  }

  if (data.phase_signal) {
    return { problem: null, phase_signal: data.phase_signal }
  }

  // Backend returned empty with no signal — retry once after 800ms.
  // This handles a race where the backend queue is populated async.
  console.warn('[fetchProblem] Empty response, retrying in 800ms…')
  await new Promise(r => setTimeout(r, 800))

  const retry = await apiGet<ProblemsListResponse>('/problems')
  console.log('[fetchProblem] retry response:', JSON.stringify(retry))

  if (retry.problems.length) {
    return mapProblem(retry.problems[0], retry.phase_signal ?? null)
  }

  console.warn('[fetchProblem] Still empty after retry. phase_signal:', retry.phase_signal)
  return { problem: null, phase_signal: retry.phase_signal ?? null }
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
// 5. Fetch the trick currently assigned to this child (current_trick column)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchCurrentTrick(): Promise<TrickData | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const admin = createAdminClient()
    const { data: child } = await admin
      .from('children')
      .select('current_trick')
      .eq('user_id', user.id)
      .single()

    const trickId = (child as { current_trick: string | null } | null)?.current_trick
    if (!trickId) return null

    return await apiGet<TrickData>(`/tricks/${trickId}`)
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Request a hint
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
