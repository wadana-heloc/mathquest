'use client'

// ─────────────────────────────────────────────────────────────
//  MathQuest · src/components/game/ProblemCard.tsx

//  The most critical UI component in MathQuest.
//  Rendered as a React overlay on top of the Phaser canvas.

//  PRD rules enforced:
//  ✓ Correct answer NEVER in client state or DOM
//  ✓ Wrong answers: no red, no shame, no health loss
//  ✓ Insight = violet glow + 3× coin animation
//  ✓ Rate limit: 1 attempt per 3s (UX enforcement — server enforces too)
//  ✓ 3 wrong answers → 10s cooldown
//  ✓ Hint section appears only after first wrong answer
//  ✓ Hints gate: can't use hint 2 without hint 1, etc.
//  ✓ Submit disabled until input has at least 1 character
//  ✓ Numeric keyboard on mobile (inputMode="numeric")

//  Design system: MathQuest_Design_System_v1.docx §5.1
//  Colors: --color-primary #1A1A2E · gold #E8B84B · teal #2DD4BF
//          violet #7C3AED · green #22C55E
//  Fonts:  Nunito (display) · loaded via globals.css
// ─────────────────────────────────────────────────────────────

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useTransition,
} from 'react'
import type { Problem, AttemptResult, HintResult, CardState } from '@/types/game'
import { submitAnswer, requestHint } from '@/lib/game/actions'

// ─────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────
const SUBMIT_RATE_LIMIT_MS = 3000
const WRONG_COOLDOWN_THRESHOLD = 3
const COOLDOWN_DURATION_S = 10

const ZONE_NAMES: Record<number, string> = {
  1: 'Pebble Shore',
  2: 'Echo Caves',
  3: 'Iron Summit',
  4: 'Fractured Expanse',
  5: 'Proof Labyrinth',
}

// Tailwind color classes per zone (matching design system)
const ZONE_BADGE_CLASSES: Record<number, string> = {
  1: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  2: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  3: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  4: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  5: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
}

// ─────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────

function DifficultyDots({ level }: { level: number }) {
  const filled = Math.ceil(level / 2)    // 1–10 → 1–5 dots
  return (
    <div className="flex items-center gap-1" aria-label={`Difficulty ${level} of 10`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`
            block w-2 h-2 rounded-full transition-all duration-300
            ${i < filled
              ? 'bg-teal-400 scale-110'
              : 'bg-white/10 border border-white/10'
            }
          `}
        />
      ))}
    </div>
  )
}

function ZoneBadge({ zone }: { zone: number }) {
  return (
    <span
      className={`
        text-[11px] font-bold uppercase tracking-widest
        px-3 py-1 rounded-md border
        ${ZONE_BADGE_CLASSES[zone] ?? ZONE_BADGE_CLASSES[1]}
      `}
    >
      Zone {zone} — {ZONE_NAMES[zone] ?? 'The Wilds'}
    </span>
  )
}

// Floating "+30" coin delta that animates up and fades
function CoinDelta({
  delta,
  isInsight,
  visible,
}: {
  delta: number
  isInsight: boolean
  visible: boolean
}) {
  return (
    <div
      aria-live="polite"
      className={`
        absolute -top-8 right-4 pointer-events-none select-none
        font-extrabold text-sm tracking-wide
        transition-all duration-1000
        ${isInsight ? 'text-violet-400 text-base' : 'text-yellow-400'}
        ${visible ? 'opacity-100 -translate-y-4' : 'opacity-0 translate-y-0'}
      `}
    >
      {delta > 0 ? `+${delta}` : delta}
    </div>
  )
}

// Insight badge that floats above the card
function InsightBadge({ visible }: { visible: boolean }) {
  return (
    <div
      aria-live="assertive"
      className={`
        absolute -top-5 left-1/2 -translate-x-1/2 z-10
        bg-violet-600 text-white text-xs font-black uppercase tracking-widest
        px-5 py-1.5 rounded-full whitespace-nowrap
        transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]
        ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}
      `}
    >
      ✦ Insight Detected
    </div>
  )
}

// Hint box — appears after first wrong answer
function HintBox({
  hints,
  currentLevel,
  currentCoins,
  revealedHintText,
  onRequestHint,
  disabled,
}: {
  hints: Problem['hints']
  currentLevel: 0 | 1 | 2 | 3
  currentCoins: number
  revealedHintText: string | null
  onRequestHint: () => void
  disabled: boolean
}) {
  const nextLevel = Math.min(currentLevel + 1, 3) as 1 | 2 | 3
  const nextHint = hints.find(h => h.level === nextLevel)
  const canAffordNext = nextHint ? currentCoins >= nextHint.cost : false
  const maxReached = currentLevel >= 3

  return (
    <div className="mx-5 mb-5">
      {/* Revealed hint text */}
      {revealedHintText && (
        <div className="
          bg-[#16213E] border border-dashed border-white/10
          rounded-xl p-4 mb-3 animate-[fadeSlideDown_0.3s_ease]
        ">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-1.5">
            Hint {currentLevel} of 3
            {currentLevel === 1 && (
              <span className="ml-2 text-green-400 font-bold">Free</span>
            )}
            {currentLevel > 1 && (
              <span className="ml-2 text-yellow-400 font-bold">
                {hints.find(h => h.level === currentLevel)?.cost} coins
              </span>
            )}
          </p>
          <p className="text-white/80 text-sm leading-relaxed">{revealedHintText}</p>
        </div>
      )}

      {/* Next hint button */}
      {!maxReached && nextHint && (
        <button
          type="button"
          onClick={onRequestHint}
          disabled={disabled || !canAffordNext}
          className={`
            w-full flex items-center justify-between
            border border-dashed rounded-xl px-4 py-3
            text-sm font-semibold transition-all duration-200
            ${canAffordNext && !disabled
              ? 'border-yellow-500/30 text-white/50 hover:border-yellow-500/60 hover:text-yellow-300 cursor-pointer'
              : 'border-white/10 text-white/20 cursor-not-allowed'
            }
          `}
        >
          <span>
            {revealedHintText ? `Reveal Hint ${nextLevel} of 3` : 'Need a hint?'}
          </span>
          <span className={`
            text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md
            ${nextHint.cost === 0
              ? 'bg-green-500/15 text-green-400'
              : canAffordNext
                ? 'bg-yellow-500/15 text-yellow-400'
                : 'bg-white/5 text-white/25'
            }
          `}>
            {nextHint.cost === 0 ? 'Free' : `${nextHint.cost} coins`}
          </span>
        </button>
      )}

      {maxReached && (
        <p className="text-center text-white/30 text-xs py-2">
          All hints used — you have everything you need
        </p>
      )}
    </div>
  )
}

// Cooldown overlay — shown after 3 consecutive wrong answers
function CooldownOverlay({ seconds }: { seconds: number }) {
  if (seconds <= 0) return null
  return (
    <div className="
      absolute inset-0 rounded-2xl z-20
      bg-[#1A1A2E]/90 backdrop-blur-sm
      flex flex-col items-center justify-center gap-3
    ">
      <div className="
        w-16 h-16 rounded-full border-4 border-teal-500/40
        flex items-center justify-center
      ">
        <span className="text-2xl font-black text-teal-300 tabular-nums">
          {seconds}
        </span>
      </div>
      <p className="text-white/60 text-sm font-medium text-center px-8">
        Take a breath — try again in {seconds}s
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Set-type answer helpers
// ─────────────────────────────────────────────────────────────

function getSetOptions(tags: string[]): string[] | null {
  if (tags.includes('parity'))      return ['odd', 'even']
  if (tags.includes('divisibility')) return ['yes', 'no']
  return null
}

function ChoiceButtons({
  options, selected, onSelect, disabled,
}: {
  options: string[]
  selected: string
  onSelect: (v: string) => void
  disabled: boolean
}) {
  return (
    <div className="flex gap-3">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(opt)}
          className={[
            'flex-1 h-14 rounded-xl text-lg font-black uppercase tracking-wider',
            'border-2 transition-all duration-200',
            selected === opt
              ? 'border-teal-400 bg-teal-400/15 text-teal-300 scale-[1.03]'
              : 'border-white/10 bg-[#16213E] text-white/60 hover:border-white/30 hover:text-white/90',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          ].join(' ')}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  ProblemCard props
// ─────────────────────────────────────────────────────────────
export interface ProblemCardProps {
  problem: Problem
  sessionId: string

  // Live state passed in from the parent game component
  currentCoins: number
  currentStreak: number

  // Callbacks — parent updates its state from these
  onCorrect: (result: AttemptResult) => void
  onInsight: (result: AttemptResult) => void
  onHintUsed: (result: HintResult, level: 1 | 2 | 3) => void
  onNextProblem: () => void
  onWrong?: () => void
}

// ─────────────────────────────────────────────────────────────
//  ProblemCard
// ─────────────────────────────────────────────────────────────
export function ProblemCard({
  problem,
  sessionId,
  currentCoins,
  currentStreak,
  onCorrect,
  onInsight,
  onHintUsed,
  onNextProblem,
  onWrong,
}: ProblemCardProps) {
  // ── Local state ────────────────────────────────────────────
  const [cardState, setCardState] = useState<CardState>('idle')
  const [inputValue, setInputValue] = useState('')
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2 | 3>(0)
  const [hintVisible, setHintVisible] = useState(false)
  const [revealedHintText, setRevealedHintText] = useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [wrongCount, setWrongCount] = useState(0)
  const [cooldownSecs, setCooldownSecs] = useState(0)
  const [coinDelta, setCoinDelta] = useState(0)
  const [showDelta, setShowDelta] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const lastSubmitRef = useRef(0)
  const startTimeRef = useRef(Date.now())
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [isPending, startTransition] = useTransition()

  // ── Reset when problem changes ─────────────────────────────
  useEffect(() => {
    setCardState('idle')
    setInputValue('')
    setHintLevel(0)
    setHintVisible(false)
    setRevealedHintText(null)
    setFeedbackMsg('')
    setWrongCount(0)
    setCooldownSecs(0)
    setShowDelta(false)
    startTimeRef.current = Date.now()
    lastSubmitRef.current = 0
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    // Auto-focus input
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [problem.id])

  // ── Flash coin delta ───────────────────────────────────────
  const flashDelta = useCallback((delta: number) => {
    setCoinDelta(delta)
    setShowDelta(true)
    setTimeout(() => setShowDelta(false), 1400)
  }, [])

  // ── Start cooldown ─────────────────────────────────────────
  const startCooldown = useCallback(() => {
    setCardState('cooldown')
    let secs = COOLDOWN_DURATION_S
    setCooldownSecs(secs)
    cooldownRef.current = setInterval(() => {
      secs -= 1
      setCooldownSecs(secs)
      if (secs <= 0) {
        clearInterval(cooldownRef.current!)
        setCardState('idle')
        setFeedbackMsg('Try again when ready')
        setWrongCount(0)
        setCooldownSecs(0)
      }
    }, 1000)
  }, [])

  // ── Submit handler ─────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    const now = Date.now()
    const busy =
      cardState === 'loading' ||
      cardState === 'correct' ||
      cardState === 'insight' ||
      cardState === 'cooldown' ||
      isPending

    if (busy) return
    if (now - lastSubmitRef.current < SUBMIT_RATE_LIMIT_MS) return

    const isSet = (problem.answer_type ?? 'exact') === 'set'
    const answer: number | string = isSet
      ? inputValue.trim().toLowerCase()
      : parseInt(inputValue.trim(), 10)

    if (!isSet && isNaN(answer as number)) return
    if (isSet && !inputValue.trim()) return

    lastSubmitRef.current = now
    const duration_ms = now - startTimeRef.current
    setCardState('loading')

    startTransition(async () => {
      try {
        const result = await submitAnswer({
          problem_id: problem.id,
          answer,
          duration_ms,
          hint_level_used: hintLevel,
          session_id: sessionId,
        })

        if (result.correct) {
          flashDelta(result.coins_delta)

          if (result.insight_detected) {
            setCardState('insight')
            setFeedbackMsg(`✦ Insight! +${result.coins_delta} coins`)
            onInsight(result)
          } else {
            setCardState('correct')
            setFeedbackMsg(`Correct! +${result.coins_delta} coins`)
            // onCorrect(result)
            onCorrect({
              ...result,
              hint_level_used: hintLevel // ✅ FIX
            })
          }

          // Advance to next problem after animation completes
          setTimeout(onNextProblem, result.insight_detected ? 1800 : 1200)
        } else {
          setCardState('incorrect')
          setFeedbackMsg('Not quite — try again')
          setInputValue('')
          const newWrong = wrongCount + 1
          setWrongCount(newWrong)
          setHintVisible(true)
          onWrong?.()

          if (newWrong >= WRONG_COOLDOWN_THRESHOLD) {
            startCooldown()
          } else {
            setTimeout(() => {
              setCardState('idle')
            }, 600)
          }
        }
      } catch (err) {
        setCardState('idle')
        setFeedbackMsg(
          err instanceof Error && err.message.includes('Rate')
            ? 'Slow down — wait a moment'
            : 'Connection issue — try again'
        )
        setTimeout(() => setFeedbackMsg(''), 2000)
      }
    })
  }, [
    cardState, isPending, inputValue, hintLevel, problem.id, sessionId,
    wrongCount, flashDelta, onCorrect, onInsight, onNextProblem, startCooldown,
  ])

  // ── Hint handler ───────────────────────────────────────────
  const handleHintRequest = useCallback(() => {
    const nextLevel = (hintLevel + 1) as 1 | 2 | 3
    if (nextLevel > 3) return

    const hintDef = problem.hints.find(h => h.level === nextLevel)
    if (!hintDef) return
    if (hintDef.cost > 0 && currentCoins < hintDef.cost) {
      setFeedbackMsg('Not enough coins for this hint')
      setTimeout(() => setFeedbackMsg(''), 2000)
      return
    }

    startTransition(async () => {
      try {
        const result = await requestHint({
          problem_id: problem.id,
          hint_level: nextLevel,
          session_id: sessionId,
        })
        setHintLevel(nextLevel)
        setRevealedHintText(result.hint_text)
        if (result.coin_cost > 0) flashDelta(-result.coin_cost)
        onHintUsed(result, nextLevel)
      } catch {
        setFeedbackMsg('Could not load hint')
        setTimeout(() => setFeedbackMsg(''), 2000)
      }
    })
  }, [
    hintLevel, problem, sessionId, currentCoins,
    flashDelta, onHintUsed,
  ])

  // ── Keyboard shortcut ──────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSubmit()
    },
    [handleSubmit],
  )

  // ── Derived state ──────────────────────────────────────────
  const isLoading = cardState === 'loading' || isPending
  const isResolved = cardState === 'correct' || cardState === 'insight'
  const inputDisabled = isLoading || isResolved || cardState === 'cooldown'
  const canSubmit = inputValue.trim().length > 0 && !inputDisabled

  // ── Card border/glow per state ─────────────────────────────
  const cardBorderClass = {
    idle: 'border-yellow-500/15',
    loading: 'border-yellow-500/15',
    correct: 'border-green-400/60 shadow-[0_0_20px_rgba(34,197,94,0.15)]',
    incorrect: 'border-white/10 animate-[shake_0.45s_ease]',
    insight: 'border-violet-500/80 shadow-[0_0_28px_rgba(124,58,237,0.25)]',
    cooldown: 'border-white/5',
  }[cardState]

  // ── Feedback text color per state ──────────────────────────
  const feedbackColorClass = {
    idle: 'text-white/30',
    loading: 'text-white/30',
    correct: 'text-green-400',
    incorrect: 'text-white/50',
    insight: 'text-violet-400',
    cooldown: 'text-white/40',
  }[cardState]

  // ─────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────
  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      <InsightBadge visible={cardState === 'insight'} />

      {/* Coin delta float */}
      <CoinDelta
        delta={coinDelta}
        isInsight={cardState === 'insight'}
        visible={showDelta}
      />

      {/* ── Card shell ────────────────────────────────────── */}
      <div
        className={`
          relative overflow-hidden rounded-2xl border
          bg-[#232340] transition-all duration-300
          ${cardBorderClass}
        `}
        role="main"
        aria-label="Math problem"
      >
        {/* Subtle grid texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
          aria-hidden="true"
        />

        {/* ── Header row ──────────────────────────────────── */}
        <div className="relative flex items-start justify-between px-5 pt-5 pb-0">
          <ZoneBadge zone={problem.zone} />
          <DifficultyDots level={problem.difficulty} />
        </div>

        {/* ── Flavor text ─────────────────────────────────── */}
        {problem.flavor_text && (
          <div className="relative px-5 pt-4 pb-0">
            <p className="text-[13px] text-white/40 italic leading-relaxed">
              <span
                className="font-serif text-3xl text-yellow-500/20 leading-none float-left mr-1 -mt-1"
                aria-hidden="true"
              >
                "
              </span>
              {problem.flavor_text}
            </p>
          </div>
        )}

        {/* ── Divider ─────────────────────────────────────── */}
        <div className="relative flex items-center gap-3 px-5 my-4" aria-hidden="true">
          <div className="flex-1 h-px bg-yellow-500/10" />
          <span className="text-yellow-500/20 text-[10px]">◆</span>
          <div className="flex-1 h-px bg-yellow-500/10" />
        </div>

        {/* ── Problem stem ────────────────────────────────── */}
        <div className="relative text-center px-5 pb-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-500/40 mb-2 font-[Nunito,sans-serif]">
            Solve to pass
          </p>
          {/* <p
            className="text-[28px] font-black text-white leading-tight tracking-tight font-[Nunito,sans-serif]"
            role="heading"
            aria-level={2}
            aria-label={`Problem: ${problem.stem}`}
          >
            {problem.stem}
          </p> */}
          <h2
            className="text-[28px] font-black text-white leading-tight tracking-tight font-[Nunito,sans-serif]"
            aria-label={`Problem: ${problem.stem}`}
          >
            {problem.stem}
          </h2>
        </div>

        {/* ── Divider ─────────────────────────────────────── */}
        <div className="relative h-px mx-5 my-5 bg-yellow-500/10" aria-hidden="true" />

        {/* ── Input + Submit ───────────────────────────────── */}
        <div className="relative px-5 pb-0 space-y-3">
          {(() => {
            const isSet   = (problem.answer_type ?? 'exact') === 'set'
            const options = isSet ? getSetOptions(problem.tags) : null

            if (isSet && options) {
              return (
                <ChoiceButtons
                  options={options}
                  selected={inputValue}
                  onSelect={v => setInputValue(v)}
                  disabled={inputDisabled}
                />
              )
            }

            const inputBorder =
              cardState === 'idle' || cardState === 'incorrect'
                ? 'border-white/8 focus:border-teal-400/70'
                : cardState === 'correct'
                  ? 'border-green-400/50'
                  : cardState === 'insight'
                    ? 'border-violet-500/60'
                    : 'border-white/5'

            return (
              <input
                ref={inputRef}
                type={isSet ? 'text' : 'number'}
                inputMode={isSet ? 'text' : 'numeric'}
                pattern={isSet ? undefined : '[0-9\\-]*'}
                className={[
                  'w-full h-14 rounded-xl text-center',
                  'text-[22px] font-black text-white tracking-wider',
                  'bg-[#16213E] outline-none',
                  'border-2 transition-all duration-200 caret-yellow-400',
                  'placeholder:text-white/15 placeholder:text-base placeholder:font-normal placeholder:tracking-normal',
                  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                  inputDisabled ? 'cursor-not-allowed opacity-50' : '',
                  inputBorder,
                ].join(' ')}
                placeholder={isSet ? 'Type your answer…' : 'Your answer…'}
                value={inputValue}
                disabled={inputDisabled}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="Enter your answer"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            )
          })()}

          {/* Submit button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`
              relative w-full h-13 rounded-xl overflow-hidden
              text-[15px] font-black uppercase tracking-widest
              transition-all duration-200
              ${canSubmit
                ? 'bg-yellow-400 text-[#1A1A2E] hover:-translate-y-px hover:bg-yellow-300 active:scale-[0.98]'
                : 'bg-yellow-400/20 text-yellow-400/30 cursor-not-allowed'
              }
            `}
            style={{ height: '52px' }}
          >
            {/* Shine sweep — only on enabled state */}
            {canSubmit && (
              <span
                className="absolute inset-0 -translate-x-full animate-[shine_2.5s_ease_infinite]"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)',
                }}
                aria-hidden="true"
              />
            )}
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-[#1A1A2E]/40 border-t-[#1A1A2E] animate-spin" />
                Checking…
              </span>
            ) : (
              'Submit Answer'
            )}
          </button>
        </div>

        {/* ── Feedback line ────────────────────────────────── */}
        <div
          className={`relative text-center text-[13px] font-semibold py-3 px-5 min-h-[40px] transition-colors duration-200 ${feedbackColorClass}`}
          aria-live="polite"
          role="status"
        >
          {feedbackMsg}
        </div>

        {/* ── Hint section ─────────────────────────────────── */}
        {hintVisible && (
          <HintBox
            hints={problem.hints}
            currentLevel={hintLevel}
            currentCoins={currentCoins}
            revealedHintText={revealedHintText}
            onRequestHint={handleHintRequest}
            disabled={inputDisabled || isPending}
          />
        )}

        {/* ── Cooldown overlay ─────────────────────────────── */}
        <CooldownOverlay seconds={cooldownSecs} />
      </div>
    </div>
  )
}