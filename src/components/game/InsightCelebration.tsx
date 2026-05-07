'use client'

import { useEffect, useRef } from 'react'

interface InsightCelebrationProps {
  coins_delta: number
  onDone: () => void
}

function Particles() {
  const count = 22
  const colors = ['#a78bfa', '#e8b84b', '#ffffff', '#c4b5fd', '#fde68a', '#7c3aed']
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * 2 * Math.PI
        const dist = 100 + (i % 4) * 40
        const tx = Math.cos(angle) * dist
        const ty = Math.sin(angle) * dist
        const delay = (i % 6) * 0.055
        const size = 5 + (i % 4) * 3
        const color = colors[i % colors.length]
        const isSquare = i % 5 === 0
        return (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              width: size,
              height: size,
              borderRadius: isSquare ? '2px' : '50%',
              background: color,
              boxShadow: `0 0 ${size + 4}px ${color}`,
              animation: `insightSpark 1.1s ${delay}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
              '--tx': `${tx}px`,
              '--ty': `${ty}px`,
            } as React.CSSProperties}
          />
        )
      })}
    </div>
  )
}

export function InsightCelebration({ coins_delta, onDone }: InsightCelebrationProps) {
  const doneRef = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true
        onDone()
      }
    }, 2700)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className="absolute inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden"
      style={{ animation: 'insightOverlayIn 0.2s ease forwards' }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#04011a]/92 backdrop-blur-lg" />

      {/* Radial pulse */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.45) 0%, rgba(124,58,237,0.12) 45%, transparent 70%)',
          animation: 'insightGlow 2.7s ease forwards',
        }}
      />

      {/* Ring pulse */}
      <div
        className="absolute pointer-events-none rounded-full border border-violet-500/30"
        style={{
          width: '240px',
          height: '240px',
          animation: 'insightRing 1.2s ease-out forwards',
        }}
      />

      {/* Particles */}
      <Particles />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-5 px-8 text-center">
        {/* Main word */}
        <div
          className="font-black uppercase leading-none select-none"
          style={{
            fontSize: 'clamp(60px, 15vw, 108px)',
            background: 'linear-gradient(135deg, #e0d0ff 0%, #a78bfa 35%, #7c3aed 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 28px rgba(167,139,250,0.9))',
            letterSpacing: '0.06em',
            animation: 'insightPop 0.65s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
          }}
        >
          Insight!
        </div>

        {/* Stars */}
        <div
          className="text-violet-400 text-xl tracking-[0.6em]"
          style={{ animation: 'insightFadeUp 0.4s 0.5s ease forwards', opacity: 0 }}
          aria-hidden="true"
        >
          ✦ ✦ ✦
        </div>

        {/* Encouragement */}
        <p
          className="text-white/85 font-bold text-xl"
          style={{ animation: 'insightFadeUp 0.45s 0.65s ease forwards', opacity: 0 }}
        >
          You spotted a hidden pattern!
        </p>

        {/* Coin reward */}
        {coins_delta > 0 && (
          <div
            className="flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/25 rounded-full px-6 py-2.5 mt-1"
            style={{ animation: 'insightFadeUp 0.45s 0.82s ease forwards', opacity: 0 }}
          >
            <div className="w-4 h-4 rounded-full bg-yellow-400 shadow-sm shadow-yellow-400/60" />
            <span className="text-yellow-400 font-black text-2xl">+{coins_delta}</span>
            <span className="text-yellow-400/60 text-sm font-bold">coins</span>
          </div>
        )}
      </div>
    </div>
  )
}
