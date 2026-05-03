'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import type { Problem, AttemptResult, HintResult, Zone, ProblemCategory, TrickId, Hint } from '@/types/game'

const lastAttemptTime = new Map<string, number>()

const RATE_LIMIT_MS = 3000

// ─── Phaser ID helpers ────────────────────────────────────────────────────────

const objId  = (zone: number, i: number) => `Z${zone}-OBJ-${String(i + 1).padStart(2, '0')}`
const bossId = (zone: number, i: number) => `Z${zone}-BOSS-${String(i + 1).padStart(2, '0')}`

function parseProblemId(id: string): { zone: number; type: 'OBJ' | 'BOSS'; idx: number } | null {
  const m = id.match(/^Z(\d+)-(OBJ|BOSS)-(\d+)$/)
  if (!m) return null
  return { zone: Number(m[1]), type: m[2] as 'OBJ' | 'BOSS', idx: Number(m[3]) - 1 }
}

// ─── DB row → client Problem ──────────────────────────────────────────────────

type DbProblemRow = {
  zone: number
  category: string
  difficulty: number
  trick_ids: string[] | null
  stem: string
  shortcut_time_threshold_ms: number | null
  hints: unknown
  flavor_text: string | null
  tags: string[] | null
  answer_type: 'exact' | 'range' | 'set'
}

function toClientProblem(row: DbProblemRow, id: string): Problem {
  const trickIds = row.trick_ids ?? []
  return {
    id,
    zone: row.zone as Zone,
    category: row.category as ProblemCategory,
    difficulty: row.difficulty,
    trick_id: trickIds.length === 0
      ? null
      : trickIds.length === 1
        ? (trickIds[0] as TrickId)
        : (trickIds as TrickId[]),
    stem: row.stem,
    shortcut_time_threshold_ms: row.shortcut_time_threshold_ms ?? 5000,
    hints: (row.hints as Hint[]) ?? [],
    flavor_text: row.flavor_text ?? '',
    tags: row.tags ?? [],
    answer_type: row.answer_type ?? 'exact',
  }
}

// ─── Helper: get child's current coins from DB (admin read, bypasses RLS) ───

async function getChildCoins(userId: string): Promise<number> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('children')
    .select('coins')
    .eq('user_id', userId)
    .single()
  if (error || !data) return 0
  return (data as { coins: number }).coins
}

// ─── Helper: set child's coins in DB (admin write, bypasses RLS) ─────────────

async function setChildCoins(userId: string, coins: number): Promise<number> {
  const admin = createAdminClient()
  const clamped = Math.max(0, coins)
  const { data, error } = await admin
    .from('children')
    .update({ coins: clamped })
    .eq('user_id', userId)
    .select('coins')
    .single()
  if (error || !data) return clamped
  return (data as { coins: number }).coins
}

// ─── 1. Fetch problems for a zone ─────────────────────────────────────────────

export async function fetchProblems(zone: number): Promise<Problem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('problems')
    .select(
      'zone, category, difficulty, trick_ids, stem, shortcut_time_threshold_ms, hints, flavor_text, tags, answer_type'
    )
    .eq('zone', zone)
    .order('difficulty', { ascending: true })

  if (error || !data || data.length === 0) return []

  const OBSTACLE_SLOTS = 8
  const BOSS_SLOTS     = 3
  const result: Problem[] = []

  for (let i = 0; i < OBSTACLE_SLOTS; i++) {
    result.push(toClientProblem(data[i % data.length] as DbProblemRow, objId(zone, i)))
  }
  const hardest = [...data].sort((a, b) => b.difficulty - a.difficulty)
  for (let i = 0; i < BOSS_SLOTS; i++) {
    result.push(toClientProblem(hardest[i % hardest.length] as DbProblemRow, bossId(zone, i)))
  }

  return result
}

// ─── 2. Submit an answer ──────────────────────────────────────────────────────
// Reads the answer from the DB (server-only column), calculates coins,
// writes the new balance to children via the admin client (bypasses RLS),
// and returns the real new balance so the UI always mirrors the DB.

export async function submitAnswer(payload: {
  problem_id: string
  answer: number | string
  duration_ms: number
  hint_level_used: 0 | 1 | 2 | 3
  session_id: string
}): Promise<AttemptResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const userId = user.id

  // Rate-limit per user
  const now = Date.now()
  const last = lastAttemptTime.get(userId) ?? 0
  if (now - last < RATE_LIMIT_MS) throw new Error('Rate limited — wait before submitting again')
  lastAttemptTime.set(userId, now)

  const parsed = parseProblemId(payload.problem_id)
  if (!parsed) throw new Error(`Unrecognised problem ID: ${payload.problem_id}`)

  // Fetch the answer row (server-only column, regular client with anon key is
  // fine because the problems table allows authenticated SELECT)
  const { data, error } = await supabase
    .from('problems')
    .select('answer, shortcut_time_threshold_ms, difficulty')
    .eq('zone', parsed.zone)
    .order('difficulty', { ascending: true })

  if (error || !data || data.length === 0) throw new Error('Problem not found in DB')

  const dbRow = parsed.type === 'OBJ'
    ? data[parsed.idx % data.length]
    : [...data].sort((a, b) => b.difficulty - a.difficulty)[parsed.idx % data.length]

  const correct =
    String(payload.answer).toLowerCase().trim() === String(dbRow.answer).toLowerCase().trim()

  // Always read authoritative balance from DB
  const currentBalance = await getChildCoins(userId)

  if (!correct) {
    return {
      correct: false,
      coins_delta: 0,
      insight_detected: false,
      new_coin_balance: currentBalance,
      hint_level_used: payload.hint_level_used,
    }
  }

  const threshold = (dbRow.shortcut_time_threshold_ms as number | null) ?? 5000
  const insight_detected = payload.hint_level_used === 0 && payload.duration_ms < threshold

  let coins_delta = 0
  if      (payload.hint_level_used === 0) coins_delta = insight_detected ? 30 : 10
  else if (payload.hint_level_used === 1) coins_delta = 7
  else if (payload.hint_level_used === 2) coins_delta = 4
  else                                    coins_delta = 1

  // Write to DB via admin client — bypasses RLS
  const new_coin_balance = await setChildCoins(userId, currentBalance + coins_delta)

  return {
    correct: true,
    coins_delta,
    insight_detected,
    new_coin_balance,
    hint_level_used: payload.hint_level_used,
  }
}

// ─── 3. Advance current zone ──────────────────────────────────────────────────

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
  // Only advance if the DB zone hasn't already been updated past this zone
  if (current <= completedZone) {
    await admin
      .from('children')
      .update({ current_zone: completedZone + 1 })
      .eq('id', (child as { id: string; current_zone: number }).id)
  }
}

// ─── 4. Update streak ─────────────────────────────────────────────────────────
// Increments streak on correct answer, resets to 0 on wrong answer.
// Returns the new streak values after the DB write.

export async function updateStreak(
  correct: boolean,
): Promise<{ streak_current: number; streak_best: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { data: child } = await admin
    .from('children')
    .select('id, streak_current, streak_best')
    .eq('user_id', user.id)
    .single()

  if (!child) throw new Error('Child profile not found')

  const cur  = (child as { id: string; streak_current: number; streak_best: number }).streak_current
  const best = (child as { id: string; streak_current: number; streak_best: number }).streak_best
  const id   = (child as { id: string; streak_current: number; streak_best: number }).id

  const newCurrent = correct ? cur + 1 : 0
  const newBest    = correct ? Math.max(best, newCurrent) : best

  await admin
    .from('children')
    .update({ streak_current: newCurrent, streak_best: newBest })
    .eq('id', id)

  return { streak_current: newCurrent, streak_best: newBest }
}

// ─── 4. Request a hint ────────────────────────────────────────────────────────
// Free hints (level 1) cost 0 coins. Paid hints deduct immediately from DB.

export async function requestHint(payload: {
  problem_id: string
  hint_level: 1 | 2 | 3
  session_id: string
}): Promise<HintResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const userId = user.id

  const parsed = parseProblemId(payload.problem_id)
  if (!parsed) throw new Error(`Unrecognised problem ID: ${payload.problem_id}`)

  const { data, error } = await supabase
    .from('problems')
    .select('hints, difficulty')
    .eq('zone', parsed.zone)
    .order('difficulty', { ascending: true })

  if (error || !data || data.length === 0) throw new Error('Problem not found in DB')

  const row = parsed.type === 'OBJ'
    ? data[parsed.idx % data.length]
    : [...data].sort((a, b) => b.difficulty - a.difficulty)[parsed.idx % data.length]

  const hints = (row.hints as Array<{ level: number; text: string; cost: number }>) ?? []
  const hint  = hints.find(h => h.level === payload.hint_level)
  if (!hint) throw new Error(`Hint level ${payload.hint_level} not found`)

  const currentBalance = await getChildCoins(userId)

  if (hint.cost > 0) {
    // Deduct and persist via admin client — bypasses RLS
    const new_coin_balance = await setChildCoins(userId, currentBalance - hint.cost)
    return { hint_text: hint.text, coin_cost: hint.cost, new_coin_balance }
  }

  // Free hint — no DB write needed
  return { hint_text: hint.text, coin_cost: 0, new_coin_balance: currentBalance }
}
