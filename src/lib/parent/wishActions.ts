'use server'

import { apiGet, apiPatch } from '@/lib/api/client'

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ParentWishItem {
  id: string
  title: string
  status: string
  ai_suggested_cost: number | null
  final_cost: number | null
  ai_category: string | null
  ai_reasoning: string | null
  parent_note: string | null
  coins_needed: number
  created_at: string
  redeemed_at: string | null
  delivered_at: string | null
  child_id: string
  child_name: string
}

// ─── GET /parent/wishes ───────────────────────────────────────────────────────

export async function fetchParentWishes(): Promise<{
  data?: { pending_count: number; wishes: ParentWishItem[] }
  error?: string
}> {
  try {
    const data = await apiGet<{ pending_count: number; wishes: ParentWishItem[] }>('/parent/wishes')
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load rewards.' }
  }
}

// ─── PATCH /parent/wishes/{wish_id}/review ────────────────────────────────────

export async function reviewWish(
  wishId: string,
  payload: { action: 'approve' | 'reject'; final_cost?: number; parent_note?: string }
): Promise<{
  data?: { wish: { id: string; status: string } }
  error?: string
}> {
  try {
    const data = await apiPatch<{ wish: { id: string; status: string } }>(
      `/parent/wishes/${wishId}/review`,
      payload
    )
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update wish.' }
  }
}

// ─── PATCH /parent/wishes/{wish_id}/deliver ───────────────────────────────────

export async function deliverWish(wishId: string): Promise<{
  data?: { wish: { id: string; status: string } }
  error?: string
}> {
  try {
    const data = await apiPatch<{ wish: { id: string; status: string } }>(
      `/parent/wishes/${wishId}/deliver`,
      {}
    )
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to mark as delivered.' }
  }
}
