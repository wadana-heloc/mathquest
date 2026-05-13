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
import { TricksModal, TrickRevealModal } from '@/components/game/TricksModal'
import { InsightCelebration } from '@/components/game/InsightCelebration'
import { fetchProblem, updateStreak, advanceZone, fetchCurrentTrick, fetchUnlockedTricks } from '@/lib/game/actions'
import type { Problem, AttemptResult, HintResult, TrickData } from '@/types/game'
import { ZONE1_EVENTS } from '@/lib/phaser/Zone1Scene'
import { useChildProfile } from '@/lib/hooks/useChildProfile'
import { fetchLatestStory, type LatestStory } from '@/lib/child/actions'
import { StoryModal, getLastReadStoryId } from '@/components/game/StoryModal'

//
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
  // const doJump = () => { const s = getScene(); if (s) s.touchJump = true }
  const doJump = () => {
  const s = getScene()
  if (s) {
    s.touchJump = true
    setTimeout(() => (s.touchJump = false), 100)
  }
}

  const btn = 'flex items-center justify-center rounded-2xl select-none transition-transform duration-75 active:scale-90'

  return (
    <div className="absolute bottom-6 left-0 right-0 z-30 flex items-end justify-between px-6 pointer-events-none">
      <div className="flex gap-3 pointer-events-auto">
        <button
        type="button"
          className={`${btn} w-20 h-20 bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white text-3xl shadow-lg`}
          onTouchStart={e => { prevent(e); startLeft() }} onTouchEnd={e => { prevent(e); stopLeft() }} onTouchCancel={e => { prevent(e); stopLeft() }}
          onMouseDown={startLeft} onMouseUp={stopLeft} onMouseLeave={stopLeft}
          aria-label="Move left"
        >◀</button>
        <button
          type="button"
          className={`${btn} w-20 h-20 bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white text-3xl shadow-lg`}
          onTouchStart={e => { prevent(e); startRight() }} onTouchEnd={e => { prevent(e); stopRight() }} onTouchCancel={e => { prevent(e); stopRight() }}
          onMouseDown={startRight} onMouseUp={stopRight} onMouseLeave={stopRight}
          aria-label="Move right"
        >▶</button>
      </div>
      <div className="pointer-events-auto">
        <button
          type="button"
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

function CoinStreak({ coins, sessionCoins, streak, capReached, onTricks, tricksCount, onStory, hasStory }: {
  coins: number; sessionCoins: number; streak: number
  capReached?: boolean
  onTricks?: () => void
  tricksCount?: number
  onStory?: () => void
  hasStory?: boolean
}) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 select-none">
      {/* Total balance */}
      <div className={`pointer-events-none flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2 border ${capReached ? 'border-white/20' : 'border-yellow-500/20'}`}>
        <div className={`w-4 h-4 rounded-full flex-shrink-0 ${capReached ? 'bg-white/30' : 'bg-yellow-400'}`} />
        <span className={`font-black text-sm tabular-nums ${capReached ? 'text-white/40' : 'text-yellow-400'}`}>{coins}</span>
        {capReached && <span className="text-white/40 text-xs font-bold">🔒</span>}
      </div>
      {/* Session earnings */}
      {sessionCoins > 0 && (
        <div className="pointer-events-none flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-emerald-400/30 rounded-full px-3 py-2">
          <span className="text-emerald-400 font-black text-xs tabular-nums">+{sessionCoins}</span>
          <span className="text-white/40 text-[10px] font-bold">session</span>
        </div>
      )}
      {/* Streak */}
      <div className="pointer-events-none flex items-center gap-2 bg-black/50 backdrop-blur-sm border border-orange-400/20 rounded-full px-4 py-2">
        <span>🔥</span>
        <span className="text-orange-300 font-black text-sm tabular-nums">{streak}</span>
      </div>
      {/* Tricks */}
      {onTricks && (
        <button
          type="button"
          onClick={onTricks}
          className="relative flex items-center gap-1.5 bg-black/50 hover:bg-yellow-400/15 backdrop-blur-sm border border-yellow-400/25 hover:border-yellow-400/50 text-yellow-300 rounded-full px-4 py-2 transition-all duration-150 active:scale-90"
          aria-label="View math tricks"
        >
          <span className="text-sm leading-none">✨</span>
          <span className="font-black text-sm">Tricks</span>
          {!!tricksCount && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 text-[#1A1A2E] text-[9px] font-black flex items-center justify-center">
              {tricksCount}
            </span>
          )}
        </button>
      )}
      {/* Story */}
      {onStory && (
        <button
          type="button"
          onClick={onStory}
          className="relative flex items-center gap-1.5 bg-black/50 hover:bg-amber-400/15 backdrop-blur-sm border border-amber-400/30 hover:border-amber-400/60 text-amber-300 rounded-full px-4 py-2 transition-all duration-150 active:scale-90"
          aria-label="Read your story"
        >
          <span className="text-sm leading-none">📖</span>
          <span className="font-black text-sm">Story</span>
          {hasStory && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>
      )}
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
      <div className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest border ${type === 'boss' ? 'bg-red-500/20 border-red-400/60 text-red-200' : 'bg-sky-500/20 border-sky-400/60 text-sky-200'
        }`}>
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
  trigger: ProblemTrigger
  problem: Problem
  zone: number
  coins: number
  streak: number
  sessionId: string
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
//  Zone complete
// ─────────────────────────────────────────────────────────────

function ZoneCompleteScreen({ onNext, onHub, sessionCoins }: { onNext: () => void; onHub: () => void; sessionCoins: number }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="text-center px-8 animate-[zoomIn_0.5s_ease_forwards]">
        <div className="flex justify-center mb-2">
          <img
            src="/child.jpg"
            alt="You celebrating"
            className="w-28 h-28 rounded-full object-cover border-4 border-yellow-400 shadow-xl shadow-yellow-400/40 animate-[zoomIn_0.6s_0.1s_ease_both]"
          />
        </div>
        <div className="text-7xl mb-6 animate-bounce">🏆</div>
        <h1 className="text-5xl font-black text-white mb-3 tracking-tight">Zone 1 Complete!</h1>
        <p className="text-yellow-400 text-xl font-bold mb-2">Pebble Shore — Conquered!</p>
        <p className="text-white/50 text-base mb-10">You defeated the Tidal Sentinel and solved all 8 obstacles!</p>
        <div className="flex justify-center gap-5 mb-10">
          {[
            { icon: '🪙', label: `+${sessionCoins} coins earned`, color: 'border-yellow-500/40 bg-yellow-950/60' },
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

  // Refs for Phaser integration and game state that doesn't need to trigger React re-renders
  const canvasRef = useRef<HTMLDivElement>(null)// Ref to Phaser game instance so we can call methods on it without causing re-renders
  const gameRef = useRef<import('phaser').Game | null>(null)// Ref to currently active problem trigger (obstacle or boss) so we can access it inside event handlers without stale closures

  //save the last active trigger that opened a modal, so we can send the answer result back to the correct obstacle even if the player moves around or triggers something else in the meantime. This is necessary because Phaser doesn't pause the game when the modal is open, so the player could potentially trigger another problem before answering the first one.
  const activeTriggerRef = useRef<ProblemTrigger | null>(null)

  // Store problems in a ref since they don't change after loading and we want to avoid re-renders when setting them.
  const problemsRef = useRef<Map<string, Problem>>(new Map())

  // Prevents sending two ANSWER_RESULT events for the same modal open.
  // Reset in dismissModal() — after the modal is fully gone — so the
  // next problem always starts with a clean slate.
  const answerDispatchedRef = useRef(false)
  const sessionIdRef = useRef(crypto.randomUUID())

  // Obstacle IDs that received at least one wrong answer. Persists across
  // modal open/close so returning to an obstacle and answering correctly
  // still counts as a broken streak.
  //save the IDs of obstacles that the player has attempted and gotten wrong, so we can show a warning if they try to answer it again and prevent them from getting coins for it until they get it right. This encourages players to learn from their mistakes rather than just spamming answers, while still allowing them to eventually earn coins for previously failed obstacles if they keep trying.
  const wrongObstaclesRef = useRef<Set<string>>(new Set())
  const phaseSignalsRef   = useRef<Map<string, string>>(new Map())

  // Get profile for coins, streak, etc.
  const { profile } = useChildProfile()

  const router = useRouter()
// React state for things that affect rendering

// Active trigger and problem for the currently open modal. Null if no modal is open.
  const [activeTrigger, setActiveTrigger] = useState<ProblemTrigger | null>(null)
// Active problem is stored in React state since it directly controls whether the modal is shown and what content it has.
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null)
  const [phaseSignal,   setPhaseSignal]   = useState<string | null>(null)
  const [coins, setCoins] = useState(0)
  const [sessionCoins, setSessionCoins] = useState(0)
  const [streak, setStreak] = useState(0)

  // Seed coins and streak from DB profile ONCE on initial load only.
  // We intentionally ignore subsequent profile changes here because the
  // realtime subscription in useChildProfile can fire with stale DB data
  // if the backend hasn't committed the coin write yet, which would
  // overwrite the optimistic update from handleCorrect/handleHintUsed.
  const profileSeededRef = useRef(false)
  useEffect(() => {
    if (profile && !profileSeededRef.current) {
      profileSeededRef.current = true
      setCoins(profile.coins)
      setStreak(profile.streak)
    }
  }, [profile])
  
  const [progress, setProgress] = useState({ solved: 0, total: 8 })
  
  const [bossPhase, setBossPhase] = useState(0)
// Boss becomes visible at phase 1, but we don't want to show the HUD until we get that event from Phaser to avoid spoilers.
  const [bossVisible, setBossVisible] = useState(false)
  const [zoneComplete, setZoneComplete] = useState(false)
  // Show touch controls if on a mobile device
  const [showControls, setShowControls] = useState(false)
  const [showTricks, setShowTricks] = useState(false)
  const [capReached, setCapReached] = useState(false)
  const [tricksCount, setTricksCount] = useState(0)
  const [trickData, setTrickData] = useState<TrickData | null>(null)
  const [showInsight, setShowInsight] = useState(false)
  const insightResultRef = useRef<AttemptResult | null>(null)
  const [showStory, setShowStory]   = useState(false)
  const [latestStory, setLatestStory] = useState<LatestStory | null>(null)
  const [isNewStory, setIsNewStory] = useState(false)

  activeTriggerRef.current = activeTrigger

  useEffect(() => {
    setShowControls('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }, [])

  useEffect(() => {
    fetchUnlockedTricks().then(d => setTricksCount(d.unlocked_tricks.length)).catch(() => {})
  }, [])

  useEffect(() => {
    fetchLatestStory().then(s => {
      setLatestStory(s)
      if (s && s.id !== getLastReadStoryId()) setIsNewStory(true)
    }).catch(() => {})
  }, [])


  // ── Boot Phaser ───────────────────────────────────────────
  useEffect(() => {
    //
    if (!canvasRef.current || gameRef.current) return
    const boot = async () => {
      // Dynamically import Phaser and the scene to reduce initial bundle size and load Phaser only when this component is mounted.
      const Phaser = (await import('phaser')).default
      const { Zone1Scene } = await import('@/lib/phaser/Zone1Scene')
      // Create the Phaser game instance and store it in a ref so we can call methods on it later without causing re-renders.
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
        // Clean up Phaser instance on unmount to free resources and avoid potential memory leaks or lingering event listeners.
    return () => { gameRef.current?.destroy(true); gameRef.current = null }
  }, [])

  // ── Phaser → React event bridge ───────────────────────────
  useEffect(() => {
    const onShowProblem = (e: Event) => {
      const data = (e as CustomEvent<ProblemTrigger>).detail

      // Serve cached problem (same problem shown if player revisits obstacle).
      const cached = problemsRef.current.get(data.obstacleId)
      if (cached) { setActiveTrigger(data); setActiveProblem(cached); return }

      // Serve cached phase signal (trick already discovered for this obstacle).
      const cachedSignal = phaseSignalsRef.current.get(data.obstacleId)
      if (cachedSignal) { setActiveTrigger(data); setPhaseSignal(cachedSignal); return }

      // First collision — fetch from backend.
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
            dispatchToPhaser(ZONE1_EVENTS.ANSWER_RESULT, { correct: false, obstacleId: data.obstacleId })
          }
        })
        .catch(err => {
          console.error('[Zone1] fetchProblem error:', err)
          dispatchToPhaser(ZONE1_EVENTS.ANSWER_RESULT, { correct: false, obstacleId: data.obstacleId })
        })
    }

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
      // Note: we intentionally do NOT remove the SHOW_PROBLEM listener on unmount because if the player navigates away from this page and then back, we want it to still work without having to re-mount the entire Phaser game. The other listeners can be cleaned up since they only affect UI elements that won't be present when the player returns.
      window.removeEventListener(ZONE1_EVENTS.BOSS_PHASE, onBossPhase)
      //
      window.removeEventListener(ZONE1_EVENTS.ZONE_COMPLETE, onZoneComplete)
    }
  }, [])

  // ── Send exactly one answer per modal open ────────────────
  const sendAnswer = useCallback((correct: boolean, obstacleId: string) => {
    if (answerDispatchedRef.current) return   // already sent for this modal
    answerDispatchedRef.current = true
    console.log('[Zone1] sendAnswer:', { correct, obstacleId })
    // Send the result back to Phaser so it can update the game state (e.g. remove obstacle, advance boss phase, etc.) based on whether the player's answer was correct or not. We use a custom event for this communication since Phaser and React don't share state and we want to keep them decoupled.
    dispatchToPhaser(ZONE1_EVENTS.ANSWER_RESULT, { correct, obstacleId })
  }, [])

  // ── Fetch trick details whenever a reveal signal arrives ─────
  useEffect(() => {
    if (!phaseSignal) return
    setTrickData(null)
    fetchCurrentTrick().then(t => { if (t) setTrickData(t) }).catch(() => {})
  }, [phaseSignal])

  // ── Dismiss modal — ALWAYS resets the dedup flag ──────────
  const dismissModal = useCallback(() => {
    answerDispatchedRef.current = false
    setActiveTrigger(null)
    setActiveProblem(null)
    setPhaseSignal(null)
    setTrickData(null)
  }, [])

  // ── Wrong attempt inside the modal ───────────────────────
  
  const handleWrong = useCallback(() => {
    // Mark this obstacle as having a wrong attempt so we can break the streak and show warnings on repeat attempts. We still allow the player to eventually earn coins for it if they keep trying, but this encourages them to learn from their mistakes rather than just spamming answers.
    const id = activeTriggerRef.current?.obstacleId
    if (id) wrongObstaclesRef.current.add(id)
  }, [])

  // ── Correct answer ────────────────────────────────────────
  const handleCorrect = useCallback((result: AttemptResult) => {
    const trigger = activeTriggerRef.current
    console.log('[Zone1][handleCorrect] trigger=', !!trigger, '| new_coin_balance=', result.new_coin_balance, '| coins_delta=', result.coins_delta, '| insight=', result.insight_detected)
    if (!trigger) return
    if (result.daily_cap_reached) setCapReached(true)
    setCoins(result.new_coin_balance)
    setSessionCoins(s => s + result.coins_delta)
    // Use streak_count from the backend response — authoritative value.
    // Only fire STREAK_INCREASE when the obstacle had no prior wrong attempt
    // (first-try correct = clean streak increment, not a recovery).
    setStreak(result.streak_count)
    if (!wrongObstaclesRef.current.has(trigger.obstacleId)) {
      window.dispatchEvent(new CustomEvent(ZONE1_EVENTS.STREAK_INCREASE))
    }
    
    setProgress(prev => {
      if (prev.solved >= prev.total) return prev
      return { ...prev, solved: prev.solved + 1 }
    })
    sendAnswer(true, trigger.obstacleId)
    dismissModal()
  }, [sendAnswer, dismissModal])

  // ── Insight detected — show celebration, then complete as correct ────────
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

  // ── Hint used — update coins based on hint cost ───────────
  const handleHintUsed = useCallback((result: HintResult) => {
    setCoins(result.new_coin_balance)
  }, [])

  // Called by ProblemCard's onNextProblem 1200ms after a correct answer.
  // Guard: if a new obstacle was triggered in that window, activeTriggerRef
  // will be non-null — skip the dismiss so we don't close the new modal
  // (which would leave Phaser blocked with no ANSWER_RESULT → freeze).
  const handleCorrectClose = useCallback(() => {
    if (!activeTriggerRef.current) dismissModal()
  }, [dismissModal])

  // ── ✕ button pressed ─────────────────────────────────────
  // The player is choosing to close the modal without a correct answer, so we treat it as a wrong attempt. We still want to send the answer result back to Phaser so it can update the game state accordingly (e.g. keep the obstacle in place, reset boss phase, etc.), and we also want to mark this obstacle as having a wrong attempt to break the streak and show warnings on repeat attempts. Finally, we dismiss the modal.
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

  // ── Trick discovered — player taps "Got it!" ─────────────
  const handlePhaseSignalDismiss = useCallback(() => {
    const trigger = activeTriggerRef.current
    if (trigger) sendAnswer(true, trigger.obstacleId)
    dismissModal()
  }, [sendAnswer, dismissModal])

  // ─────────────────────────────────────────────────────────
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1a6ec7]">
      <div ref={canvasRef} className="absolute inset-0" />
    
      <ProgressHUD solved={progress.solved} total={progress.total} />
      <BossHUD phase={bossPhase} visible={bossVisible} />

      <CoinStreak coins={coins} sessionCoins={sessionCoins} streak={streak} capReached={capReached} onTricks={() => setShowTricks(true)} tricksCount={tricksCount} onStory={() => { setShowStory(true); setIsNewStory(false) }} hasStory={isNewStory} />
      
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


      {activeTrigger && phaseSignal && (
        <TrickRevealModal trick={trickData} zone={1} onDismiss={handlePhaseSignalDismiss} />
      )}

      {activeTrigger && activeProblem && (
        <MathModal
          trigger={activeTrigger}
          problem={activeProblem}
          zone={1}
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
          onNext={() => { window.location.href = '/game/zone/2' }}
          onHub={() => router.push('/game')}
          sessionCoins={sessionCoins}
        />
      )}

      {showTricks && (
        <TricksModal onClose={() => setShowTricks(false)} />
      )}
      {showStory && (
        <StoryModal story={latestStory} onClose={() => setShowStory(false)} />
      )}
    </div>
  )
}