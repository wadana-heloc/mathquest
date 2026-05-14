'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  posClass:      `zone4-p-${i}`,
  delayClass:    `zone4-float-delay-${i % 6}`,
  durationClass: `zone4-float-dur-${i % 6}`,
  sizeClass:     i % 3 === 0 ? 'text-2xl' : 'text-lg',
  emoji: (['⚡', '🔥', '✨', '💥', '🌟'] as const)[i % 5],
}))

const TROPHIES = [
  { emoji: '🏆', bounceClass: 'zone4-bounce-0', size: 'text-5xl' },
  { emoji: '⚙️', bounceClass: 'zone4-bounce-1', size: 'text-6xl' },
  { emoji: '🏆', bounceClass: 'zone4-bounce-2', size: 'text-5xl' },
]

const BARS = ['zone4-bar-0', 'zone4-bar-1', 'zone4-bar-2', 'zone4-bar-3', 'zone4-bar-4']

export default function Zone4ComingSoon() {
  const router = useRouter()
  const [revealed, setRevealed] = useState(false)
  const [notified, setNotified] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 200)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="relative w-full min-h-screen bg-[#050210] flex items-center justify-center overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0520] via-[#050210] to-[#02010a]" />

      {/* Radial glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="zone4-glow" />
      </div>

      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {PARTICLES.map(p => (
          <span
            key={p.id}
            className={`zone4-particle ${p.posClass} ${p.sizeClass} ${p.delayClass} ${p.durationClass}`}
          >
            {p.emoji}
          </span>
        ))}
      </div>

      {/* Main content */}
      <div className={`relative z-10 text-center px-8 max-w-lg mx-auto py-16 zone4-content ${revealed ? 'zone4-revealed' : ''}`}>

        {/* Trophy row — fixed height so bounce doesn't clip */}
        <div className="flex justify-center items-end gap-4 mb-5 h-24">
          {TROPHIES.map((t, i) => (
            <span key={i} className={`${t.size} ${t.bounceClass} inline-block`}>{t.emoji}</span>
          ))}
        </div>

        {/* Zone 3 cleared badge */}
        <div className="inline-flex items-center gap-2 rounded-full px-5 py-2 mb-6 border border-orange-400/40 bg-orange-500/10">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-orange-300 text-sm font-black uppercase tracking-widest">Iron Summit — Conquered!</span>
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        </div>

        {/* Headline */}
        <h1 className="text-5xl font-black text-white mb-2 leading-tight tracking-tight">
          You&apos;re a
        </h1>
        <h1 className="zone4-gradient-text text-5xl font-black mb-4 leading-tight tracking-tight">
          Math Legend!
        </h1>

        <p className="text-white/60 text-lg mb-2 leading-relaxed">
          Three zones. Three victories.<br />The Iron Summit bows to you.
        </p>

        {/* Zone 4 teaser */}
        <div className="my-7 rounded-2xl border border-violet-500/30 px-6 py-5 zone4-teaser-box">
          <p className="text-violet-300 text-xs font-black uppercase tracking-widest mb-3">⚡ Coming Next</p>
          <p className="text-white text-xl font-black mb-2">Zone 4 — ??? Unknown Realm</p>
          <p className="text-white/40 text-sm leading-relaxed">
            A new world is forging itself in the shadows.<br />
            Be ready — it arrives soon.
          </p>
          <div className="flex justify-center gap-2 mt-5">
            {BARS.map((cls, i) => (
              <div key={i} className={`h-1.5 rounded-full bg-violet-500/60 ${cls}`} />
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3 items-center">
          <button
            type="button"
            onClick={() => setNotified(true)}
            disabled={notified}
            className={`w-full max-w-xs font-black text-lg px-10 py-4 rounded-2xl transition-all duration-150 active:scale-95 ${notified ? 'zone4-notify-done' : 'zone4-notify-btn'}`}
          >
            {notified ? "✅ You'll be the first to know!" : '🔔 Notify me when Zone 4 drops'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/game')}
            className="w-full max-w-xs zone4-secondary-btn text-white/70 hover:text-white font-black text-lg px-10 py-4 rounded-2xl border border-white/20 hover:border-white/40 active:scale-95 transition-all duration-150"
          >
            ← Back to Hub
          </button>
        </div>

        <p className="text-white/20 text-xs mt-6 font-bold">
          Keep practicing — stay sharp for Zone 4!
        </p>
      </div>
    </div>
  )
}
