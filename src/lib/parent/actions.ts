'use server'

import { createClient } from '@/lib/supabase/server'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/client'
import type { AddChildForm } from '@/types/parent'

export type DBChild = {
  id: string             // user_id (auth ID) — used for deleteChild
  game_id: string        // children.id (game row) — used for game API endpoints
  name: string
  email: string
  grade: number
  dob: string
  zone: number
  coins: number
  difficulty_ceiling: number
}

// ── Backend response shapes ───────────────────────────────────────────────────

interface ApiChildProfile {
  id: string       // children.id (game row)
  user_id: string  // users.id (auth ID)
  email: string
  display_name: string
  grade: number
  date_of_birth: string | null
  current_zone: number
  coins: number
  streak_current: number
  streak_best: number
  total_xp: number
  daily_coins_earned: number
  current_difficulty: number
  difficulty_ceiling: number
  avatar_id: number | null
  parent_id: string
  created_at: string
}

interface ChildrenListResponse {
  children: ApiChildProfile[]
}

interface ChildCreateResponse {
  child: ApiChildProfile
}

// ── Map backend child profile → DBChild ──────────────────────────────────────

function toDBChild(c: ApiChildProfile): DBChild {
  return {
    id: c.user_id,
    game_id: c.id,
    name: c.display_name,
    email: c.email,
    grade: c.grade,
    dob: c.date_of_birth ?? '',
    zone: c.current_zone,
    coins: c.coins,
    difficulty_ceiling: c.difficulty_ceiling,
  }
}

// ── Add Child ─────────────────────────────────────────────────────────────────

export async function addChild(
  form: AddChildForm
): Promise<{ error?: string; child?: DBChild }> {
  try {
    const data = await apiPost<ChildCreateResponse>('/parent/children', {
      email: form.email,
      password: form.password,
      display_name: form.name,
      grade: Number(form.grade),
      date_of_birth: form.dob || undefined,
    })
    return { child: toDBChild(data.child) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create child account.'
    if (msg.toLowerCase().includes('already')) {
      return { error: 'An account with this email already exists.' }
    }
    if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('weak')) {
      return { error: 'Password must be at least 8 characters.' }
    }
    return { error: msg }
  }
}

// ── Reset Child Data ──────────────────────────────────────────────────────────

export async function resetZone(childGameId: string): Promise<{ error?: string }> {
  try {
    await apiPost<{ success: boolean }>(`/parent/children/${childGameId}/reset/zone`, {})
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to reset zone.' }
  }
}

export async function resetCoins(childGameId: string): Promise<{ error?: string }> {
  try {
    await apiPost<{ success: boolean }>(`/parent/children/${childGameId}/reset/coins`, {})
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to reset coins.' }
  }
}

export async function resetTricks(childGameId: string): Promise<{ error?: string }> {
  try {
    await apiPost<{ success: boolean }>(`/parent/children/${childGameId}/reset/tricks`, {})
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to reset tricks.' }
  }
}

// ── Delete Child ──────────────────────────────────────────────────────────────

export async function deleteChild(childGameId: string): Promise<{ error?: string }> {
  try {
    await apiDelete<{ success: boolean }>(`/parent/children/${childGameId}`, { confirm: true })
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete child account.' }
  }
}

// ── Generate Story ────────────────────────────────────────────────────────────

export type StoryChapter = {
  number: number
  title: string
  content: string
}

export type GeneratedStory = {
  id: string
  title: string
  chapters: StoryChapter[]
  generated_at: string
}

export async function generateStory(
  childId: string,
  script: string
): Promise<{ error?: string; story?: GeneratedStory }> {
  try {
    const data = await apiPost<GeneratedStory>('/parent/stories/generate', {
      child_id: childId,
      script,
    })
    return { story: data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Story generation failed.' }
  }
}

// ── Update Difficulty Ceiling ─────────────────────────────────────────────────

export async function updateDifficultyCeiling(
  childGameId: string,
  ceiling: number
): Promise<{ error?: string }> {
  try {
    await apiPatch(`/parent/children/${childGameId}/difficulty`, { difficulty_ceiling: ceiling })
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update difficulty ceiling.' }
  }
}

// ── Fetch Child Tricks ────────────────────────────────────────────────────────

export interface ChildTrick {
  trick_id: string
  name: string
  category: string
  description: string
  insight_count: number
  unlocked_at: string
}

export interface ChildAnalysis {
  child_id: string
  period: string
  attempted: number
  correct: number
  hints_used: number
}

export async function fetchChildAnalysis(
  childId: string,
  period: '7d' | '30d'
): Promise<ChildAnalysis | null> {
  try {
    return await apiGet<ChildAnalysis>(`/parent/children/${childId}/analysis/${period}`)
  } catch {
    return null
  }
}

export interface WeeklyActivityDay {
  day: string
  date: string
  attempted: number
  correct: number
}

export interface WeeklyActivity {
  child_id: string
  week_start: string
  week_end: string
  days: WeeklyActivityDay[]
}

export async function fetchWeeklyActivity(childId: string): Promise<WeeklyActivityDay[]> {
  try {
    const data = await apiGet<WeeklyActivity>(`/parent/children/${childId}/analysis/week`)
    return data.days
  } catch {
    return []
  }
}

export interface ConceptStat {
  concept: string
  attempted: number
  error_rate: number
}

export async function fetchConceptAnalysis(childId: string): Promise<ConceptStat[]> {
  try {
    const data = await apiGet<{ child_id: string; concepts: ConceptStat[] }>(
      `/parent/children/${childId}/analysis/concepts`
    )
    return data.concepts
  } catch {
    return []
  }
}

export async function fetchChildTricks(childId: string): Promise<ChildTrick[]> {
  try {
    const data = await apiGet<{ unlocked_tricks: ChildTrick[] }>(`/parent/children/${childId}/tricks`)
    return data.unlocked_tricks
  } catch {
    return []
  }
}

// ── Daily Analysis ────────────────────────────────────────────────────────────

export interface DailyProblem {
  stem: string
  duration: number
  trick_category: string
}

export interface DailyAnalysis {
  date: string
  problems: DailyProblem[]
  avg_duration: number
  shortest: {
    stem: string
    trick_category: string
    duration: number
  }
}

export async function fetchDailyAnalysis(childId: string): Promise<DailyAnalysis | null> {
  try {
    return await apiGet<DailyAnalysis>(`/parent/children/${childId}/analysis/daily`)
  } catch {
    return null
  }
}

// ── Fetch Parent Dashboard Data ───────────────────────────────────────────────

export async function getParentData(): Promise<{
  parentName: string
  parentEmail: string
  children: DBChild[]
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { parentName: '', parentEmail: '', children: [] }

  const parentName =
    (user.user_metadata?.display_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Parent'
  const parentEmail = user.email ?? ''

  try {
    const data = await apiGet<ChildrenListResponse>('/parent/children')
    return {
      parentName,
      parentEmail,
      children: data.children.map(toDBChild),
    }
  } catch {
    return { parentName, parentEmail, children: [] }
  }
}
