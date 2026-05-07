


"use client";
import { useState } from "react";
import type { Child, ChildSettings } from "@/types/parent";

interface Props {
  child: Child;
  onUpdate: (settings: ChildSettings) => void;
}

const ZONES = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"];

export default function SettingsSection({ child, onUpdate }: Props) {
  const [s, setS] = useState<ChildSettings>({ ...child.settings });
  const [saved, setSaved] = useState(false);

  const update = (key: keyof ChildSettings, value: number | boolean) => {
    setS((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    onUpdate(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Difficulty + Time — stacked on mobile, side-by-side on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">

        {/* Difficulty Ceiling */}
        <div className="bg-white rounded-xl border border-border p-4 lg:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🎮</span>
            <div>
              <div className="font-display font-800 text-primary text-sm">Difficulty Ceiling</div>
              <div className="text-[11px] text-text-muted">Max difficulty level per zone</div>
            </div>
          </div>
          {ZONES.map((zone, i) => {
            const val = s.diffCeiling;
            return (
              <div key={zone} className="mb-4 last:mb-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-text-muted">{zone}</span>
                  <span className="font-display font-800 text-gold text-base">{val}</span>
                </div>
                <div className="relative h-2">
                  <div className="h-2 bg-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal to-gold rounded-full transition-all"
                      style={{ width: `${(val / 10) * 100}%` }}
                    />
                  </div>
                  <input
                    aria-label="difficulty ceiling"
                    type="range" min={1} max={10} value={val}
                    onChange={(e) => update("diffCeiling", Number(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
                  />
                </div>
                <div className="flex justify-between text-[9px] text-text-muted mt-1">
                  <span>Basic (1)</span>
                  <span>Competition (10)</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Time Limits */}
        <div className="bg-white rounded-xl border border-border p-4 lg:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">⏱️</span>
            <div>
              <div className="font-display font-800 text-primary text-sm">Time Limits</div>
              <div className="text-[11px] text-text-muted">Daily and per-session caps</div>
            </div>
          </div>

          {/* Daily */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-primary">Daily Maximum</span>
              <span className="font-display font-800 text-teal text-base">
                {s.dailyLimitMins} min
              </span>
            </div>
            <div className="relative h-2">
              <div className="h-2 bg-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal rounded-full transition-all"
                  style={{ width: `${(s.dailyLimitMins / 120) * 100}%` }}
                />
              </div>
              <input
                aria-label="daily time limit"
                type="range" min={10} max={120} step={5} value={s.dailyLimitMins}
                onChange={(e) => update("dailyLimitMins", Number(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
              />
            </div>
            <div className="flex justify-between text-[9px] text-text-muted mt-1">
              <span>10 min</span>
              <span>120 min</span>
            </div>
          </div>

          {/* Session */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-primary">Per-Session Maximum</span>
              <span className="font-display font-800 text-violet text-base">
                {s.sessionLimitMins} min
              </span>
            </div>
            <div className="relative h-2">
              <div className="h-2 bg-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet rounded-full transition-all"
                  style={{ width: `${(s.sessionLimitMins / 60) * 100}%` }}
                />
              </div>
              <input
                aria-label="session time limit"
                type="range" min={5} max={60} step={5} value={s.sessionLimitMins}
                onChange={(e) => update("sessionLimitMins", Number(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
              />
            </div>
            <div className="flex justify-between text-[9px] text-text-muted mt-1">
              <span>5 min</span>
              <span>60 min</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-2 p-2.5 bg-gold/8 rounded-lg">
              <span className="text-sm mt-0.5 flex-shrink-0">⚠️</span>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Soft warning at <strong className="text-primary">80%</strong> of both limits.
              </p>
            </div>
            <div className="flex items-start gap-2 p-2.5 bg-coral/5 rounded-lg">
              <span className="text-sm mt-0.5 flex-shrink-0">🔒</span>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Hard exit at <strong className="text-primary">100%</strong>. Child cannot override.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-scaling + Audio — stacked on mobile, side-by-side on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">

        {/* Auto-Scaling */}
        <div className="bg-white rounded-xl border border-border p-4 lg:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">📈</span>
            <div>
              <div className="font-display font-800 text-primary text-sm">
                Difficulty Auto-Scaling
              </div>
              <div className="text-[11px] text-text-muted">System adjusts difficulty automatically</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-bg rounded-xl mb-4">
            <div className="min-w-0 pr-4">
              <div className="text-sm font-semibold text-primary">Auto-Scaling</div>
              <div className="text-[11px] text-text-muted mt-0.5">
                {s.autoScaling
                  ? "System is advancing zones automatically"
                  : "Manual zone advancement only"}
              </div>
            </div>
            <button
                aria-label="toggle auto-scaling"
                type="button"
              onClick={() => update("autoScaling", !s.autoScaling)}
              className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 ${
                s.autoScaling ? "bg-teal" : "bg-border"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${
                  s.autoScaling ? "left-6" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div className="p-3.5 bg-teal/8 border border-teal/20 rounded-xl">
            <div className="text-xs font-semibold text-primary mb-1.5">Auto-scaling rule</div>
            <div className="text-[11px] text-text-muted leading-relaxed">
              Zone advances when the child sustains a{" "}
              <strong className="text-primary">≥80% correct rate</strong> over the last{" "}
              <strong className="text-primary">10 problems</strong> at the current difficulty.
            </div>
          </div>

          {!s.autoScaling && (
            <div className="mt-3 p-3.5 bg-gold/8 border border-gold/20 rounded-xl">
              <div className="text-xs font-semibold text-primary mb-1">Manual mode active</div>
              <p className="text-[11px] text-text-muted">
                Zone will only advance when you manually approve it.
              </p>
              <button 
                type="button"
                className="mt-2 text-xs font-bold text-gold hover:underline"
              >
                Advance to next zone →
              </button>
            </div>
          )}
        </div>

        {/* Audio Management */}
        <div className="bg-white rounded-xl border border-border p-4 lg:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🔊</span>
            <div>
              <div className="font-display font-800 text-primary text-sm">Audio Management</div>
              <div className="text-[11px] text-text-muted">Control audio files and volume</div>
            </div>
          </div>

          {/* Volume slider */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-primary">Master Volume</span>
              <span className="font-display font-800 text-gold text-base">{s.volumeLevel}%</span>
            </div>
            <div className="relative h-2">
              <div className="h-2 bg-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold/50 to-gold rounded-full transition-all"
                  style={{ width: `${s.volumeLevel}%` }}
                />
              </div>
              <input
                aria-label="volume level"
                type="range" min={0} max={100} value={s.volumeLevel}
                onChange={(e) => update("volumeLevel", Number(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
              />
            </div>
          </div>

          {/* Audio files */}
          <div className="space-y-2">
            {child.audioFiles.map((af) => (
              <div key={af.id} className="flex items-center gap-2.5 p-2.5 bg-bg rounded-lg">
                <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center text-sm flex-shrink-0">
                  🎵
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-primary truncate">{af.name}</div>
                  <div className="text-[10px] text-text-muted">{af.context} · {af.sizeLabel}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button 
                    type="button"
                    aria-label="play audio"
                  className="w-7 h-7 rounded-md bg-primary/6 flex items-center justify-center hover:bg-primary/10 transition-colors">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="#1A1A2E">
                      <polygon points="2,1 9,5 2,9" />
                    </svg>
                  </button>
                  <button 
                    type="button"
                    aria-label="delete audio"
                    className="w-7 h-7 rounded-md bg-coral/8 flex items-center justify-center hover:bg-coral/15 transition-colors">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#F97316" strokeWidth="1.5">
                      <path d="M2 2l6 6M8 2L2 8" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="toggle audio"
                    className={`w-8 h-4 rounded-full relative transition-all ${
                      af.active ? "bg-game-green" : "bg-border"
                    }`}
                  >
                    <div
                      className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${
                        af.active ? "left-4" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="mt-3 w-full h-10 rounded-lg border-2 border-dashed border-border text-xs text-text-muted font-semibold hover:border-gold/50 hover:text-gold transition-all flex items-center justify-center gap-2"
          >
            <span>+</span> Upload Audio File
          </button>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
        type="button"
          aria-label="save settings"
          onClick={handleSave}
          className={`w-full sm:w-auto px-8 h-11 rounded-xl font-display font-800 text-sm transition-all shadow-sm ${
            saved
              ? "bg-game-green text-white"
              : "bg-primary text-white hover:bg-navy-light"
          }`}
        >
          {saved ? "✓ Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}