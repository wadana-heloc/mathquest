'use client'
// ─────────────────────────────────────────────────────────────
//  MathQuest · src/components/game/Zone2Game.tsx
//
//  React host for the Zone 2 "Echo Caves" Phaser scene.
//  Mirrors Zone1Game.tsx exactly — only theme, colors, and
//  event names differ.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ProblemCard } from '@/components/game/ProblemCard'
import { TricksModal, TrickRevealModal } from '@/components/game/TricksModal'
import { InsightCelebration } from '@/components/game/InsightCelebration'
import { fetchProblem, updateStreak, advanceZone, fetchCurrentTrick, fetchUnlockedTricks } from '@/lib/game/actions'
import type { Problem, AttemptResult, HintResult, TrickData } from '@/types/game'
import { ZONE2_EVENTS } from '@/lib/phaser/Zone2Scene'
import { useChildProfile } from '@/lib/hooks/useChildProfile'

interface ProblemTrigger {
  type: 'obstacle' | 'boss'
  obstacleId: string
  problemId: string
  label: string
  bossPhase?: number
}

function dispatchToPhaser(name: string, detail: object) {
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

// ─────────────────────────────────────────────────────────────
//  Touch controls
// ─────────────────────────────────────────────────────────────

function TouchControls({ visible }: { visible: boolean }) {
  if (!visible) return null
  const getScene = () => (window as any).__zone2Scene
  const prevent  = (e: React.TouchEvent) => e.preventDefault()

  const startLeft  = () => { const s = getScene(); if (s) s.touchLeft  = true  }
  const stopLeft   = () => { const s = getScene(); if (s) s.touchLeft  = false }
  const startRight = () => { const s = getScene(); if (s) s.touchRight = true  }
  const stopRight  = () => { const s = getScene(); if (s) s.touchRight = false }
  const doJump     = () => {
    const s = getScene()
    if (s) { s.touchJump = true; setTimeout(() => (s.touchJump = false), 100) }
  }

  const btn = 'flex items-center justify-center rounded-2xl select-none transition-transform duration-75 active:scale-90'

  return (
    <div className="absolute bottom-6 left-0 right-0 z-30 flex items-end justify-between px-6 pointer-events-none">
      <div className="flex gap-3 pointer-events-auto">
        <button type="button" className={`${btn} w-20 h-20 bg-purple-900/40 backdrop-blur-sm border-2 border-purple-400/40 text-white text-3xl shadow-lg shadow-purple-900/30`}
          onTouchStart={e => { prevent(e); startLeft() }} onTouchEnd={e => { prevent(e); stopLeft() }} onTouchCancel={e => { prevent(e); stopLeft() }}
          onMouseDown={startLeft} onMouseUp={stopLeft} onMouseLeave={stopLeft}
          aria-label="Move left">◀</button>
        <button type="button" className={`${btn} w-20 h-20 bg-purple-900/40 backdrop-blur-sm border-2 border-purple-400/40 text-white text-3xl shadow-lg shadow-purple-900/30`}
          onTouchStart={e => { prevent(e); startRight() }} onTouchEnd={e => { prevent(e); stopRight() }} onTouchCancel={e => { prevent(e); stopRight() }}
          onMouseDown={startRight} onMouseUp={stopRight} onMouseLeave={stopRight}
          aria-label="Move right">▶</button>
      </div>
      <div className="pointer-events-auto">
        <button type="button" className={`${btn} w-24 h-24 bg-violet-500/80 backdrop-blur-sm border-2 border-violet-300 text-[#04021A] text-4xl shadow-xl shadow-violet-500/40`}
          onTouchStart={e => { prevent(e); doJump() }} onMouseDown={doJump}
          aria-label="Jump">↑</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  HUDs
// ─────────────────────────────────────────────────────────────

function ProgressHUD({ solved, total }: { solved: number; total: number }) {
  const pct = Math.round((solved / total) * 100)
  let barColor = ''
  if      (pct < 30) barColor = 'from-purple-500 to-violet-400'
  else if (pct < 70) barColor = 'from-cyan-400 to-blue-400'
  else               barColor = 'from-emerald-400 to-teal-400'

  return (
    <div className="absolute top-4 left-4 z-20 select-none pointer-events-none">
      <div className="bg-[#04021A]/70 backdrop-blur-sm rounded-2xl px-4 py-2.5 border border-purple-500/20">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-purple-300 text-sm font-black tracking-wide">🦇 Echo Caves</span>
          <span className="text-white/40 text-xs">Zone 2</span>
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-28 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-white/60 text-xs font-bold tabular-nums">{solved}/{total}</span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full border transition-all duration-300
              ${i < solved ? 'bg-purple-400 border-purple-300' : 'bg-white/10 border-white/20'}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

function BossHUD({ phase, visible }: { phase: number; visible: boolean }) {
  if (!visible) return null
  return (
    <div className="absolute top-4 right-4 z-20 select-none pointer-events-none">
      <div className="bg-[#1a0050]/90 backdrop-blur-sm rounded-2xl px-4 py-2.5 border border-purple-500/50">
        <div className="text-purple-300 text-xs font-bold uppercase tracking-widest mb-1">⚡ Boss Battle</div>
        <div className="text-white text-sm font-black">Stone Warden</div>
        <div className="flex gap-1.5 mt-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className={`w-6 h-3 rounded-sm border transition-all duration-500
              ${i > phase ? 'bg-purple-500 border-purple-400' : 'bg-white/10 border-white/20'}`} />
          ))}
        </div>
        <div className="text-purple-400/70 text-[10px] mt-1 font-bold">Phase {phase} of 3</div>
      </div>
    </div>
  )
}

function CoinStreak({ coins, sessionCoins, streak, capReached, onTricks, tricksCount }: {
  coins: number; sessionCoins: number; streak: number
  capReached?: boolean
  onTricks?: () => void
  tricksCount?: number
}) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 select-none">
      <div className={`pointer-events-none flex items-center gap-2 bg-[#04021A]/60 backdrop-blur-sm rounded-full px-4 py-2 border ${capReached ? 'border-white/15' : 'border-purple-500/20'}`}>
        <div className={`w-4 h-4 rounded-full flex-shrink-0 ${capReached ? 'bg-white/25' : 'bg-purple-400 shadow-sm shadow-purple-400/50'}`} />
        <span className={`font-black text-sm tabular-nums ${capReached ? 'text-white/35' : 'text-purple-300'}`}>{coins}</span>
        {capReached && <span className="text-white/35 text-xs font-bold">🔒</span>}
      </div>
      {sessionCoins > 0 && (
        <div className="pointer-events-none flex items-center gap-1.5 bg-[#04021A]/60 backdrop-blur-sm border border-cyan-400/30 rounded-full px-3 py-2">
          <span className="text-cyan-400 font-black text-xs tabular-nums">+{sessionCoins}</span>
          <span className="text-white/40 text-[10px] font-bold">session</span>
        </div>
      )}
      <div className="pointer-events-none flex items-center gap-2 bg-[#04021A]/60 backdrop-blur-sm border border-orange-400/20 rounded-full px-4 py-2">
        <span>🔥</span>
        <span className="text-orange-300 font-black text-sm tabular-nums">{streak}</span>
      </div>
      {/* Tricks */}
      {onTricks && (
        <button
          type="button"
          onClick={onTricks}
          className="relative flex items-center gap-1.5 bg-[#04021A]/60 hover:bg-purple-400/15 backdrop-blur-sm border border-purple-400/25 hover:border-purple-400/50 text-purple-300 rounded-full px-4 py-2 transition-all duration-150 active:scale-90"
          aria-label="View math tricks"
        >
          <span className="text-sm leading-none">✨</span>
          <span className="font-black text-sm">Tricks</span>
          {!!tricksCount && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-400 text-[#04021A] text-[9px] font-black flex items-center justify-center">
              {tricksCount}
            </span>
          )}
        </button>
      )}
    </div>
  )
}

function KeyboardHint() {
  return (
    <div className="absolute bottom-4 right-4 z-10 select-none pointer-events-none">
      <div className="bg-[#04021A]/40 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-purple-500/15 text-white/30 text-[11px] flex gap-3">
        <span>← → or A D</span>
        <span>↑ / Space jump</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Math Modal
// ─────────────────────────────────────────────────────────────

function ObstacleBadge({ label, type }: { label: string; type: 'obstacle' | 'boss' }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-3">
      <div className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest border
        ${type === 'boss'
          ? 'bg-fuchsia-500/20 border-fuchsia-400/60 text-fuchsia-200'
          : 'bg-violet-500/20 border-violet-400/60 text-violet-200'}`}>
        {type === 'boss' ? '⚡ Boss Battle' : '🧩 Obstacle'}
      </div>
      <span className="text-white/60 text-sm font-bold">{label}</span>
    </div>
  )
}

function MathModal({
  trigger, problem, zone, coins, streak, sessionId,
  onCorrect, onInsight, onHintUsed,
  onCorrectClose, onWrongClose, onWrong,
}: {
  trigger:       ProblemTrigger
  problem:       Problem
  zone:          number
  coins:         number
  streak:        number
  sessionId:     string
  onCorrect:     (r: AttemptResult) => void
  onInsight:     (r: AttemptResult) => void
  onHintUsed:    (r: HintResult) => void
  onCorrectClose:() => void
  onWrongClose:  () => void
  onWrong:       () => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#04021A]/70 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 relative animate-[slideUp_0.3s_ease_forwards]">
        <button
          type="button"
          onClick={onWrongClose}
          className="absolute -top-3 -right-3 z-50 w-10 h-10 rounded-full
                     bg-purple-900/40 hover:bg-purple-800/60 backdrop-blur-sm
                     border border-purple-500/30 hover:border-purple-400/60
                     text-white/70 hover:text-white
                     flex items-center justify-center text-lg font-black
                     transition-all duration-150 active:scale-90"
          aria-label="Close problem"
        >✕</button>

        <ObstacleBadge label={trigger.label} type={trigger.type} />

        <ProblemCard
          problem={problem}
          sessionId={sessionId}
          zone={zone}
          currentCoins={coins}
          currentStreak={streak}
          onCorrect={onCorrect}
          onInsight={onInsight}
          onHintUsed={onHintUsed}
          onNextProblem={onCorrectClose}
          onWrong={onWrong}
        />

        <p className="text-center text-white/30 text-xs mt-3">
          Press ✕ to close and try again later
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Zone complete screen
// ─────────────────────────────────────────────────────────────

function ZoneCompleteScreen({ onNext, onHub, sessionCoins }: { onNext: () => void; onHub: () => void; sessionCoins: number }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#04021A]/80 backdrop-blur-md">
      <div className="text-center px-8 animate-[zoomIn_0.5s_ease_forwards]">
        <div className="flex justify-center mb-2">
          <img
            src="/child.jpg"
            alt="You celebrating"
            className="w-28 h-28 rounded-full object-cover border-4 border-purple-400 shadow-xl shadow-purple-400/40 animate-[zoomIn_0.6s_0.1s_ease_both]"
          />
        </div>
        <div className="text-7xl mb-6 animate-bounce">🏆</div>
        <h1 className="text-5xl font-black text-white mb-3 tracking-tight">Zone 2 Complete!</h1>
        <p className="text-purple-300 text-xl font-bold mb-2">Echo Caves — Conquered!</p>
        <p className="text-white/50 text-base mb-10">You defeated the Stone Warden and solved all 8 obstacles!</p>
        <div className="flex justify-center gap-5 mb-10">
          {[
            { icon: '🪙', label: `+${sessionCoins} coins earned`, color: 'border-yellow-500/40 bg-yellow-950/60' },
            { icon: '💎', label: 'Cave Badge', color: 'border-purple-500/40 bg-purple-950/60' },
            { icon: '📖', label: 'Story Ch. 2', color: 'border-cyan-500/40 bg-cyan-950/60' },
          ].map(r => (
            <div key={r.label} className={`px-5 py-4 rounded-2xl border ${r.color} text-center min-w-[90px]`}>
              <div className="text-3xl mb-2">{r.icon}</div>
              <div className="text-white/70 text-xs font-bold">{r.label}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onNext}
            className="bg-purple-500 text-white font-black text-xl px-12 py-5 rounded-2xl
                       hover:bg-purple-400 active:scale-95 transition-all duration-150
                       shadow-xl shadow-purple-500/30"
          >Continue to Zone 3 →</button>
          <button
            type="button"
            onClick={onHub}
            className="bg-white/10 hover:bg-white/20 text-white/70 hover:text-white font-black text-xl px-12 py-5 rounded-2xl
                       border border-white/15 hover:border-white/30 active:scale-95 transition-all duration-150"
          >← Back to Hub</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────

export default function Zone2Game() {
  const canvasRef         = useRef<HTMLDivElement>(null)
  const gameRef           = useRef<import('phaser').Game | null>(null)
  const activeTriggerRef  = useRef<ProblemTrigger | null>(null)
  const problemsRef       = useRef<Map<string, Problem>>(new Map())
  const answerDispatchedRef = useRef(false)
  const sessionIdRef = useRef(crypto.randomUUID())
  const wrongObstaclesRef = useRef<Set<string>>(new Set())
  const phaseSignalsRef   = useRef<Map<string, string>>(new Map())

  const { profile } = useChildProfile()
  const router      = useRouter()

  const [activeTrigger, setActiveTrigger] = useState<ProblemTrigger | null>(null)
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null)
  const [phaseSignal,   setPhaseSignal]   = useState<string | null>(null)
  const [coins,         setCoins]         = useState(0)
  const [sessionCoins,  setSessionCoins]  = useState(0)
  const [streak,        setStreak]        = useState(0)
  const [progress,      setProgress]      = useState({ solved: 0, total: 8 })
  const [bossPhase,     setBossPhase]     = useState(0)
  const [bossVisible,   setBossVisible]   = useState(false)
  const [zoneComplete,  setZoneComplete]  = useState(false)
  const [showControls,  setShowControls]  = useState(false)
  const [showTricks,    setShowTricks]    = useState(false)
  const [capReached,    setCapReached]    = useState(false)
  const [tricksCount,   setTricksCount]   = useState(0)
  const [trickData,     setTrickData]     = useState<TrickData | null>(null)
  const [showInsight,   setShowInsight]   = useState(false)
  const insightResultRef = useRef<AttemptResult | null>(null)

  activeTriggerRef.current = activeTrigger

  useEffect(() => {
    setShowControls('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }, [])

  useEffect(() => {
    fetchUnlockedTricks().then(d => setTricksCount(d.unlocked_tricks.length)).catch(() => {})
  }, [])

  // Seed coins and streak ONCE on initial load only — same race-condition
  // guard as Zone1Game. Realtime updates via useChildProfile can carry stale
  // DB data and would overwrite the optimistic update from handleCorrect.
  const profileSeededRef = useRef(false)
  useEffect(() => {
    if (profile && !profileSeededRef.current) {
      profileSeededRef.current = true
      setCoins(profile.coins)
      setStreak(profile.streak)
    }
  }, [profile])


  // ── Boot Phaser ───────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || gameRef.current) return
    const boot = async () => {
      const Phaser = (await import('phaser')).default
      const { Zone2Scene } = await import('@/lib/phaser/Zone2Scene')
      gameRef.current = new Phaser.Game({
        type:            Phaser.AUTO,
        width:           window.innerWidth,
        height:          window.innerHeight,
        parent:          canvasRef.current!,
        backgroundColor: '#04021A',
        physics:         { default: 'arcade' },
        scene:           [Zone2Scene],
        scale:           { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        render:          { antialias: true, pixelArt: false },
      })
    }
    boot()
    return () => { gameRef.current?.destroy(true); gameRef.current = null }
  }, [])

  // ── Phaser → React event bridge ───────────────────────────
  useEffect(() => {
    const onShowProblem = (e: Event) => {
      const data = (e as CustomEvent<ProblemTrigger>).detail

      const cached = problemsRef.current.get(data.obstacleId)
      if (cached) { setActiveTrigger(data); setActiveProblem(cached); return }

      const cachedSignal = phaseSignalsRef.current.get(data.obstacleId)
      if (cachedSignal) { setActiveTrigger(data); setPhaseSignal(cachedSignal); return }

      fetchProblem()
        .then(({ problem, phase_signal }) => {
          if (problem) {
            problemsRef.current.set(data.obstacleId, problem)
            setActiveTrigger(data)
            setActiveProblem(problem)
          } else if (phase_signal) {
            phaseSignalsRef.current.set(data.obstacleId, phase_signal)
            setActiveTrigger(data)
            setPhaseSignal(phase_signal)
          } else {
            dispatchToPhaser(ZONE2_EVENTS.ANSWER_RESULT, { correct: false, obstacleId: data.obstacleId })
          }
        })
        .catch(err => {
          console.error('[Zone2] fetchProblem error:', err)
          dispatchToPhaser(ZONE2_EVENTS.ANSWER_RESULT, { correct: false, obstacleId: data.obstacleId })
        })
    }

    const onBossPhase    = (e: Event) => { const d = (e as CustomEvent).detail; setBossPhase(d.phase); setBossVisible(true) }
    const onZoneComplete = () => { setZoneComplete(true); advanceZone(2).catch(() => {}) }

    window.addEventListener(ZONE2_EVENTS.SHOW_PROBLEM,    onShowProblem)
    window.addEventListener(ZONE2_EVENTS.BOSS_PHASE,      onBossPhase)
    window.addEventListener(ZONE2_EVENTS.ZONE_COMPLETE,   onZoneComplete)
    return () => {
      window.removeEventListener(ZONE2_EVENTS.SHOW_PROBLEM,  onShowProblem)
      window.removeEventListener(ZONE2_EVENTS.BOSS_PHASE,    onBossPhase)
      window.removeEventListener(ZONE2_EVENTS.ZONE_COMPLETE, onZoneComplete)
    }
  }, [])

  const sendAnswer = useCallback((correct: boolean, obstacleId: string) => {
    if (answerDispatchedRef.current) return
    answerDispatchedRef.current = true
    dispatchToPhaser(ZONE2_EVENTS.ANSWER_RESULT, { correct, obstacleId })
  }, [])

  // ── Fetch trick details whenever a reveal signal arrives ─────
  useEffect(() => {
    if (!phaseSignal) return
    setTrickData(null)
    fetchCurrentTrick().then(t => { if (t) setTrickData(t) }).catch(() => {})
  }, [phaseSignal])

  const dismissModal = useCallback(() => {
    answerDispatchedRef.current = false
    setActiveTrigger(null)
    setActiveProblem(null)
    setPhaseSignal(null)
    setTrickData(null)
  }, [])

  const handleWrong = useCallback(() => {
    const id = activeTriggerRef.current?.obstacleId
    if (id) wrongObstaclesRef.current.add(id)
  }, [])

  const handleCorrect = useCallback((result: AttemptResult) => {
    const trigger = activeTriggerRef.current
    if (!trigger) return
    if (result.daily_cap_reached) setCapReached(true)
    setCoins(result.new_coin_balance)
    setSessionCoins(s => s + result.coins_delta)
    setStreak(result.streak_count)
    if (!wrongObstaclesRef.current.has(trigger.obstacleId)) {
      window.dispatchEvent(new CustomEvent(ZONE2_EVENTS.STREAK_INCREASE))
    }
    setProgress(prev => prev.solved >= prev.total ? prev : { ...prev, solved: prev.solved + 1 })
    sendAnswer(true, trigger.obstacleId)
    dismissModal()
  }, [sendAnswer, dismissModal])

  const handleInsight = useCallback((result: AttemptResult) => {
    insightResultRef.current = result
    setShowInsight(true)
  }, [])

  const handleInsightDone = useCallback(() => {
    setShowInsight(false)
    const result = insightResultRef.current
    insightResultRef.current = null
    if (result) handleCorrect(result)
  }, [handleCorrect])

  const handleHintUsed = useCallback((result: HintResult) => {
    setCoins(result.new_coin_balance)
  }, [])

  // Guard: skip dismiss if a new modal already opened in the 1200ms window
  // after the correct answer — prevents closing the new modal and freezing Phaser.
  const handleCorrectClose = useCallback(() => {
    if (!activeTriggerRef.current) dismissModal()
  }, [dismissModal])

  const handlePhaseSignalDismiss = useCallback(() => {
    const trigger = activeTriggerRef.current
    if (trigger) sendAnswer(true, trigger.obstacleId)
    dismissModal()
  }, [sendAnswer, dismissModal])

  const handleWrongClose = useCallback(() => {
    const trigger = activeTriggerRef.current
    if (trigger) sendAnswer(false, trigger.obstacleId)
    const id = trigger?.obstacleId
    if (id && wrongObstaclesRef.current.has(id)) {
      setStreak(0)
      updateStreak(false).catch(() => {})
    }
    dismissModal()
  }, [sendAnswer, dismissModal])

  // ─────────────────────────────────────────────────────────
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#04021A]">
      <div ref={canvasRef} className="absolute inset-0" />

      <ProgressHUD solved={progress.solved} total={progress.total} />
      <BossHUD phase={bossPhase} visible={bossVisible} />
      <CoinStreak coins={coins} sessionCoins={sessionCoins} streak={streak} capReached={capReached} onTricks={() => setShowTricks(true)} tricksCount={tricksCount} />

      {!activeTrigger && <TouchControls visible={showControls} />}
      {!showControls && !activeTrigger && <KeyboardHint />}


      {activeTrigger && phaseSignal && (
        <TrickRevealModal trick={trickData} zone={2} onDismiss={handlePhaseSignalDismiss} />
      )}

      {activeTrigger && activeProblem && (
        <MathModal
          trigger={activeTrigger}
          problem={activeProblem}
          zone={2}
          coins={coins}
          streak={streak}
          sessionId={sessionIdRef.current}
          onCorrect={handleCorrect}
          onInsight={handleInsight}
          onHintUsed={handleHintUsed}
          onCorrectClose={handleCorrectClose}
          onWrongClose={handleWrongClose}
          onWrong={handleWrong}
        />
      )}

      {showInsight && (
        <InsightCelebration
          coins_delta={insightResultRef.current?.coins_delta ?? 0}
          onDone={handleInsightDone}
        />
      )}

      {zoneComplete && (
        <ZoneCompleteScreen
          onNext={() => { window.location.href = '/game/zone/3' }}
          onHub={() => router.push('/game')}
          sessionCoins={sessionCoins}
        />
      )}

      {showTricks && (
        <TricksModal onClose={() => setShowTricks(false)} />
      )}
    </div>
  )
}
