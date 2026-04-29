// ─────────────────────────────────────────────────────────────
//  MathQuest · src/types/game.ts
//  All client-facing game interfaces.
//  RULE: The `answer` field NEVER appears in any client type.
//        Server returns correct: true/false only.
// ─────────────────────────────────────────────────────────────

export type Zone = 1 | 2 | 3 | 4 | 5

export type TrickId =
  | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7'
  | 'B1' | 'B2' | 'B3' | 'B4' | 'B5' | 'B6'
  | 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7'
  | 'D1' | 'D2' | 'D3' | 'D4' | 'D5'

export type ProblemCategory =
  | 'arithmetic' | 'pattern' | 'invariant'
  | 'mental' | 'structural' | 'algebraic'

// ── Hint (no answer inside) ───────────────────────────────────
export interface Hint {
  level: 1 | 2 | 3
  text: string
  cost: number   // 0 = free
}

// ── Problem sent to client (answer field intentionally absent) ─
export interface Problem {
  id: string
  zone: Zone
  category: ProblemCategory
  difficulty: number          // 1–10
  trick_id: TrickId | TrickId[] | null
  stem: string
  shortcut_time_threshold_ms: number
  hints: Hint[]
  flavor_text: string
  tags: string[]
  answer_type?: 'exact' | 'range' | 'set'
}

// ── Attempt the client POSTs to server ───────────────────────
export interface AttemptPayload {
  problem_id: string
  answer: number | string   // string for answer_type='set' (e.g. 'odd', 'yes')
  duration_ms: number
  hint_level_used: 0 | 1 | 2 | 3
  session_id: string
}

// ── Server response — correct answer NEVER included ──────────
export interface AttemptResult {
  correct: boolean
  coins_delta: number
  insight_detected: boolean
  new_coin_balance: number
  hint_level_used: 0 | 1 | 2 | 3
  trick_unlock?: {
    trick_id: TrickId
    trick_name: string
    coins_awarded: number   // +75 first-time unlock
     hint_level_used?: number
     
  }
}

// ── Hint server response ─────────────────────────────────────
export interface HintResult {
  hint_text: string
  coin_cost: number
  new_coin_balance: number
}

// ── Local UI state for the card ───────────────────────────────
export type CardState =
  | 'idle'
  | 'loading'
  | 'correct'
  | 'incorrect'
  | 'insight'
  | 'cooldown'

// ── Streak milestone ──────────────────────────────────────────
export interface StreakMilestone {
  count: number
  bonus_coins: number
  label: string
}

export const STREAK_MILESTONES: StreakMilestone[] = [
  { count: 3,  bonus_coins: 20,  label: '3 streak! +20 coins' },
  { count: 5,  bonus_coins: 40,  label: '5 streak! +40 coins' },
  { count: 10, bonus_coins: 100, label: '10 streak! +100 coins 🔥' },
]