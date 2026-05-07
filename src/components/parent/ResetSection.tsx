"use client";
import { useState } from "react";

type ResetType = "zone" | "coins" | "tricks";

interface ResetConfig {
  type: ResetType;
  label: string;
  desc: string;
  icon: string;
  warningText: string;
}

const RESETS: ResetConfig[] = [
  {
    type: "zone",
    label: "Reset Zone Progress",
    desc: "Clears all zone advancement. Child starts from Zone 1.",
    icon: "🗺️",
    warningText: "This will permanently erase all zone and level progress for this child.",
  },
  {
    type: "coins",
    label: "Reset Coin Balance",
    desc: "Sets coin balance back to zero. Cannot be undone.",
    icon: "🪙",
    warningText: "This will permanently remove all coins earned by this child.",
  },
  {
    type: "tricks",
    label: "Reset Trick Discovery Log",
    desc: "Clears all discovered tricks. Child will rediscover them from scratch.",
    icon: "✨",
    warningText: "This will permanently erase all trick discoveries for this child.",
  },
];

interface Props {
  childName: string;
  onReset: (type: ResetType) => void;
}

export default function ResetSection({ childName, onReset }: Props) {
  const [step, setStep]       = useState<Record<ResetType, 0 | 1 | 2>>({ zone: 0, coins: 0, tricks: 0 });
  const [checked, setChecked] = useState<Record<ResetType, boolean>>({ zone: false, coins: false, tricks: false });
  const [completed, setCompleted] = useState<ResetType[]>([]);

  const begin   = (t: ResetType) => { setStep((s) => ({ ...s, [t]: 1 })); setChecked((c) => ({ ...c, [t]: false })); };
  const cancel  = (t: ResetType) => { setStep((s) => ({ ...s, [t]: 0 })); setChecked((c) => ({ ...c, [t]: false })); };
  const confirm = (t: ResetType) => { if (checked[t]) setStep((s) => ({ ...s, [t]: 2 })); };
  const execute = (t: ResetType) => { onReset(t); setCompleted((c) => [...c, t]); setStep((s) => ({ ...s, [t]: 0 })); };

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 bg-coral/8 border border-coral/20 rounded-xl">
        <span className="text-xl flex-shrink-0 mt-0.5">⚠️</span>
        <div>
          <div className="font-display font-800 text-primary text-sm mb-0.5">Destructive Actions</div>
          <p className="text-xs text-text-muted leading-relaxed">
            All reset actions for{" "}
            <strong className="text-primary">{childName}</strong> are{" "}
            <strong className="text-coral">permanent and irreversible</strong>. Double
            confirmation is required. Reset events are logged server-side for audit.
          </p>
        </div>
      </div>

      {/* Reset cards */}
      <div className="space-y-3">
        {RESETS.map((r) => {
          const st    = step[r.type];
          const isDone = completed.includes(r.type);

          return (
            <div
              key={r.type}
              className={`bg-white rounded-xl border overflow-hidden transition-all ${
                st > 0 ? "border-coral/40" : "border-border"
              }`}
            >
              {/* Main row */}
              <div className="flex items-center gap-3 sm:gap-4 p-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                    isDone ? "bg-game-green/10" : "bg-coral/8"
                  }`}
                >
                  {isDone ? "✅" : r.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-800 text-primary text-sm">{r.label}</div>
                  <div className="text-xs text-text-muted mt-0.5 hidden sm:block">{r.desc}</div>
                </div>
                {st === 0 && !isDone && (
                  <button
                    onClick={() => begin(r.type)}
                    className="flex-shrink-0 px-3.5 h-9 rounded-lg bg-coral/10 text-coral text-xs font-semibold hover:bg-coral/20 transition-colors border border-coral/20"
                  >
                    Reset
                  </button>
                )}
                {isDone && (
                  <span className="text-xs font-semibold text-game-green flex-shrink-0">
                    Complete
                  </span>
                )}
              </div>
              {/* Desc — mobile only (hidden above on sm) */}
              {st === 0 && !isDone && (
                <div className="px-4 pb-3 sm:hidden">
                  <p className="text-xs text-text-muted">{r.desc}</p>
                </div>
              )}

              {/* Step 1 */}
              {st === 1 && (
                <div className="border-t border-coral/20 bg-coral/4 px-4 pb-4 pt-3">
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-sm flex-shrink-0">🚨</span>
                    <p className="text-xs text-text-muted leading-relaxed">{r.warningText}</p>
                  </div>
                  <label className="flex items-start gap-2.5 cursor-pointer mb-4">
                    <input
                      type="checkbox"
                      checked={checked[r.type]}
                      onChange={(e) => setChecked((c) => ({ ...c, [r.type]: e.target.checked }))}
                      className="mt-0.5 w-4 h-4 rounded border-border accent-coral flex-shrink-0"
                    />
                    <span className="text-xs font-semibold text-primary leading-snug">
                      I understand this is permanent and cannot be undone
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => cancel(r.type)}
                      className="flex-1 h-9 rounded-lg border border-border text-text-muted text-xs font-semibold hover:bg-bg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={!checked[r.type]}
                      onClick={() => confirm(r.type)}
                      className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-all ${
                        checked[r.type]
                          ? "bg-coral text-white hover:bg-coral/90 shadow-sm"
                          : "bg-coral/20 text-coral/40 cursor-not-allowed"
                      }`}
                    >
                      Continue →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 */}
              {st === 2 && (
                <div className="border-t border-coral/30 bg-coral/6 px-4 pb-4 pt-3">
                  <div className="p-3 bg-coral/10 rounded-lg mb-3 text-center">
                    <div className="font-display font-800 text-coral text-sm mb-1">
                      Final Confirmation
                    </div>
                    <p className="text-xs text-text-muted">
                      You are about to permanently reset{" "}
                      <strong className="text-primary">{r.label.toLowerCase()}</strong> for{" "}
                      {childName}. There is no undo.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => cancel(r.type)}
                      className="flex-1 h-9 rounded-lg border border-border text-text-muted text-xs font-semibold hover:bg-bg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => execute(r.type)}
                      className="flex-1 h-9 rounded-lg bg-coral text-white text-xs font-bold hover:bg-coral/90 transition-all shadow-sm"
                    >
                      ⚠️ Yes, Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}