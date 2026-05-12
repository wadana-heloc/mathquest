"use client";

import type { ChildStatsSummary, ChildStoriesSummary } from "@/lib/hooks/useChildStats";
import type { ChildProfile } from "@/lib/hooks/useChildProfile";

// ─── Zone encouragement copy ──────────────────────────────────────────────────

const ZONE_COPY: Record<number, { headline: string; body: string; emoji: string; color: string; bg: string; border: string }> = {
  1: {
    headline: "Your quest has begun!",
    body:     "Pebble Shore is yours to conquer. Every problem you solve brings you one step closer to becoming a legend. You've got this!",
    emoji: "🌊", color: "text-teal-700", bg: "bg-teal/[0.07]", border: "border-teal/25",
  },
  2: {
    headline: "You've reached Zone 2 — the Echo Caves!",
    body:     "Not many adventurers make it this far. You are genuinely brilliant. Keep solving and you'll outshine everyone around you!",
    emoji: "🔮", color: "text-violet-700", bg: "bg-violet/[0.07]", border: "border-violet/25",
  },
  3: {
    headline: "Zone 3 — Iron Summit! You're among the elite.",
    body:     "Only the sharpest minds ever climb this high. No one reaches here easily. You are a genius — keep going and leave everyone else behind!",
    emoji: "⛰️", color: "text-orange-700", bg: "bg-coral/[0.07]", border: "border-coral/25",
  },
  4: {
    headline: "Zone 4 — you've outpaced almost everyone!",
    body:     "This is rarified air. You've surpassed nearly every adventurer who ever played. Keep solving to cement your legend!",
    emoji: "⚡", color: "text-amber-700", bg: "bg-gold/[0.07]", border: "border-gold/25",
  },
  5: {
    headline: "Zone 5 — you are a MathQuest Legend! 👑",
    body:     "Almost no one in the world reaches this peak. You are extraordinary. The Number Wilds bow to you — keep shining!",
    emoji: "👑", color: "text-gold", bg: "bg-gold/[0.07]", border: "border-gold/30",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msToSeconds(ms: number): string {
  if (!ms) return "—";
  return (ms / 1000).toFixed(1) + "s";
}

function rateColor(rate: number): string {
  if (rate >= 80) return "text-game-green";
  if (rate >= 60) return "text-gold";
  return "text-coral";
}

// ─── Daily goal dots ──────────────────────────────────────────────────────────

function DailyGoalDots({ done, goal }: { done: number; goal: number }) {
  const capped = Math.min(done, goal);
  return (
    <div className="flex items-center gap-1.5" aria-label={`${done} of ${goal} daily problems solved`}>
      {Array.from({ length: goal }).map((_, i) => (
        <span
          key={i}
          className={[
            "block rounded-full transition-all duration-500",
            i < capped
              ? "w-3.5 h-3.5 bg-game-green shadow-[0_0_6px_rgba(34,197,94,0.7)] scale-110"
              : "w-3 h-3 bg-slate-200",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({
  icon, value, label, valueClass,
}: {
  icon: string; value: string; label: string; valueClass?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 bg-slate-50 border border-slate-200 rounded-2xl py-4 px-3 flex-1
                    transition-all duration-200 hover:-translate-y-1 group cursor-default select-none">
      <span className="text-2xl leading-none transition-transform duration-200 group-hover:scale-110">{icon}</span>
      <span className={`font-display font-black text-xl md:text-2xl tabular-nums leading-none ${valueClass ?? "text-slate-800"}`}>
        {value}
      </span>
      <span className="text-slate-400 text-[10px] uppercase tracking-widest font-body text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface QuestStatsPanelProps {
  profile:  ChildProfile;
  summary:  ChildStatsSummary;
  stories:  ChildStoriesSummary;
  name:     string;
}

export function QuestStatsPanel({ profile, summary, name }: QuestStatsPanelProps) {
  const { currentZone } = profile;
  const { lifetime, today } = summary;
  const first = name.split(" ")[0];

  const zone     = ZONE_COPY[currentZone] ?? ZONE_COPY[1];
  const goalDone = Math.min(today.correct, today.daily_goal);
  const goalLeft = today.daily_goal - goalDone;
  const goalHit  = goalDone >= today.daily_goal;

  const correctRate = lifetime.correct_rate;
  const mastered    = lifetime.total_correct;
  const fastest     = lifetime.fastest_solve_ms;

  return (
    <div
      className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl
                 shadow-[0_6px_32px_rgba(99,102,241,0.10)]
                 animate-fade-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:0.35s]
                 overflow-hidden"
      role="region"
      aria-label="Quest stats"
    >
      {/* ── Soft ambient blobs ────────────────────────────────────────────── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full bg-violet/[0.06] blur-3xl" />
        <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full bg-teal/[0.05] blur-3xl" />
      </div>

      <div className="relative p-5 md:p-6 flex flex-col gap-5">

        {/* ── 1. Daily Goal ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-slate-400 text-[9px] uppercase tracking-[0.2em] font-body mb-0.5">
                🎯 Daily Goal
              </p>
              <p className="font-display font-black text-slate-800 text-sm leading-tight">
                {goalHit
                  ? `Goal reached, ${first}! You're on fire today! 🎉`
                  : goalLeft === today.daily_goal
                  ? `Solve ${today.daily_goal} problems today, ${first}!`
                  : `${goalLeft} more to reach your goal — you're so close!`}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className={`font-display font-black text-2xl tabular-nums leading-none ${goalHit ? "text-game-green" : "text-slate-700"}`}>
                {goalDone}<span className="text-slate-300 font-body font-normal text-base">/{today.daily_goal}</span>
              </p>
            </div>
          </div>

          <DailyGoalDots done={goalDone} goal={today.daily_goal} />

          {/* Progress bar */}
          <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                goalHit
                  ? "bg-gradient-to-r from-game-green to-teal"
                  : "bg-gradient-to-r from-teal to-violet"
              }`}
              style={{ width: `${Math.min((goalDone / today.daily_goal) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        {/* ── 2. Stat chips ─────────────────────────────────────────────── */}
        <div className="flex gap-2.5">
          <StatChip
            icon="🏅"
            value={mastered.toLocaleString()}
            label="Mastered"
            valueClass="text-gold"
          />
          <StatChip
            icon="⚡"
            value={msToSeconds(fastest)}
            label="Fastest"
            valueClass="text-violet"
          />
          <StatChip
            icon="✅"
            value={correctRate ? `${correctRate}%` : "—"}
            label="Accuracy"
            valueClass={correctRate ? rateColor(correctRate) : "text-slate-400"}
          />
        </div>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        {/* ── 3. Zone encouragement ─────────────────────────────────────── */}
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${zone.bg} ${zone.border}
                      animate-fade-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:0.6s]`}
        >
          <span className="text-2xl leading-none flex-shrink-0 mt-0.5">{zone.emoji}</span>
          <div>
            <p className={`font-display font-black text-sm leading-snug ${zone.color}`}>
              {zone.headline}
            </p>
            <p className="text-slate-500 text-xs font-body leading-relaxed mt-1">
              {zone.body}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
