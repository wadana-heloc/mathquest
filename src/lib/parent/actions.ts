'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiGet, apiPost } from '@/lib/api/client'
import type { AddChildForm } from '@/types/parent'

export type DBChild = {
  id: string    // user_id (auth ID) — used for deleteChild
  name: string
  email: string
  grade: number
  dob: string
  zone: number
  coins: number
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
    name: c.display_name,
    email: c.email,
    grade: c.grade,
    dob: c.date_of_birth ?? '',
    zone: c.current_zone,
    coins: c.coins,
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

// ── Delete Child ──────────────────────────────────────────────────────────────
// No DELETE endpoint in backend — keep using Supabase admin client directly.

export async function deleteChild(
  childId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: childUser } = await admin
    .from('users')
    .select('id')
    .eq('id', childId)
    .eq('parent_id', user.id)
    .eq('role', 'child')
    .single()

  if (!childUser) return { error: 'Child not found or access denied.' }

  await admin.from('children').delete().eq('user_id', childId)
  await admin.from('users').delete().eq('id', childId)

  const { error: authError } = await admin.auth.admin.deleteUser(childId)
  if (authError) {
    console.error('[deleteChild] auth delete error:', authError.message)
    return { error: authError.message }
  }

  return {}
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
