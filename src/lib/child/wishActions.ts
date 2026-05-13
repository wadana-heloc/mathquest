'use server'

import { apiGet, apiPost } from '@/lib/api/client'

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface WishItem {
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
}

// ─── GET /child/wishes ────────────────────────────────────────────────────────

export async function fetchChildWishes(): Promise<{
  data?: { coins: number; wishes: WishItem[] }
  error?: string
}> {
  try {
    const data = await apiGet<{ coins: number; wishes: WishItem[] }>('/child/wishes')
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load wishlist.' }
  }
}

// ─── POST /child/wishes ───────────────────────────────────────────────────────

export async function submitWish(title: string): Promise<{
  data?: { id: string; title: string; status: string; ai_suggested_cost: number | null }
  error?: string
}> {
  try {
    const data = await apiPost<{
      id: string
      title: string
      status: string
      ai_suggested_cost: number | null
    }>('/child/wishes', { title })
    return { data }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to add wish.' }
  }
}

// ─── POST /child/wishes/{wish_id}/redeem ──────────────────────────────────────

export async function redeemWish(wishId: string): Promise<{
  data?: { new_balance: number; wish: { id: string; status: string } }
  error?: string
  notEnoughCoins?: boolean
}> {
  try {
    const data = await apiPost<{
      new_balance: number
      wish: { id: string; status: string }
    }>(`/child/wishes/${wishId}/redeem`, {})
    return { data }
  } catch (err) {
    const msg = (err instanceof Error ? err.message : '').toLowerCase()
    if (msg.includes('not enough') || msg.includes('insufficient') || msg.includes('coin')) {
      return { error: 'Not enough coins', notEnoughCoins: true }
    }
    return { error: 'Something went wrong. Try again.' }
  }
}
