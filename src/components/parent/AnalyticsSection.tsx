"use client";
import { useState } from "react";
import type { Child } from "@/types/parent";

interface Props { child: Child }

const CAT_STYLE: Record<string, { bg: string; text: string }> = {
  A: { bg: "bg-teal/15",   text: "text-teal"   },
  B: { bg: "bg-violet/15", text: "text-violet"  },
  C: { bg: "bg-gold/15",   text: "text-gold"    },
  D: { bg: "bg-coral/15",  text: "text-coral"   },
};

export default function AnalyticsSection({ child }: Props) {
  const [range, setRange] = useState<"7" | "30">("7");
  const stats = range === "7" ? child.analytics.last7 : child.analytics.last30;
  const maxVal = Math.max(...child.analytics.dailyActivity.map((d) => d.attempted), 1);

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Header + range toggle */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display font-800 text-primary text-sm sm:text-base">
          Performance Overview
        </h3>
        <div className="flex gap-1 bg-bg border border-border rounded-lg p-1 flex-shrink-0">
          {(["7", "30"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                range === r
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-muted hover:text-primary"
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats — 2 cols mobile, 4 cols lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Attempted",    value: stats.attempted,           accent: "border-l-teal",       icon: "🎯" },
          { label: "Correct",      value: stats.correct,             accent: "border-l-game-green", icon: "✅" },
          { label: "Hinted",       value: stats.hinted,              accent: "border-l-gold",       icon: "💡" },
          { label: "Correct Rate", value: `${stats.correctRate}%`,   accent: "border-l-violet",     icon: "📈" },
        ].map(({ label, value, accent, icon }) => (
          <div
            key={label}
            className={`bg-white rounded-xl border border-border border-l-4 ${accent} p-3.5 lg:p-4`}
          >
            <div className="text-lg mb-1">{icon}</div>
            <div className="font-display font-800 text-xl lg:text-2xl text-primary leading-none">
              {value}
            </div>
            <div className="text-[10px] lg:text-xs text-text-muted font-medium mt-1 uppercase tracking-wide">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Chart + weak concepts — stacked on mobile, side-by-side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Bar chart */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-border p-4 lg:p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="font-display font-800 text-primary text-sm">Daily Activity</span>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-teal/30 inline-block" />
                <span className="hidden sm:inline">Attempted</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-game-green/40 inline-block" />
                <span className="hidden sm:inline">Correct</span>
              </span>
            </div>
          </div>
          <div className="flex items-end justify-between gap-1 sm:gap-2 h-28 sm:h-32">
            {child.analytics.dailyActivity.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex items-end gap-0.5 h-20 sm:h-24">
                  <div
                    className="flex-1 bg-teal/25 rounded-t-sm transition-all"
                    style={{ height: `${(d.attempted / maxVal) * 100}%` }}
                  />
                  <div
                    className="flex-1 bg-game-green/40 rounded-t-sm transition-all"
                    style={{ height: `${(d.correct / maxVal) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] sm:text-[10px] text-text-muted font-medium">
                  {d.day.slice(0, 2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Weak concepts */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-border p-4 lg:p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="font-display font-800 text-primary text-sm">Weak Concepts</span>
            <span className="text-[10px] bg-coral/10 text-coral font-semibold px-2 py-0.5 rounded-full">
              error rate
            </span>
          </div>
          <div className="space-y-3">
            {child.weakConcepts.map((c, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-primary truncate max-w-[120px] sm:max-w-[150px]">
                    {c.name}
                  </span>
                  <span
                    className={`text-xs font-bold flex-shrink-0 ml-2 ${
                      c.combined > 60
                        ? "text-coral"
                        : c.combined > 40
                        ? "text-gold"
                        : "text-game-green"
                    }`}
                  >
                    {c.combined}%
                  </span>
                </div>
                <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      c.combined > 60
                        ? "bg-coral"
                        : c.combined > 40
                        ? "bg-gold"
                        : "bg-teal"
                    }`}
                    style={{ width: `${c.combined}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tricks + Sessions — stacked on mobile, side-by-side on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Trick log */}
        <div className="bg-white rounded-xl border border-border p-4 lg:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-display font-800 text-primary text-sm">Trick Discoveries</span>
            <span className="text-[10px] bg-violet/10 text-violet font-semibold px-2 py-0.5 rounded-full">
              {child.tricks.length} / 25
            </span>
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {child.tricks.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-4">No tricks discovered yet</p>
            ) : (
              child.tricks.map((t) => {
                const s = CAT_STYLE[t.category];
                return (
                  <div key={t.id} className="flex items-center gap-2.5 p-2 bg-bg rounded-lg">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${s.bg} ${s.text}`}
                    >
                      {t.category}
                    </div>
                    <span className="text-xs font-medium text-primary flex-1 truncate">
                      {t.name}
                    </span>
                    <span className="text-[10px] text-text-muted flex-shrink-0">
                      {t.discoveredAt}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Session history */}
        <div className="bg-white rounded-xl border border-border p-4 lg:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="font-display font-800 text-primary text-sm">Session History</span>
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {child.sessions.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-4">No sessions yet</p>
            ) : (
              child.sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2.5 bg-bg rounded-lg gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-primary">{s.date}</div>
                    <div className="text-[10px] text-text-muted mt-0.5 truncate">
                      {s.problemsAttempted} problems · {s.correctRate}%
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <span className="text-[11px] text-text-muted hidden sm:block">
                      {s.durationMins} min
                    </span>
                    <span className="text-xs font-bold text-gold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gold inline-block flex-shrink-0" />
                      +{s.coinsEarned}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Boss log — 1 col mobile, 2 sm, 3 lg */}
      <div className="bg-white rounded-xl border border-border p-4 lg:p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-display font-800 text-primary text-sm">⚔️ Boss Completions</span>
          <span className="text-[10px] bg-coral/10 text-coral font-semibold px-2 py-0.5 rounded-full">
            {child.bosses.length} cleared
          </span>
        </div>
        {child.bosses.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-4">No boss completions yet</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {child.bosses.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 p-3 bg-gradient-to-r from-coral/5 to-transparent border border-coral/15 rounded-xl"
              >
                <div className="w-9 h-9 rounded-lg bg-coral/10 flex items-center justify-center text-lg flex-shrink-0">
                  {b.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-primary truncate">{b.name}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {b.zone} · {b.completedAt}
                  </div>
                  <div className="text-[11px] font-bold text-coral mt-0.5">
                    +{b.coinsEarned} coins
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}