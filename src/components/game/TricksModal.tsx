'use client'

import { useState, useEffect, useMemo } from 'react'
import type { TrickData } from '@/types/game'
import { fetchAllTricks, fetchUnlockedTricks } from '@/lib/game/actions'

// ─────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────

interface TrickView {
  id:            string
  name:          string
  category:      string
  description:   string
  unlocked:      boolean
  unlocked_at?:  string
  insight_count?: number
}

// ─────────────────────────────────────────────────────────────
//  Category colour palette
//  Any category string gets a stable colour derived from its name
//  so new categories from the API automatically get a colour.
// ─────────────────────────────────────────────────────────────

const PALETTE = [
  { color: 'text-yellow-300', bg: 'bg-yellow-950/50', border: 'border-yellow-500/30', badge: 'bg-yellow-500/20 text-yellow-200', dot: 'bg-yellow-400' },
  { color: 'text-teal-300',   bg: 'bg-teal-950/50',   border: 'border-teal-500/30',   badge: 'bg-teal-500/20 text-teal-200',   dot: 'bg-teal-400'   },
  { color: 'text-violet-300', bg: 'bg-violet-950/50', border: 'border-violet-500/30', badge: 'bg-violet-500/20 text-violet-200', dot: 'bg-violet-400' },
  { color: 'text-orange-300', bg: 'bg-orange-950/50', border: 'border-orange-500/30', badge: 'bg-orange-500/20 text-orange-200', dot: 'bg-orange-400' },
  { color: 'text-pink-300',   bg: 'bg-pink-950/50',   border: 'border-pink-500/30',   badge: 'bg-pink-500/20 text-pink-200',   dot: 'bg-pink-400'   },
  { color: 'text-cyan-300',   bg: 'bg-cyan-950/50',   border: 'border-cyan-500/30',   badge: 'bg-cyan-500/20 text-cyan-200',   dot: 'bg-cyan-400'   },
]

function catStyle(category: string) {
  const idx = [...category].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length
  return PALETTE[idx]
}

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days  = Math.floor(hours / 24)
  if (days  < 7)  return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5)  return `${weeks}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─────────────────────────────────────────────────────────────
//  TricksModal
// ─────────────────────────────────────────────────────────────

export interface TricksModalProps {
  onClose: () => void
}

export function TricksModal({ onClose }: TricksModalProps) {
  const [tricks,  setTricks]  = useState<TrickView[]>([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('All')

  useEffect(() => {
    Promise.all([fetchAllTricks(), fetchUnlockedTricks()])
      .then(([allRes, unlockedRes]) => {
        const uMap = new Map(unlockedRes.unlocked_tricks.map(u => [u.trick_id, u]))
        setTricks(
          allRes.tricks.map(t => {
            const u = uMap.get(t.id)
            return {
              id:            t.id,
              name:          t.name,
              category:      t.category,
              description:   t.description,
              unlocked:      !!u,
              unlocked_at:   u?.unlocked_at,
              insight_count: u?.insight_count,
            }
          })
        )
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const categories    = useMemo(() => ['All', ...[...new Set(tricks.map(t => t.category))]], [tricks])
  const unlockedCount = tricks.filter(t => t.unlocked).length
  const visible       = tab === 'All' ? tricks : tricks.filter(t => t.category === tab)

  return (
    <>
      <style>{`
        @keyframes trickFloat  { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-8px)} }
        @keyframes trickFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes trickPop    { 0%{opacity:0;transform:scale(.92)} 100%{opacity:1;transform:scale(1)} }
        @keyframes trickSpin   { to{transform:rotate(360deg)} }
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
                  {loading
                    ? 'Loading…'
                    : unlockedCount === 0
                      ? 'No tricks unlocked yet'
                      : `${unlockedCount} of ${tricks.length} discovered`}
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

          {/* ── Loading ── */}
          {loading && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3">
              <div
                className="w-8 h-8 rounded-full border-2 border-white/20 border-t-yellow-400"
                style={{ animation: 'trickSpin 0.8s linear infinite' }}
              />
              <p className="text-white/30 text-xs font-bold">Fetching tricks…</p>
            </div>
          )}

          {/* ── Empty state ── */}
          {!loading && unlockedCount === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 px-8 py-12 text-center">
              <div className="text-6xl mb-5" style={{ animation: 'trickFloat 3s ease-in-out infinite' }}>🔮</div>
              <h3 className="text-white font-black text-2xl mb-2">No Tricks Yet!</h3>
              <p className="text-white/50 text-sm max-w-xs leading-relaxed mb-1">
                Solve obstacles and boss battles to unlock powerful math tricks.
              </p>
              <p className="text-yellow-400 font-black text-sm mt-1">Go play and discover tricks →</p>
              {tricks.length > 0 && (
                <p className="text-white/20 text-xs mt-6 font-bold">{tricks.length} tricks to find</p>
              )}
            </div>
          )}

          {/* ── Trick grid ── */}
          {!loading && unlockedCount > 0 && (
            <>
              {/* Category tabs */}
              <div className="flex gap-2 px-5 py-3 border-b border-white/10 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
                {categories.map(cat => {
                  const isActive = tab === cat
                  const count    = cat === 'All'
                    ? unlockedCount
                    : tricks.filter(t => t.category === cat && t.unlocked).length
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTab(cat)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black capitalize transition-all duration-150 ${
                        isActive
                          ? 'bg-yellow-400 text-[#1A1A2E]'
                          : 'bg-white/8 text-white/50 hover:bg-white/15 hover:text-white border border-white/10'
                      }`}
                    >
                      {cat}
                      <span className={`rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black ${isActive ? 'bg-black/20 text-[#1A1A2E]' : 'bg-white/10 text-white/40'}`}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Grid */}
              <div
                className="overflow-y-auto flex-1 p-4 grid grid-cols-2 gap-3"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#E8B84B33 transparent' }}
              >
                {visible.map((trick, i) => {
                  const s = catStyle(trick.category)
                  return (
                    <div
                      key={trick.id}
                      className={`relative rounded-2xl border p-4 transition-all duration-200 ${
                        trick.unlocked
                          ? `${s.bg} ${s.border} hover:brightness-110`
                          : 'bg-white/3 border-white/8 opacity-40 grayscale'
                      }`}
                      style={{ animation: `trickFadeUp 0.3s ease ${i * 0.04}s both` }}
                    >
                      {/* ID badge + lock */}
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${trick.unlocked ? s.badge : 'bg-white/10 text-white/20'}`}>
                          {trick.id}
                        </span>
                        {trick.unlocked
                          ? <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          : <span className="text-[11px] text-white/20">🔒</span>}
                      </div>

                      {/* Name */}
                      <h4 className={`font-black text-sm leading-tight mb-2 ${trick.unlocked ? s.color : 'text-white/20'}`}>
                        {trick.name}
                      </h4>

                      {/* Description — only when unlocked */}
                      {trick.unlocked && (
                        <p className="text-white/60 text-[11px] leading-relaxed">
                          {trick.description}
                        </p>
                      )}

                      {/* Footer: category + unlock time */}
                      <div className="mt-3 flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <div className={`w-1 h-1 rounded-full flex-shrink-0 ${trick.unlocked ? s.dot : 'bg-white/10'}`} />
                          <span className={`text-[10px] font-bold capitalize truncate ${trick.unlocked ? 'text-white/30' : 'text-white/15'}`}>
                            {trick.category}
                          </span>
                        </div>
                        {trick.unlocked && trick.unlocked_at && (
                          <span className="text-[9px] text-white/25 font-bold flex-shrink-0">
                            {timeAgo(trick.unlocked_at)}
                          </span>
                        )}
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
  multiplication: '✖️',
  addition:       '➕',
  subtraction:    '➖',
  division:       '➗',
  mental:         '🧠',
  pattern:        '🌀',
}

// Zone-based theme — mirrors ProblemCard's ZONE_THEME
const ZONE_REVEAL_THEME: Record<number, {
  cardBg:    string
  border:    string
  glow:      string
  btn:       string
  accent:    string
  divider:   string
  particles: [string, string, string]
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
  trick:     TrickData | null
  zone:      number
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

  const cat   = trick?.category ?? 'multiplication'
  const s     = catStyle(cat)
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
          0%  { opacity:1; transform:translate(0,0) scale(1); }
          100%{ opacity:0; transform:translate(var(--tx),var(--ty)) scale(0); }
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
          {/* Zone-coloured glow halo */}
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
                  {/* Floating emoji icon */}
                  <div
                    className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-3 border-2 ${s.bg} ${zt.border}`}
                    style={{ animation: 'trFloat 3s ease-in-out infinite' }}
                  >
                    {emoji}
                  </div>

                  {/* Category badge */}
                  <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest mb-4 text-white capitalize ${s.bg}`}>
                    {trick.category}
                  </span>

                  {/* Trick name */}
                  <h2 className="text-[1.6rem] font-black text-center leading-tight mb-5 text-white">
                    {trick.name}
                  </h2>

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
//  Fetches its own unlock count for the badge.
// ─────────────────────────────────────────────────────────────

export function TricksButton() {
  const [open,  setOpen]  = useState(false)
  const [count, setCount] = useState(0)

  useEffect(() => {
    fetchUnlockedTricks()
      .then(r => setCount(r.unlocked_tricks.length))
      .catch(() => {})
  }, [])

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
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-black flex items-center justify-center shadow">
            {count}
          </span>
        )}
      </button>

      {open && <TricksModal onClose={() => setOpen(false)} />}
    </>
  )
}
