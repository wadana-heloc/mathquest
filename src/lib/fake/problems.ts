// ─────────────────────────────────────────────────────────────
//  MathQuest · src/lib/fake/problems.ts
//
//  FAKE DATA LAYER — used while backend is not ready.
//
//  🔴 TO REPLACE WITH REAL API:
//     Delete this file entirely.
//     Real problems come from GET /api/problems?zone=X&difficulty=Y
//     See src/lib/game/actions.ts — swap `getFakeProblems` calls
//     with the real `fetchProblems` server action.
//
//  NOTE: `answer` lives only here in the fake layer (simulating
//        the server). It is NEVER passed to the client component.
// ─────────────────────────────────────────────────────────────

import type { Problem } from '@/types/game'

// ── Internal type only — backend knows the answer, client doesn't ──
interface ProblemWithAnswer extends Problem {
  _answer: number  // underscore = server-only, never sent to client
}

export const FAKE_PROBLEMS: ProblemWithAnswer[] = [
  // ── Zone 1 — Pebble Shore ────────────────────────────────────
  // {
  //   id: 'Z1-01',
  //   zone: 1,
  //   category: 'arithmetic',
  //   difficulty: 2,
  //   trick_id: 'C4',
  //   stem: '8 + 7 = ?',
  //   shortcut_time_threshold_ms: 2000,
  //   flavor_text: 'Two tide pools must be counted before the shore sprite will let you pass.',
  //   hints: [
  //     { level: 1, text: 'Is 7 close to another number you already know?', cost: 0 },
  //     { level: 2, text: 'Try thinking of it as 7 + 7, then adjust by 1.', cost: 5 },
  //     { level: 3, text: 'Near-doubles: 7 + 7 = 14, so 8 + 7 = 14 + 1 = 15.', cost: 15 },
  //   ],
  //   tags: ['addition', 'near-doubles', 'zone-1'],
  //   _answer: 15,
  // },
  // {
  //   id: 'Z1-03',
  //   zone: 1,
  //   category: 'mental',
  //   difficulty: 2,
  //   trick_id: 'C2',
  //   stem: '100 − 37 = ?',
  //   shortcut_time_threshold_ms: 3000,
  //   flavor_text: 'The potion vault requires two ingredients totalling exactly 100. One bottle holds 37. How much does the other need?',
  //   hints: [
  //     { level: 1, text: 'What number added to 37 gives a round 10 first?', cost: 0 },
  //     { level: 2, text: '37 + 3 = 40. Now how far is 40 from 100?', cost: 5 },
  //     { level: 3, text: '37 and 63 are complement pairs — they always sum to 100.', cost: 15 },
  //   ],
  //   tags: ['subtraction', 'complement-100', 'zone-1'],
  //   _answer: 63,
  // },
  // {
  //   id: 'Z1-05',
  //   zone: 1,
  //   category: 'invariant',
  //   difficulty: 2,
  //   trick_id: 'B1',
  //   stem: 'Is 13 + 27 + 41 odd or even?\nEnter 0 for even, 1 for odd.',
  //   shortcut_time_threshold_ms: 3000,
  //   flavor_text: 'Only the correct parity opens the forked gate — no calculation needed if you think carefully.',
  //   hints: [
  //     { level: 1, text: 'You do not need to add these up. Think about odd + odd.', cost: 0 },
  //     { level: 2, text: 'Odd + Odd = Even. Even + Odd = ?', cost: 5 },
  //     { level: 3, text: '13 (odd) + 27 (odd) = 40 (even). 40 + 41 (odd) = odd. Answer: 1', cost: 15 },
  //   ],
  //   tags: ['parity', 'invariant', 'zone-1'],
  //   _answer: 1,
  // },
  // // ── Zone 2 — Echo Caves ──────────────────────────────────────
  // {
  //   id: 'Z2-01',
  //   zone: 2,
  //   category: 'pattern',
  //   difficulty: 3,
  //   trick_id: 'A2',
  //   stem: '9 × 8 = ?',
  //   shortcut_time_threshold_ms: 2000,
  //   flavor_text: 'The cave resonator hums at a frequency that is always a multiple of 9. Strike the correct tone.',
  //   hints: [
  //     { level: 1, text: 'Can you use 10 × 8 as a starting point?', cost: 0 },
  //     { level: 2, text: '10 × 8 = 80. 9 is one less than 10, so subtract one group of 8.', cost: 5 },
  //     { level: 3, text: '9 × 8 = 80 − 8 = 72. Check: 7 + 2 = 9 ✓ (digit-sum rule).', cost: 15 },
  //   ],
  //   tags: ['multiplication', '×9', 'zone-2'],
  //   _answer: 72,
  // },
  // {
  //   id: 'Z2-05',
  //   zone: 2,
  //   category: 'pattern',
  //   difficulty: 3,
  //   trick_id: 'A1',
  //   stem: '11 × 23 = ?',
  //   shortcut_time_threshold_ms: 4000,
  //   flavor_text: 'The ancient mirror cipher on the cave wall shows 11 × 23. Solve it or the passage stays sealed.',
  //   hints: [
  //     { level: 1, text: 'What is special about all multiples of 11?', cost: 0 },
  //     { level: 2, text: 'Try adding the two digits of 23 together. Where might that sum appear in the answer?', cost: 5 },
  //     { level: 3, text: 'For 11 × AB: middle digit = A + B. So 11 × 23 → middle = 2+3 = 5 → 253.', cost: 15 },
  //   ],
  //   tags: ['multiplication', '×11', 'two-digit', 'zone-2'],
  //   _answer: 253,
  // },
  // {
  //   id: 'Z2-09',
  //   zone: 2,
  //   category: 'invariant',
  //   difficulty: 3,
  //   trick_id: 'B5',
  //   stem: 'Is 4,527 divisible by 9?\nEnter 1 for yes, 0 for no.',
  //   shortcut_time_threshold_ms: 3000,
  //   flavor_text: 'Only 9-keys open the echo chest. Check this one without dividing.',
  //   hints: [
  //     { level: 1, text: 'There is a rule about the digits of any multiple of 9.', cost: 0 },
  //     { level: 2, text: 'Add all the digits of 4,527 together.', cost: 5 },
  //     { level: 3, text: '4 + 5 + 2 + 7 = 18. 1 + 8 = 9. Divisible by 9 → answer is 1.', cost: 15 },
  //   ],
  //   tags: ['divisibility', 'digit-sum', 'zone-2'],
  //   _answer: 1,
  // },
  // // ── Zone 3 — Iron Summit ─────────────────────────────────────
  // {
  //   id: 'Z3-06',
  //   zone: 3,
  //   category: 'pattern',
  //   difficulty: 5,
  //   trick_id: 'A5',
  //   stem: '1 + 3 + 5 + 7 + 9 + 11 = ?',
  //   shortcut_time_threshold_ms: 2000,
  //   flavor_text: 'The Granite Colossus demands the tribute of six odd stones. Count wisely, not slowly.',
  //   hints: [
  //     { level: 1, text: 'Is there a pattern to sums of consecutive odd numbers?', cost: 0 },
  //     { level: 2, text: 'Count how many odd numbers are in the list. Can you square that count?', cost: 5 },
  //     { level: 3, text: 'Sum of first N odd numbers = N². Here N = 6, so 6² = 36.', cost: 15 },
  //   ],
  //   tags: ['odd-numbers', 'squares', 'zone-3'],
  //   _answer: 36,
  // },
  // {
  //   id: 'Z3-07',
  //   zone: 3,
  //   category: 'structural',
  //   difficulty: 6,
  //   trick_id: 'A6',
  //   stem: '8² − 6² = ?',
  //   shortcut_time_threshold_ms: 2000,
  //   flavor_text: 'Two rival creatures have squared power levels. Their difference collapses into something elegant.',
  //   hints: [
  //     { level: 1, text: 'You could compute 64 − 36, or is there a faster structure here?', cost: 0 },
  //     { level: 2, text: 'Difference of squares: a² − b² = (a + b)(a − b).', cost: 5 },
  //     { level: 3, text: '(8 + 6)(8 − 6) = 14 × 2 = 28.', cost: 15 },
  //   ],
  //   tags: ['difference-of-squares', 'zone-3'],
  //   _answer: 28,
  // },
   {
    id: 'Z1-OBJ-01',
    zone: 1,
    category: 'arithmetic',
    difficulty: 1,
    trick_id: 'C4',
    stem: '6 + 7 = ?',
    shortcut_time_threshold_ms: 2500,
    flavor_text: 'A rusty treasure chest blocks your path! Solve the lock to open it.',
    hints: [
      { level: 1, text: 'Is 7 close to a number you already know well?', cost: 0 },
      { level: 2, text: 'Think of it as 6 + 6, then add 1 more.', cost: 5 },
      { level: 3, text: 'Near-doubles: 6 + 6 = 12, so 6 + 7 = 13.', cost: 15 },
    ],
    tags: ['addition', 'near-doubles', 'zone-1', 'obstacle'],
    _answer: 13,
  },
 
  // OBJ-2: Turtle Blocking the Path
  {
    id: 'Z1-OBJ-02',
    zone: 1,
    category: 'arithmetic',
    difficulty: 1,
    trick_id: 'C4',
    stem: '9 + 8 = ?',
    shortcut_time_threshold_ms: 2500,
    flavor_text: 'A friendly turtle has stopped right in front of you! Help it solve its puzzle so it can move.',
    hints: [
      { level: 1, text: 'Is 8 close to 10? How far away?', cost: 0 },
      { level: 2, text: 'Think: 9 + 8 = 9 + (9-1) = 9+9 minus 1.', cost: 5 },
      { level: 3, text: 'Near-doubles: 9 + 9 = 18, so 9 + 8 = 17.', cost: 15 },
    ],
    tags: ['addition', 'near-doubles', 'zone-1', 'obstacle'],
    _answer: 17,
  },
 
  // OBJ-3: Broken Bridge
  {
    id: 'Z1-OBJ-03',
    zone: 1,
    category: 'mental',
    difficulty: 2,
    trick_id: 'C2',
    stem: '20 − 8 = ?',
    shortcut_time_threshold_ms: 3000,
    flavor_text: 'A rickety bridge needs exactly this many planks to repair! Count carefully.',
    hints: [
      { level: 1, text: 'What does 20 − 10 give you?', cost: 0 },
      { level: 2, text: '20 − 10 = 10. But you only need to remove 8, not 10.', cost: 5 },
      { level: 3, text: '20 − 8 = 20 − 10 + 2 = 12.', cost: 15 },
    ],
    tags: ['subtraction', 'zone-1', 'obstacle'],
    _answer: 12,
  },
 
  // OBJ-4: Rock/Boulder
  {
    id: 'Z1-OBJ-04',
    zone: 1,
    category: 'arithmetic',
    difficulty: 2,
    trick_id: 'C4',
    stem: '7 + 8 = ?',
    shortcut_time_threshold_ms: 2500,
    flavor_text: 'A huge boulder is blocking the beach path. Answer correctly and watch it crumble!',
    hints: [
      { level: 1, text: 'Are 7 and 8 close to each other?', cost: 0 },
      { level: 2, text: 'Near-doubles: 7 + 7 = 14, so 7 + 8 = ?', cost: 5 },
      { level: 3, text: '7 + 7 = 14, and 7 + 8 = 14 + 1 = 15.', cost: 15 },
    ],
    tags: ['addition', 'near-doubles', 'zone-1', 'obstacle'],
    _answer: 15,
  },
 
  // OBJ-5: Crab Family
  {
    id: 'Z1-OBJ-05',
    zone: 1,
    category: 'invariant',
    difficulty: 2,
    trick_id: 'B1',
    stem: '5 + 3 + 9 + 2 = ?\n(Hint: look for pairs!)',
    shortcut_time_threshold_ms: 4000,
    flavor_text: 'A crab family formed a number chain in the sand. Find the total to pass!',
    hints: [
      { level: 1, text: 'Can you spot any numbers that add up to 10?', cost: 0 },
      { level: 2, text: '1 + 9 = 10. Is 1 hidden in here? Try splitting 5.', cost: 5 },
      { level: 3, text: 'Regroup: (9+1) + (5−1+3+2) = 10 + 9 = 19.', cost: 15 },
    ],
    tags: ['addition', 'make-10', 'zone-1', 'obstacle'],
    _answer: 19,
  },
 
  // OBJ-6: Sunken Stepping Stones
  {
    id: 'Z1-OBJ-06',
    zone: 1,
    category: 'mental',
    difficulty: 2,
    trick_id: 'C2',
    stem: '100 − 85 = ?',
    shortcut_time_threshold_ms: 3500,
    flavor_text: 'The stepping stones need to be counted! How many are missing to reach 100?',
    hints: [
      { level: 1, text: 'How far is 85 from 90?', cost: 0 },
      { level: 2, text: '85 + 5 = 90. Then 90 + ? = 100.', cost: 5 },
      { level: 3, text: 'Count up: 85 → 90 (+5) → 100 (+10). Total = 15.', cost: 15 },
    ],
    tags: ['subtraction', 'complement-100', 'zone-1', 'obstacle'],
    _answer: 15,
  },
 
  // OBJ-7: Pelican Guarding Fish
  {
    id: 'Z1-OBJ-07',
    zone: 1,
    category: 'arithmetic',
    difficulty: 2,
    trick_id: 'C4',
    stem: '14 − 6 = ?',
    shortcut_time_threshold_ms: 3000,
    flavor_text: 'A pelican guards the path. Convince it by solving its fish-counting puzzle!',
    hints: [
      { level: 1, text: 'What is 14 − 4? Then take away 2 more.', cost: 0 },
      { level: 2, text: '14 − 4 = 10. Then 10 − 2 = ?', cost: 5 },
      { level: 3, text: '14 − 6 = (14 − 4) − 2 = 10 − 2 = 8.', cost: 15 },
    ],
    tags: ['subtraction', 'zone-1', 'obstacle'],
    _answer: 8,
  },
 
  // OBJ-8: Locked Lighthouse Gate
  {
    id: 'Z1-OBJ-08',
    zone: 1,
    category: 'invariant',
    difficulty: 3,
    trick_id: 'B1',
    stem: 'Is 7 + 12 + 5 odd or even?\nEnter 0 for even, 1 for odd.',
    shortcut_time_threshold_ms: 3000,
    flavor_text: 'The lighthouse gate only opens for the right parity! No full addition needed — think cleverly.',
    hints: [
      { level: 1, text: 'You don\'t need to add them all. Think: what is odd + even?', cost: 0 },
      { level: 2, text: '7 is odd. 12 is even. 5 is odd. Odd + even = odd. Odd + odd = ?', cost: 5 },
      { level: 3, text: '(Odd + Odd) + Even = Even + Even = Even. Answer: 0.', cost: 15 },
    ],
    tags: ['parity', 'invariant', 'zone-1', 'obstacle'],
    _answer: 0,
  },
 
  // ── Zone 1 — BOSS PHASES: The Tidal Sentinel ─────────────────
  // Boss appears after all 8 obstacles are cleared
 
  // BOSS Phase 1 — Recognise the complement trick
  {
    id: 'Z1-BOSS-01',
    zone: 1,
    category: 'mental',
    difficulty: 4,
    trick_id: 'C2',
    stem: '100 − 63 = ?',
    shortcut_time_threshold_ms: 4000,
    flavor_text: '⚡ THE TIDAL SENTINEL RISES! Phase 1 — Strike with the complement trick!',
    hints: [
      { level: 1, text: 'Count up from 63. How far to 70?', cost: 0 },
      { level: 2, text: '63 + 7 = 70. Then 70 + 30 = 100. Total jump?', cost: 5 },
      { level: 3, text: '7 + 30 = 37. So 100 − 63 = 37. Complement pairs!', cost: 15 },
    ],
    tags: ['complement-100', 'boss', 'zone-1', 'boss-phase-1'],
    _answer: 37,
  },
 
  // BOSS Phase 2 — Apply under constraint (multi-step)
  {
    id: 'Z1-BOSS-02',
    zone: 1,
    category: 'mental',
    difficulty: 5,
    trick_id: 'C2',
    stem: '(100 − 47) − 20 = ?',
    shortcut_time_threshold_ms: 5000,
    flavor_text: '⚡ PHASE 2 — The Sentinel fights back! Two steps needed this time!',
    hints: [
      { level: 1, text: 'Solve the bracket first: 100 − 47.', cost: 0 },
      { level: 2, text: '100 − 47 = 53 (complement trick). Now subtract 20.', cost: 5 },
      { level: 3, text: '53 − 20 = 33. Two-step complement!', cost: 15 },
    ],
    tags: ['complement-100', 'multi-step', 'boss', 'zone-1', 'boss-phase-2'],
    _answer: 33,
  },
 
  // BOSS Phase 3 — Novel transfer
  {
    id: 'Z1-BOSS-03',
    zone: 1,
    category: 'mental',
    difficulty: 6,
    trick_id: 'C2',
    stem: 'The Sentinel has 100 shells.\nIt lost 29, then found 14.\nHow many shells remain?',
    shortcut_time_threshold_ms: 6000,
    flavor_text: '⚡ FINAL PHASE — Defeat the Tidal Sentinel and claim Pebble Shore!',
    hints: [
      { level: 1, text: 'Break it into two steps. First: 100 − 29.', cost: 0 },
      { level: 2, text: '100 − 29 = 71 (near-complement). Then 71 + 14.', cost: 5 },
      { level: 3, text: '71 + 14 = 85. The Sentinel is defeated!', cost: 15 },
    ],
    tags: ['complement-100', 'addition', 'word-problem', 'boss', 'zone-1', 'boss-phase-3'],
    _answer: 85,
  },
]

// ── Helpers ───────────────────────────────────────────────────

/** Returns problems for a zone, answer field stripped for client */
export function getFakeProblemsForZone(zone: number): Problem[] {
  return FAKE_PROBLEMS
    .filter(p => p.zone === zone)
    .map(({ _answer, ...clientProblem }) => clientProblem)
}

/** Validates an answer server-side (fake). Returns AttemptResult shape. */
// export function validateFakeAnswer(
//   problemId: string,
//   answer: number,
//   durationMs: number,
//   hintLevelUsed: number,
// ): {
//   correct: boolean
//   coins_delta: number
//   insight_detected: boolean
// } {
//   const problem = FAKE_PROBLEMS.find(p => p.id === problemId)
//   if (!problem) return { correct: false, coins_delta: 0, insight_detected: false }

//   const correct = answer === problem._answer
//   if (!correct) return { correct: false, coins_delta: 0, insight_detected: false }

//   const insight_detected =
//     durationMs < problem.shortcut_time_threshold_ms && hintLevelUsed === 0

//   let coins_delta = 10
//   if (insight_detected)   coins_delta = 30
//   else if (hintLevelUsed === 1) coins_delta = 7
//   else if (hintLevelUsed === 2) coins_delta = 4
//   else if (hintLevelUsed === 3) coins_delta = 1

//   return { correct, coins_delta, insight_detected }
// }
/** * النسخة المحدثة بناءً على قواعد الـ PRD v1.1
 * تضمن: تدرج العملات، نظام الـ Insight، وعقوبات التلميحات
 */
export function validateFakeAnswer(
  problemId: string,
  answer: number,
  durationMs: number,
  hintLevelUsed: number, // 0=None, 1=Free, 2=Costly, 3=Max
): {
  correct: boolean
  coins_delta: number
  insight_detected: boolean
} {
  const problem = FAKE_PROBLEMS.find(p => p.id === problemId)
  if (!problem) return { correct: false, coins_delta: 0, insight_detected: false }

  const isCorrect = answer === problem._answer
  if (!isCorrect) return { correct: false, coins_delta: 0, insight_detected: false }

  // 1. تحديد ما إذا كان هناك Insight (أسرع من الحد المسموح وفي أول محاولة وبدون تلميحات)
  const insight_detected = hintLevelUsed === 0 && durationMs < problem.shortcut_time_threshold_ms

  // 2. حساب العملات بناءً على "هيكل الأرباح" (Earn Structure)
  let coins_delta = 0

  if (hintLevelUsed === 0) {
    // محاولة أولى بدون تلميحات
    coins_delta = insight_detected ? 30 : 10
  } else if (hintLevelUsed === 1) {
    // بعد التلميح الأول (مجاني)
    coins_delta = 7
  } else if (hintLevelUsed === 2) {
    // بعد التلميح الثاني (مكلف)
    coins_delta = 4
  } else if (hintLevelUsed === 3) {
    // بعد التلميح الثالث (أقصى تلميح)
    coins_delta = 1
  }

  // ملاحظة: الـ Streak Bonus والـ Daily Cap يتم حسابهم في المستوى الأعلى (Server Action) 
  // لأنهم يحتاجون للوصول إلى تاريخ المستخدم بالكامل، وليس فقط السؤال الحالي.

  return {
    correct: true,
    coins_delta,
    insight_detected
  }
}