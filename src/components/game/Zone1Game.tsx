'use client'
// ─────────────────────────────────────────────────────────────
//  MathQuest · src/components/game/Zone1Game.tsx
//
//  Key fix: answerDispatchedRef is now reset inside dismissModal()
//  (when the modal fully closes) rather than inside onShowProblem
//  (when the next modal opens). This guarantees the ref is always
//  clean before the next problem's answer can be sent.
//
//  Flow per problem:
//    SHOW_PROBLEM fires → modal opens (answerDispatchedRef already false)
//    Player answers     → sendAnswer(true/false) → ref = true → modal closes
//    dismissModal()     → ref reset to false — ready for next problem
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ProblemCard } from '@/components/game/ProblemCard'
import { fetchProblems, updateStreak, advanceZone } from '@/lib/game/actions'
import type { Problem, AttemptResult, HintResult } from '@/types/game'
import { ZONE1_EVENTS } from '@/lib/phaser/Zone1Scene'
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
  const getScene = () => (window as any).__zone1Scene
  const prevent = (e: React.TouchEvent) => e.preventDefault()

  const startLeft = () => { const s = getScene(); if (s) s.touchLeft = true }
  const stopLeft = () => { const s = getScene(); if (s) s.touchLeft = false }
  const startRight = () => { const s = getScene(); if (s) s.touchRight = true }
  const stopRight = () => { const s = getScene(); if (s) s.touchRight = false }
  const doJump = () => { const s = getScene(); if (s) s.touchJump = true }

  const btn = 'flex items-center justify-center rounded-2xl select-none transition-transform duration-75 active:scale-90'

  return (
    <div className="absolute bottom-6 left-0 right-0 z-30 flex items-end justify-between px-6 pointer-events-none">
      <div className="flex gap-3 pointer-events-auto">
        <button
          className={`${btn} w-20 h-20 bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white text-3xl shadow-lg`}
          onTouchStart={e => { prevent(e); startLeft() }} onTouchEnd={e => { prevent(e); stopLeft() }} onTouchCancel={e => { prevent(e); stopLeft() }}
          onMouseDown={startLeft} onMouseUp={stopLeft} onMouseLeave={stopLeft}
          aria-label="Move left"
        >◀</button>
        <button
          className={`${btn} w-20 h-20 bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white text-3xl shadow-lg`}
          onTouchStart={e => { prevent(e); startRight() }} onTouchEnd={e => { prevent(e); stopRight() }} onTouchCancel={e => { prevent(e); stopRight() }}
          onMouseDown={startRight} onMouseUp={stopRight} onMouseLeave={stopRight}
          aria-label="Move right"
        >▶</button>
      </div>
      <div className="pointer-events-auto">
        <button
          className={`${btn} w-24 h-24 bg-yellow-400/80 backdrop-blur-sm border-2 border-yellow-300 text-[#1A1A2E] text-4xl shadow-xl shadow-yellow-400/30`}
          onTouchStart={e => { prevent(e); doJump() }} onMouseDown={doJump}
          aria-label="Jump"
        >↑</button>
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

  if (pct < 30) {
    barColor = 'from-purple-500 to-violet-400'
  } else if (pct < 70) {
    barColor = 'from-yellow-400 to-yellow-300'
  } else {
    barColor = 'from-green-400 to-emerald-400'
  }
  return (
    <div className="absolute top-4 left-4 z-20 select-none pointer-events-none">
      <div className="bg-black/50 backdrop-blur-sm rounded-2xl px-4 py-2.5 border border-white/10">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-yellow-400 text-sm font-black tracking-wide">⚓ Pebble Shore</span>
          <span className="text-white/40 text-xs">Zone 1</span>
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          {/* <div className="w-28 h-2 bg-white/10 rounded-full overflow-hidden">
        
            <div className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div> */}
          <div className="w-28 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-500`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-white/60 text-xs font-bold tabular-nums">{solved}/{total}</span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full border transition-all duration-300
               ${i < solved ? 'bg-yellow-400 border-yellow-300' : 'bg-white/10 border-white/20'}`} />
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
      <div className="bg-red-950/80 backdrop-blur-sm rounded-2xl px-4 py-2.5 border border-red-500/40">
        <div className="text-red-300 text-xs font-bold uppercase tracking-widest mb-1">⚡ Boss Battle</div>
        <div className="text-white text-sm font-black">Tidal Sentinel</div>
        <div className="flex gap-1.5 mt-1.5">
          {[1, 2, 3].map(i => (
            <div key={i} className={`w-6 h-3 rounded-sm border transition-all duration-500 ${i > phase ? 'bg-red-500 border-red-400' : 'bg-white/10 border-white/20'}`} />
          ))}
        </div>
        <div className="text-red-400/70 text-[10px] mt-1 font-bold">Phase {phase} of 3</div>
      </div>
    </div>
  )
}

function CoinStreak({ coins, sessionCoins, streak }: { coins: number; sessionCoins: number; streak: number }) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 select-none pointer-events-none">
      {/* Total balance */}
      <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm border border-yellow-500/20 rounded-full px-4 py-2">
        <div className="w-4 h-4 rounded-full bg-yellow-400 flex-shrink-0" />
        <span className="text-yellow-400 font-black text-sm tabular-nums">{coins}</span>
      </div>
      {/* Session earnings — only shown once the player earns something */}
      {sessionCoins > 0 && (
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-emerald-400/30 rounded-full px-3 py-2">
          <span className="text-emerald-400 font-black text-xs tabular-nums">+{sessionCoins}</span>
          <span className="text-white/40 text-[10px] font-bold">session</span>
        </div>
      )}
      {/* Streak */}
      <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm border border-orange-400/20 rounded-full px-4 py-2">
        <span>🔥</span>
        <span className="text-orange-300 font-black text-sm tabular-nums">{streak}</span>
      </div>
    </div>
  )
}

function KeyboardHint() {
  return (
    <div className="absolute bottom-4 right-4 z-10 select-none pointer-events-none">
      <div className="bg-black/30 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-white/10 text-white/30 text-[11px] flex gap-3">
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
      <div className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest border ${type === 'boss' ? 'bg-red-950/80 border-red-500/40 text-red-300' : 'bg-teal-950/80 border-teal-500/30 text-teal-300'
        }`}>
        {type === 'boss' ? '⚡ Boss Battle' : '🧩 Obstacle'}
      </div>
      <span className="text-white/60 text-sm font-bold">{label}</span>
    </div>
  )
}

function MathModal({
  trigger, problem, coins, streak,
  onCorrect, onInsight, onHintUsed,
  onCorrectClose, onWrongClose, onWrong,
}: {
  trigger: ProblemTrigger
  problem: Problem
  coins: number
  streak: number
  onCorrect: (r: AttemptResult) => void
  onInsight: (r: AttemptResult) => void
  onHintUsed: (r: HintResult) => void
  onCorrectClose: () => void
  onWrongClose: () => void
  onWrong: () => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 relative" style={{ animation: 'slideUp 0.3s ease forwards' }}>

        {/* ── ✕ Close button ── */}
        <button
          onClick={onWrongClose}
          className="absolute -top-3 -right-3 z-50 w-10 h-10 rounded-full
                     bg-white/10 hover:bg-white/25 backdrop-blur-sm
                     border border-white/20 hover:border-white/40
                     text-white/70 hover:text-white
                     flex items-center justify-center text-lg font-black
                     transition-all duration-150 active:scale-90"
          aria-label="Close problem"
        >✕</button>

        <ObstacleBadge label={trigger.label} type={trigger.type} />

        <ProblemCard
          problem={problem}
          sessionId="zone1-session"
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
//  Zone complete
// ─────────────────────────────────────────────────────────────

function ZoneCompleteScreen({ onNext, onHub, sessionCoins }: { onNext: () => void; onHub: () => void; sessionCoins: number }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="text-center px-8" style={{ animation: 'zoomIn 0.5s ease forwards' }}>
        <div className="text-7xl mb-6 animate-bounce">🏆</div>
        <h1 className="text-5xl font-black text-white mb-3 tracking-tight">Zone 1 Complete!</h1>
        <p className="text-yellow-400 text-xl font-bold mb-2">Pebble Shore — Conquered!</p>
        <p className="text-white/50 text-base mb-10">You defeated the Tidal Sentinel and solved all 8 obstacles!</p>
        <div className="flex justify-center gap-5 mb-10">
          {[
            { icon: '🪙', label: `+${sessionCoins} coins`, color: 'border-yellow-500/40 bg-yellow-950/60' },
            { icon: '🧩', label: 'Zone Badge', color: 'border-teal-500/40 bg-teal-950/60' },
            { icon: '📖', label: 'Story Ch. 1', color: 'border-violet-500/40 bg-violet-950/60' },
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
            className="bg-yellow-400 text-[#1A1A2E] font-black text-xl px-12 py-5 rounded-2xl
                       hover:bg-yellow-300 active:scale-95 transition-all duration-150 shadow-xl shadow-yellow-400/30"
          >Continue to Zone 2 →</button>
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

export default function Zone1Game() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<import('phaser').Game | null>(null)

  const activeTriggerRef = useRef<ProblemTrigger | null>(null)
  const problemsRef = useRef<Map<string, Problem>>(new Map())
  // Prevents sending two ANSWER_RESULT events for the same modal open.
  // Reset in dismissModal() — after the modal is fully gone — so the
  // next problem always starts with a clean slate.
  const answerDispatchedRef = useRef(false)
  // Obstacle IDs that received at least one wrong answer. Persists across
  // modal open/close so returning to an obstacle and answering correctly
  // still counts as a broken streak.
  const wrongObstaclesRef = useRef<Set<string>>(new Set())

  const { profile } = useChildProfile()
  const router = useRouter()

  const [activeTrigger, setActiveTrigger] = useState<ProblemTrigger | null>(null)
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null)
  const [coins, setCoins] = useState(0)
  const [sessionCoins, setSessionCoins] = useState(0)
  const [streak, setStreak] = useState(0)

  // Seed coins and streak from DB profile once loaded
  useEffect(() => {
    if (profile) {
      setCoins(profile.coins)
      setStreak(profile.streak)
    }
  }, [profile])
  const [progress, setProgress] = useState({ solved: 0, total: 8 })
  const [bossPhase, setBossPhase] = useState(0)
  const [bossVisible, setBossVisible] = useState(false)
  const [zoneComplete, setZoneComplete] = useState(false)
  const [showControls, setShowControls] = useState(false)

  activeTriggerRef.current = activeTrigger

  useEffect(() => {
    setShowControls('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }, [])

  // ── Load problems ─────────────────────────────────────────
  useEffect(() => {
    fetchProblems(1)
      .then(list => {
        const map = new Map<string, Problem>()
        list.forEach(p => map.set(p.id, p))
        problemsRef.current = map
        console.log('[Zone1] Problems loaded:', Array.from(map.keys()))
      })
      .catch(err => console.error('[Zone1] fetchProblems error:', err))
  }, [])

  // ── Boot Phaser ───────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || gameRef.current) return
    const boot = async () => {
      const Phaser = (await import('phaser')).default
      const { Zone1Scene } = await import('@/lib/phaser/Zone1Scene')
      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: canvasRef.current!,
        backgroundColor: '#1a6ec7',
        physics: { default: 'arcade' },
        scene: [Zone1Scene],
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        render: { antialias: true, pixelArt: false },
      })
    }
    boot()
    return () => { gameRef.current?.destroy(true); gameRef.current = null }
  }, [])

  // ── Phaser → React event bridge ───────────────────────────
  useEffect(() => {
    const onShowProblem = (e: Event) => {
      const data = (e as CustomEvent<ProblemTrigger>).detail
      console.log('[Zone1] SHOW_PROBLEM:', data.problemId)
      // Note: answerDispatchedRef is already false here because
      // dismissModal() reset it when the previous modal closed.

      const tryOpen = (retriesLeft: number) => {
        const problem = problemsRef.current.get(data.problemId)
        if (problem) {
          setActiveTrigger(data)
          setActiveProblem(problem)
          return
        }
        if (retriesLeft <= 0) {
          console.error('[Zone1] Problem not found:', data.problemId, '| loaded:', Array.from(problemsRef.current.keys()))
          // Unblock Phaser so the game doesn't freeze
          dispatchToPhaser(ZONE1_EVENTS.ANSWER_RESULT, { correct: false, obstacleId: data.obstacleId })
          return
        }
        setTimeout(() => tryOpen(retriesLeft - 1), 300)
      }
      // Problems should be loaded by the time the player hits the first obstacle, but if not, retry a few times before giving up and unblocking Phaser.
      tryOpen(6)
    }

    const onProgress = (e: Event) => { const d = (e as CustomEvent).detail; setProgress({ solved: d.solved, total: d.total }) }
    const onBossPhase = (e: Event) => { const d = (e as CustomEvent).detail; setBossPhase(d.phase); setBossVisible(true) }
    const onZoneComplete = () => {
      setZoneComplete(true)
      advanceZone(1).catch(() => {})
    }
    // Note: Phaser events are emitted on window, so we listen there rather than on a React ref.
    window.addEventListener(ZONE1_EVENTS.SHOW_PROBLEM, onShowProblem)
    // window.addEventListener(ZONE1_EVENTS.PROGRESS,      onProgress)
    window.addEventListener(ZONE1_EVENTS.BOSS_PHASE, onBossPhase)
    window.addEventListener(ZONE1_EVENTS.ZONE_COMPLETE, onZoneComplete)
    return () => {
      window.removeEventListener(ZONE1_EVENTS.SHOW_PROBLEM, onShowProblem)
      // window.removeEventListener(ZONE1_EVENTS.PROGRESS,      onProgress)
      window.removeEventListener(ZONE1_EVENTS.BOSS_PHASE, onBossPhase)
      window.removeEventListener(ZONE1_EVENTS.ZONE_COMPLETE, onZoneComplete)
    }
  }, [])

  // ── Send exactly one answer per modal open ────────────────
  const sendAnswer = useCallback((correct: boolean, obstacleId: string) => {
    if (answerDispatchedRef.current) return   // already sent for this modal
    answerDispatchedRef.current = true
    console.log('[Zone1] sendAnswer:', { correct, obstacleId })
    dispatchToPhaser(ZONE1_EVENTS.ANSWER_RESULT, { correct, obstacleId })
  }, [])

  // ── Dismiss modal — ALWAYS resets the dedup flag ──────────
  const dismissModal = useCallback(() => {
    answerDispatchedRef.current = false
    // wrongObstaclesRef intentionally NOT cleared — must persist across reopens
    setActiveTrigger(null)
    setActiveProblem(null)
  }, [])

  // ── Wrong attempt inside the modal ───────────────────────
  const handleWrong = useCallback(() => {
    const id = activeTriggerRef.current?.obstacleId
    if (id) wrongObstaclesRef.current.add(id)
  }, [])

  // ── Correct answer ────────────────────────────────────────
  const handleCorrect = useCallback((result: AttemptResult) => {
    const trigger = activeTriggerRef.current
    if (!trigger) return
    setCoins(result.new_coin_balance)
    setSessionCoins(s => s + result.coins_delta)
    if (wrongObstaclesRef.current.has(trigger.obstacleId)) {
      setStreak(0)
      updateStreak(false).catch(() => {})
    } else {
      setStreak(s => s + 1)
      updateStreak(true).catch(() => {})
    }
    setProgress(prev => {
      if (prev.solved >= prev.total) return prev
      return { ...prev, solved: prev.solved + 1 }
    })
    sendAnswer(true, trigger.obstacleId)
    dismissModal()
  }, [sendAnswer, dismissModal])

  const handleInsight = useCallback((result: AttemptResult) => {
    handleCorrect(result)
  }, [handleCorrect])

  const handleHintUsed = useCallback((result: HintResult) => {
    setCoins(result.new_coin_balance)
  }, [])

  // Called by ProblemCard's onNextProblem — after correct answer,
  // handleCorrect already ran so sendAnswer is a no-op, dismissModal
  // is called a second time which is also a no-op (state already null)
  const handleCorrectClose = useCallback(() => {
    dismissModal()
  }, [dismissModal])

  // ── ✕ button pressed ─────────────────────────────────────
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
    <div className="relative w-screen h-screen overflow-hidden bg-[#1a6ec7]">
      <div ref={canvasRef} className="absolute inset-0" />
    
      <ProgressHUD solved={progress.solved} total={progress.total} />
      <BossHUD phase={bossPhase} visible={bossVisible} />
      
      <CoinStreak coins={coins} sessionCoins={sessionCoins} streak={streak} />
      
      {/* Back to hub
      {!activeTrigger && (
        <button
          type="button"
          onClick={() => router.push('/game')}
          className="absolute bottom-6 left-6 z-20 flex items-center gap-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm border border-white/15 hover:border-white/30 text-white/60 hover:text-white text-sm font-bold px-4 py-2 rounded-full transition-all duration-200 select-none"
          aria-label="Back to game hub"
        >
          ← Hub
        </button>
      )} */}

      {!activeTrigger && <TouchControls visible={showControls} />}
      {!showControls && !activeTrigger && <KeyboardHint />}

      {activeTrigger && activeProblem && (
        <MathModal
          trigger={activeTrigger}
          problem={activeProblem}
          coins={coins}
          streak={streak}
          onCorrect={handleCorrect}
          onInsight={handleInsight}
          onHintUsed={handleHintUsed}
          onCorrectClose={handleCorrectClose}
          onWrongClose={handleWrongClose}
          onWrong={handleWrong}
        />
      )}

      {zoneComplete && (
        <ZoneCompleteScreen
          onNext={() => { window.location.href = '/game/zone/2' }}
          onHub={() => router.push('/game')}
          sessionCoins={sessionCoins}
        />
      )}
    </div>
  )
}