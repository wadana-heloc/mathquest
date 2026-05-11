'use client'

import { useState, useMemo } from 'react'
import type { TrickData } from '@/types/game'

// ─────────────────────────────────────────────────────────────
//  Trick catalogue — dummy data, replace content later.
//  discoveredTrickIds controls which cards are revealed vs locked.
// ─────────────────────────────────────────────────────────────

type TrickCategory = 'Arithmetic' | 'Pattern' | 'Mental' | 'Structural'

interface Trick {
  id: string
  name: string
  tagline: string // one-line teaser of the trick's effect
  description: string
  category: TrickCategory
}

const TRICKS: Trick[] = [
  // ── A  Arithmetic ──────────────────────────────────────────
  { id: 'A1', name: 'Double & Halve',        category: 'Arithmetic', tagline: 'Simplify any multiplication',    description: 'Double one factor, halve the other. 14×5 becomes 7×10 = 70 — instantly!' },
  { id: 'A2', name: 'Make Tens',             category: 'Arithmetic', tagline: 'Group numbers to reach 10s',     description: 'Rearrange addends to pair up to 10s. 7+3+8+2 = (7+3)+(8+2) = 20!' },
  { id: 'A3', name: 'Round & Adjust',        category: 'Arithmetic', tagline: 'Estimate then correct',          description: 'Round a hard number up, then subtract the difference. 99+47 = 100+47−1 = 146.' },
  { id: 'A4', name: 'Nines Finger Trick',    category: 'Arithmetic', tagline: 'Instant ×9 answers',             description: 'Hold all fingers up. Fold the Nth finger. Digits left = tens, digits right = ones.' },
  { id: 'A5', name: 'Break Apart',           category: 'Arithmetic', tagline: 'Split into friendly chunks',     description: '6×7 = 6×(5+2) = 30+12 = 42. Decompose one factor to make both easier.' },
  { id: 'A6', name: 'Balancing Sums',        category: 'Arithmetic', tagline: 'Shift to equalize addends',      description: 'Transfer part of one addend to another without changing the total. 37+45 → 40+42 = 82.' },
  { id: 'A7', name: 'Count Up to Subtract',  category: 'Arithmetic', tagline: 'Subtract by adding',             description: 'Find the gap by counting up from smaller to larger. 83−57: hop from 57 → 83 = 26.' },
  // ── B  Pattern ─────────────────────────────────────────────
  { id: 'B1', name: 'Skip Count Shortcut',   category: 'Pattern',    tagline: 'Multiply by leaping',            description: 'Count in equal steps of the smaller factor — faster than repeated addition!' },
  { id: 'B2', name: 'Double Double',         category: 'Pattern',    tagline: '×4 in two easy hops',            description: 'Multiply by 4 by doubling twice. 4×13 = 2×(2×13) = 2×26 = 52.' },
  { id: 'B3', name: 'Last Digit Pattern',    category: 'Pattern',    tagline: 'Predict the ones digit',         description: 'The ones digit of any product follows a short repeating cycle. Learn the pattern!' },
  { id: 'B4', name: 'Half of Ten',           category: 'Pattern',    tagline: '×5 = half of ×10',              description: '5×18 = (10×18)÷2 = 90. Divide by 2 instead of multiplying by 5.' },
  { id: 'B5', name: 'Even/Odd Oracle',       category: 'Pattern',    tagline: 'Predict parity in a flash',      description: 'Odd×Odd=Odd. Even×Anything=Even. Know the result\'s parity before you calculate.' },
  { id: 'B6', name: 'Times 11 Magic',        category: 'Pattern',    tagline: 'Two-digit ×11 shortcut',         description: 'For AB×11: write A, A+B in the middle, B at the end. 35×11 = 385!' },
  // ── C  Mental ──────────────────────────────────────────────
  { id: 'C1', name: 'Landmark Jumps',        category: 'Mental',     tagline: 'Hop between round numbers',      description: 'Navigate using 10s and 100s as stepping stones. Calculate in clean, error-free hops.' },
  { id: 'C2', name: 'Front-End First',       category: 'Mental',     tagline: 'Add the big parts first',        description: 'Add hundreds, then tens, then ones. Errors stay small and are easy to spot.' },
  { id: 'C3', name: 'Compensation',          category: 'Mental',     tagline: 'Overcorrect then fix',           description: 'Add a round number then subtract the extra. 68+29 = 68+30−1 = 97.' },
  { id: 'C4', name: 'Division Chunks',       category: 'Mental',     tagline: 'Split division into pieces',     description: 'Break the dividend into friendly multiples. 84÷4 = (80+4)÷4 = 20+1 = 21.' },
  { id: 'C5', name: 'Estimation Bracket',    category: 'Mental',     tagline: 'Trap the answer first',          description: 'Find two estimates that sandwich the real answer, then narrow in. Never wildly wrong!' },
  { id: 'C6', name: 'Flip It',              category: 'Mental',     tagline: 'Swap for the easier order',      description: 'a×b = b×a always. Pick whichever order is friendlier to compute in your head.' },
  { id: 'C7', name: 'Near Square',          category: 'Mental',     tagline: '(n+1)(n−1) = n²−1',            description: '9×11 = 10²−1 = 99. Numbers one apart from a perfect square are instant!' },
  // ── D  Structural ──────────────────────────────────────────
  { id: 'D1', name: 'Associative Grouping',  category: 'Structural', tagline: 'Regroup without changing totals', description: '(a+b)+c = a+(b+c). Reorder sums to create friendly intermediate results.' },
  { id: 'D2', name: 'Distribute & Conquer',  category: 'Structural', tagline: 'Expand to simplify',             description: 'a×(b+c) = a×b + a×c. Break one hard multiplication into two easy ones.' },
  { id: 'D3', name: 'Difference of Squares', category: 'Structural', tagline: 'Square bracket shortcut',        description: '(a+b)(a−b) = a²−b². 51×49 = 50²−1 = 2499. No pen required!' },
  { id: 'D4', name: 'Triangle Numbers',      category: 'Structural', tagline: 'Sum 1 to n instantly',           description: '1+2+…+n = n(n+1)÷2. Sum the first 100 integers: 100×101÷2 = 5050.' },
  { id: 'D5', name: 'Reverse & Add',         category: 'Structural', tagline: 'Hidden palindrome symmetry',     description: 'Reverse a number\'s digits, add them together. Repeat until a palindrome appears!' },
]
// ─────────────────────────────────────────────────────────────
const CAT: Record<TrickCategory, { color: string; bg: string; border: string; badge: string; dot: string }> = {
  Arithmetic: { color: 'text-yellow-300',  bg: 'bg-yellow-950/50',  border: 'border-yellow-500/30',  badge: 'bg-yellow-500/20 text-yellow-200',  dot: 'bg-yellow-400' },
  Pattern:    { color: 'text-teal-300',    bg: 'bg-teal-950/50',    border: 'border-teal-500/30',    badge: 'bg-teal-500/20 text-teal-200',      dot: 'bg-teal-400'   },
  Mental:     { color: 'text-violet-300',  bg: 'bg-violet-950/50',  border: 'border-violet-500/30',  badge: 'bg-violet-500/20 text-violet-200',  dot: 'bg-violet-400' },
  Structural: { color: 'text-orange-300',  bg: 'bg-orange-950/50',  border: 'border-orange-500/30',  badge: 'bg-orange-500/20 text-orange-200',  dot: 'bg-orange-400' },
}

export interface TricksModalProps {
  /** IDs of tricks the player has actually unlocked. Pass [] for empty state. */
  discoveredTrickIds: string[]
  onClose: () => void
}

export function TricksModal({ discoveredTrickIds, onClose }: TricksModalProps) {
  const [tab, setTab] = useState<TrickCategory | 'All'>('All')

  const isEmpty = discoveredTrickIds.length === 0
  const visible = tab === 'All' ? TRICKS : TRICKS.filter(t => t.category === tab)

  return (
    <>
      {/* Keyframes local to this modal */}
      <style>{`
        @keyframes trickFloat  { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-8px)} }
        @keyframes trickFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes trickPop    { 0%{opacity:0;transform:scale(.92)} 100%{opacity:1;transform:scale(1)} }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div
          className="relative w-full max-w-2xl mx-4 max-h-[88vh] flex flex-col rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
          style={{
            background: 'linear-gradient(155deg,#0f0b2a 0%,#18103a 50%,#0d1828 100%)',
            animation: 'trickPop 0.25s ease forwards',
          }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <h2 className="text-white font-black text-lg tracking-tight leading-none">Math Tricks</h2>
                <p className="text-white/35 text-[11px] font-bold mt-0.5">
                  {isEmpty
                    ? 'No tricks unlocked yet'
                    : `${discoveredTrickIds.length} of ${TRICKS.length} discovered`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white/50 hover:text-white flex items-center justify-center text-sm font-black transition-all duration-150 active:scale-90"
              aria-label="Close tricks"
            >✕</button>
          </div>

          {isEmpty ? (
            /* ── Empty state ─────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center flex-1 px-8 py-12 text-center">
              <div className="text-6xl mb-5" style={{ animation: 'trickFloat 3s ease-in-out infinite' }}>🔮</div>
              <h3 className="text-white font-black text-2xl mb-2">No Tricks Yet!</h3>
              <p className="text-white/50 text-sm max-w-xs leading-relaxed mb-1">
                Solve obstacles and boss battles to unlock powerful math tricks you can revisit any time.
              </p>
              <p className="text-yellow-400 font-black text-sm mt-1">Go play and discover tricks →</p>

              {/* Teaser placeholders */}
              <div className="mt-10 flex gap-3">
                {(['Arithmetic','Pattern','Mental','Structural'] as TrickCategory[]).map((cat, i) => (
                  <div
                    key={cat}
                    className="flex flex-col items-center gap-2"
                    style={{ animation: `trickFadeUp 0.4s ease ${i * 0.1}s both` }}
                  >
                    <div className="w-14 h-18 rounded-2xl border-2 border-dashed border-white/15 flex items-center justify-center pb-1" style={{ height: '4.5rem' }}>
                      <span className="text-white/20 font-black text-xl">{cat[0]}</span>
                    </div>
                    <span className="text-white/20 text-[10px] font-bold">{cat}</span>
                  </div>
                ))}
              </div>
              <p className="text-white/20 text-xs mt-4 font-bold">4 categories · 25 tricks to find</p>
            </div>
          ) : (
            /* ── Discovered tricks ────────────────────────────────── */
            <>
              {/* Category tabs */}
              <div className="flex gap-2 px-5 py-3 border-b border-white/10 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
                {(['All','Arithmetic','Pattern','Mental','Structural'] as const).map(cat => {
                  const isActive = tab === cat
                  const count = cat === 'All'
                    ? discoveredTrickIds.length
                    : discoveredTrickIds.filter(id => TRICKS.find(t => t.id === id)?.category === cat).length
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTab(cat)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black transition-all duration-150 ${
                        isActive
                          ? 'bg-yellow-400 text-[#1A1A2E]'
                          : 'bg-white/8 text-white/50 hover:bg-white/15 hover:text-white border border-white/10'
                      }`}
                    >
                      {cat}
                      <span className={`rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black ${isActive ? 'bg-black/20 text-[#1A1A2E]' : 'bg-white/10 text-white/40'}`}>{count}</span>
                    </button>
                  )
                })}
              </div>

              {/* Grid */}
              <div className="overflow-y-auto flex-1 p-4 grid grid-cols-2 gap-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#E8B84B33 transparent' }}>
                {visible.map((trick, i) => {
                  const found = discoveredTrickIds.includes(trick.id)
                  const s = CAT[trick.category]
                  return (
                    <div
                      key={trick.id}
                      className={`relative rounded-2xl border p-4 transition-all duration-200 ${
                        found
                          ? `${s.bg} ${s.border} hover:brightness-110`
                          : 'bg-white/3 border-white/8 opacity-40 grayscale'
                      }`}
                      style={{ animation: `trickFadeUp 0.3s ease ${i * 0.04}s both` }}
                    >
                      {/* ID badge + lock */}
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${found ? s.badge : 'bg-white/10 text-white/20'}`}>
                          {trick.id}
                        </span>
                        {found
                          ? <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          : <span className="text-[11px] text-white/20">🔒</span>}
                      </div>

                      {/* Name */}
                      <h4 className={`font-black text-sm leading-tight mb-1 ${found ? s.color : 'text-white/20'}`}>
                        {trick.name}
                      </h4>

                      {/* Tagline */}
                      <p className={`text-[11px] font-bold mb-2 ${found ? 'text-white/45' : 'text-white/15'}`}>
                        {trick.tagline}
                      </p>

                      {/* Description — only when found */}
                      {found && (
                        <p className="text-white/60 text-[11px] leading-relaxed">
                          {trick.description}
                        </p>
                      )}

                      {/* Category chip */}
                      <div className="mt-3 flex items-center gap-1">
                        <div className={`w-1 h-1 rounded-full ${found ? s.dot : 'bg-white/10'}`} />
                        <span className={`text-[10px] font-bold ${found ? 'text-white/30' : 'text-white/15'}`}>{trick.category}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
//  Trick reveal modal — shown when phase_signal === "reveal"
// ─────────────────────────────────────────────────────────────

const CAT_EMOJI: Record<string, string> = {
  Arithmetic: '⚡',
  Pattern:    '🌀',
  Mental:     '🧠',
  Structural: '🔩',
}

// Zone-based theme — mirrors ProblemCard's ZONE_THEME
const ZONE_REVEAL_THEME: Record<number, {
  cardBg:   string   // CSS gradient for the card background
  border:   string   // Tailwind border class
  glow:     string   // rgba() for the halo behind the card
  btn:      string   // Tailwind classes for the CTA button
  accent:   string   // Tailwind text class for banner text
  divider:  string   // Tailwind class for the horizontal rule
  particles: [string, string, string]  // 3 particle colours
}> = {
  1: {
    cardBg:    'linear-gradient(155deg,#071e38 0%,#0d2a4a 60%,#061525 100%)',
    border:    'border-sky-400/45',
    glow:      'rgba(56,189,248,0.55)',
    btn:       'bg-sky-400 hover:bg-sky-300 text-[#071e38] shadow-sky-400/30',
    accent:    'text-sky-300',
    divider:   'bg-sky-400/20',
    particles: ['#38bdf8', '#7dd3fc', '#E8B84B'],
  },
  2: {
    cardBg:    'linear-gradient(155deg,#100d2e 0%,#1c1145 60%,#0e1530 100%)',
    border:    'border-violet-500/45',
    glow:      'rgba(139,92,246,0.55)',
    btn:       'bg-violet-500 hover:bg-violet-400 text-white shadow-violet-500/30',
    accent:    'text-violet-300',
    divider:   'bg-violet-400/20',
    particles: ['#a855f7', '#8b5cf6', '#c084fc'],
  },
  3: {
    cardBg:    'linear-gradient(155deg,#1a0d08 0%,#2a1510 60%,#150b08 100%)',
    border:    'border-orange-500/45',
    glow:      'rgba(249,115,22,0.55)',
    btn:       'bg-orange-500 hover:bg-orange-400 text-white shadow-orange-500/30',
    accent:    'text-orange-300',
    divider:   'bg-orange-400/20',
    particles: ['#f97316', '#fb923c', '#E8B84B'],
  },
  4: {
    cardBg:    'linear-gradient(155deg,#161200 0%,#252018 60%,#121000 100%)',
    border:    'border-yellow-500/45',
    glow:      'rgba(234,179,8,0.55)',
    btn:       'bg-yellow-400 hover:bg-yellow-300 text-[#161200] shadow-yellow-400/30',
    accent:    'text-yellow-300',
    divider:   'bg-yellow-400/20',
    particles: ['#E8B84B', '#fbbf24', '#f59e0b'],
  },
  5: {
    cardBg:    'linear-gradient(155deg,#100d2e 0%,#1c1145 60%,#0e1530 100%)',
    border:    'border-violet-500/45',
    glow:      'rgba(139,92,246,0.55)',
    btn:       'bg-violet-500 hover:bg-violet-400 text-white shadow-violet-500/30',
    accent:    'text-violet-300',
    divider:   'bg-violet-400/20',
    particles: ['#a855f7', '#8b5cf6', '#c084fc'],
  },
}

export function TrickRevealModal({
  trick,
  zone,
  onDismiss,
}: {
  trick: TrickData | null
  zone:  number
  onDismiss: () => void
}) {
  const zt = ZONE_REVEAL_THEME[zone] ?? ZONE_REVEAL_THEME[1]

  const particles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * 2 * Math.PI
      const dist  = 55 + (i % 4) * 18
      return {
        x:     Math.cos(angle) * dist,
        y:     Math.sin(angle) * dist,
        color: zt.particles[i % 3],
        delay: `${i * 0.06}s`,
      }
    }), [zt])

  const cat   = trick?.category ?? 'Mental'
  const s     = CAT[cat as TrickCategory] ?? CAT.Mental
  const emoji = CAT_EMOJI[cat] ?? '✨'

  return (
    <>
      <style>{`
        @keyframes trRevealPop {
          0%  { opacity:0; transform:scale(.78) translateY(28px); }
          62% { transform:scale(1.05) translateY(-5px); }
          100%{ opacity:1; transform:scale(1)   translateY(0); }
        }
        @keyframes trFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes trShine {
          0%  { background-position:-200% center; }
          100%{ background-position: 200% center; }
        }
        @keyframes trParticle {
          0%  { opacity:1; transform:translate(0,0)                       scale(1); }
          100%{ opacity:0; transform:translate(var(--tx),var(--ty)) scale(0); }
        }
        @keyframes trPulseRing {
          0%,100%{ box-shadow: 0 0 0 0 var(--ring); }
          50%    { box-shadow: 0 0 0 10px transparent; }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md overflow-hidden">

        {/* Particle burst */}
        {particles.map((p, i) => (
          <div
            key={i}
            className="pointer-events-none absolute w-2.5 h-2.5 rounded-full"
            style={{
              top: '50%', left: '50%',
              marginTop: -5, marginLeft: -5,
              background: p.color,
              '--tx': `${p.x}px`,
              '--ty': `${p.y}px`,
              animation: `trParticle 0.9s ease-out ${p.delay} both`,
            } as React.CSSProperties}
          />
        ))}

        <div
          className="relative w-full max-w-sm mx-4"
          style={{ animation: 'trRevealPop 0.42s cubic-bezier(0.34,1.56,0.64,1) both' }}
        >
          {/* Zone-colored glow halo */}
          <div
            className="pointer-events-none absolute -inset-10 rounded-3xl blur-3xl"
            style={{ background: `radial-gradient(ellipse at center, ${zt.glow} 0%, transparent 68%)` }}
          />

          {/* Card */}
          <div
            className={`relative rounded-3xl border-2 overflow-hidden shadow-2xl ${zt.border}`}
            style={{ background: zt.cardBg }}
          >
            {/* Shimmer banner */}
            <div className="relative py-3 text-center overflow-hidden border-b border-white/8">
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,.18) 50%,transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'trShine 2.5s ease-in-out infinite',
                }}
              />
              <span className="relative text-[11px] font-black uppercase tracking-[0.3em] text-white">
                ✨ New Trick Unlocked ✨
              </span>
            </div>

            {/* Body */}
            <div className="flex flex-col items-center px-6 pt-7 pb-6">
              {trick ? (
                <>
                  {/* Floating emoji icon — zone border, category background */}
                  <div
                    className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-3 border-2 ${s.bg} ${zt.border}`}
                    style={{ animation: 'trFloat 3s ease-in-out infinite' }}
                  >
                    {emoji}
                  </div>

                  {/* Category badge */}
                  <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest mb-4 text-white ${s.bg}`}>
                    {trick.category}
                  </span>

                  {/* Trick name */}
                  <h2 className="text-[1.6rem] font-black text-center leading-tight mb-1 text-white">
                    {trick.name}
                  </h2>

                  {/* Tagline */}
                  <p className={`text-sm italic text-center mb-5 ${zt.accent}`}>
                    &ldquo;{trick.tagline}&rdquo;
                  </p>

                  <div className={`w-full h-px mb-5 ${zt.divider}`} />

                  {/* Description */}
                  <p className="text-white text-sm leading-relaxed text-center mb-6">
                    {trick.description}
                  </p>
                </>
              ) : (
                /* Loading skeleton */
                <div className="flex flex-col items-center w-full py-3 gap-3 mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-white/8 animate-pulse" />
                  <div className="h-4 w-24 rounded-full bg-white/8 animate-pulse" />
                  <div className="h-7 w-40 rounded-lg  bg-white/8 animate-pulse" />
                  <div className="h-4 w-48 rounded-full bg-white/8 animate-pulse" />
                  <div className="h-px  w-full         bg-white/10" />
                  <div className="h-4 w-full rounded-full bg-white/8 animate-pulse" />
                  <div className="h-4 w-3/4 rounded-full bg-white/8 animate-pulse" />
                </div>
              )}

              {/* CTA button */}
              <button
                type="button"
                onClick={onDismiss}
                className={`w-full py-3.5 rounded-2xl font-black text-base transition-all duration-150 active:scale-95 shadow-lg ${zt.btn}`}
              >
                {trick ? 'Add to Collection →' : 'Got it!'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
//  Self-contained button + modal — drop anywhere on a page.
// ─────────────────────────────────────────────────────────────

interface TricksButtonProps {
  discoveredTrickIds?: string[]
}

export function TricksButton({ discoveredTrickIds = [] }: TricksButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-1.5 bg-violet-100 hover:bg-violet-200 text-violet-600 font-display font-bold text-sm px-3 py-2 rounded-full border-2 border-violet-200 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm select-none"
        aria-label="View math tricks"
      >
        <span className="text-base leading-none">✨</span>
        <span className="hidden sm:inline text-xs">Tricks</span>
        {discoveredTrickIds.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-black flex items-center justify-center shadow">
            {discoveredTrickIds.length}
          </span>
        )}
      </button>

      {open && (
        <TricksModal
          discoveredTrickIds={discoveredTrickIds}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
