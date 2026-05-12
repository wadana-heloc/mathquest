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

export type GeneratedStory = {
  chapters: string[]
  word_count: number
}

export type SavedStory = {
  id: string
  child_id: string
  chapters: string[]
  word_count: number
  created_at: string
}

export async function generateStory(
  childId: string,
  prompt: string
): Promise<{ error?: string; story?: GeneratedStory }> {
  const endpoint = `/parent/children/${childId}/stories/generate`
  const body = { parent_prompt: prompt }
  console.log('[generateStory] POST', endpoint, '→ body:', body)
  try {
    const data = await apiPost<GeneratedStory>(endpoint, body)
    console.log('[generateStory] response:', data)
    return { story: data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Story generation failed.'
    console.error('[generateStory] error:', msg, err)
    if (msg.includes('story_agent_unavailable') || msg.includes('503')) {
      return { error: 'Story service is currently unavailable. Please try again later.' }
    }
    return { error: msg }
  }
}

export async function saveStory(
  childId: string,
  story: GeneratedStory
): Promise<{ error?: string; saved?: SavedStory }> {
  const endpoint = `/parent/children/${childId}/stories`
  const body = { chapters: story.chapters, word_count: story.word_count }
  console.log('[saveStory] POST', endpoint, '→ body:', body)
  try {
    const data = await apiPost<SavedStory>(endpoint, body)
    console.log('[saveStory] response:', data)
    return { saved: data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save story.'
    console.error('[saveStory] error:', msg, err)
    return { error: msg }
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

// ── Generate Progress Report ──────────────────────────────────────────────────

export type GenerateReportResult =
  | { text: string; error?: never }
  | { text?: never; error: string; errorCode: string }

export async function generateReport(
  childGameId: string,
  periodDays: number = 30
): Promise<GenerateReportResult> {
  try {
    const data = await apiPost<{ report: string | null; reason: string | null }>(
      `/parent/children/${childGameId}/reports/generate`,
      { period_days: periodDays }
    )
    console.log('[generateReport] Raw API response:', JSON.stringify(data, null, 2))

    if (data.report === null) {
      const code = data.reason ?? 'api_error'
      return { error: code, errorCode: code }
    }

    return { text: data.report }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate report.'
    console.log('[generateReport] Error:', msg)

    if (msg.includes('report_agent_unavailable') || msg.includes('503')) {
      return { error: 'report_agent_unavailable', errorCode: 'report_agent_unavailable' }
    }
    return { error: msg, errorCode: 'unknown' }
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
