"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { logout } from "@/lib/auth/actions";
import { addChild, deleteChild, generateStory, fetchChildTricks, updateDifficultyCeiling, type DBChild, type GeneratedStory, type StoryChapter, type ChildTrick } from "@/lib/parent/actions";
import AddChildModal from "@/components/parent/AddChildModal";
import type { AddChildForm } from "@/types/parent";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Child {
  id: string;
  game_id: string;
  name: string;
  email: string;
  grade: number;
  dob: string;
  zone: number;
  zoneName: string;
  coins: number;
  lastActive: string;
  settings: {
    diffCeiling: number;
    autoScaling: boolean;
    dailyLimitMins: number;
    sessionLimitMins: number;
    volumeLevel: number;
  };
  stats7: { attempted: number; correct: number; hinted: number; rate: number };
  stats30: { attempted: number; correct: number; hinted: number; rate: number };
  activity: { day: string; attempted: number; correct: number }[];
  weakConcepts: { name: string; pct: number }[];
  tricks: { id: string; cat: "A" | "B" | "C" | "D"; name: string; date: string }[];
  sessions: { id: string; date: string; mins: number; coins: number; problems: number; rate: number }[];
  bosses: { id: string; name: string; zone: string; date: string; coins: number; emoji: string }[];
  stories: { id: string; title: string; body: string; style: string; date: string; status: "pending" | "approved" | "rejected" }[];
  audio: { id: string; name: string; ctx: string; size: string; on: boolean }[];
}

// ─── Zone name lookup ─────────────────────────────────────────────────────────
const ZONE_NAMES: Record<number, string> = {
  1: "Pebble Shore",
  2: "Echo Caves",
  3: "Iron Summit",
  4: "Fraction Forest",
  5: "Number Jungle",
};

// ─── DB → local Child ─────────────────────────────────────────────────────────
function dbChildToChild(d: DBChild): Child {
  return {
    id: d.id,
    game_id: d.game_id,
    name: d.name,
    email: d.email,
    grade: d.grade,
    dob: d.dob,
    zone: d.zone,
    zoneName: ZONE_NAMES[d.zone] ?? `Zone ${d.zone}`,
    coins: d.coins,
    lastActive: "Recently",
    settings: {
      diffCeiling: d.difficulty_ceiling,
      autoScaling: true,
      dailyLimitMins: 45,
      sessionLimitMins: 30,
      volumeLevel: 70,
    },
    stats7: { attempted: 0, correct: 0, hinted: 0, rate: 0 },
    stats30: { attempted: 0, correct: 0, hinted: 0, rate: 0 },
    activity: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({
      day,
      attempted: 0,
      correct: 0,
    })),
    weakConcepts: [],
    tricks: [],
    sessions: [],
    bosses: [],
    stories: [],
    audio: [],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
type Tab = "overview" | "analytics" | "settings" | "content" | "reset";

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "overview",  label: "Overview",  emoji: "🏠" },
  { id: "analytics", label: "Analytics", emoji: "📊" },
  { id: "settings",  label: "Settings",  emoji: "⚙️" },
  { id: "content",   label: "Stories",   emoji: "📖" },
  { id: "reset",     label: "Reset",     emoji: "🔄" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sz = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-11 h-11 text-sm" }[size];
  const palettes = ["bg-teal/20 text-teal", "bg-violet/20 text-violet", "bg-amber-100 text-amber-700", "bg-coral/15 text-coral"];
  return (
    <div className={`${sz} ${palettes[name.charCodeAt(0) % 4]} rounded-full flex items-center justify-center font-display font-800 flex-shrink-0`}>
      {name[0]}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide truncate">{label}</div>
        <div className="font-display font-800 text-stone-800 text-lg leading-tight">{value}</div>
      </div>
    </div>
  );
}

function SectionCard({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-50">
        <h3 className="font-display font-800 text-stone-800 text-sm">{title}</h3>
        {badge}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${color}`}>{label}</span>;
}

const AUDIO_CONTEXTS = ["Gameplay", "Boss Fight", "Win Screen", "Menu"] as const;
type AudioContext = typeof AUDIO_CONTEXTS[number];

function MusicUploadZone({ onUpload }: { onUpload: (file: File, ctx: AudioContext) => void }) {
  const [drag, setDrag] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [ctx, setCtx] = useState<AudioContext>("Gameplay");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): string | null => {
    const allowed = ["audio/mpeg", "audio/wav", "audio/wave", "audio/x-wav"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp3|wav)$/i))
      return "Only .mp3 and .wav files are supported";
    if (file.size > 10 * 1024 * 1024) return "File must be under 10 MB";
    return null;
  };

  const handleFile = (file: File) => {
    const err = validate(file);
    if (err) { setError(err); return; }
    setError(null);
    setPending(file);
  };

  const confirm = () => {
    if (!pending) return;
    onUpload(pending, ctx);
    setPending(null);
    setCtx("Gameplay");
  };

  const cancel = () => { setPending(null); setError(null); };

  return (
    <div className="space-y-3">
      {!pending ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload music file"
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => {
            e.preventDefault(); setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={e => e.key === "Enter" && inputRef.current?.click()}
          className={`relative flex flex-col items-center gap-2 px-4 py-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all select-none ${
            drag ? "border-teal bg-teal/5 scale-[0.99]" : "border-stone-200 bg-stone-50 hover:border-teal/50 hover:bg-teal/5"
          }`}
        >
          <input
          aria-label="Select music file to upload"
            ref={inputRef}
            type="file"
            accept=".mp3,.wav,audio/mpeg,audio/wav"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl transition-colors ${drag ? "bg-teal/15" : "bg-white border border-stone-100"}`}>
            🎵
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-stone-600">Drop a music file here</p>
            <p className="text-xs text-stone-400 mt-0.5">or <span className="text-teal font-semibold">click to browse</span></p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-400">.MP3</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-400">.WAV</span>
            <span className="text-[10px] text-stone-300">·</span>
            <span className="text-[10px] text-stone-400">Max 10 MB</span>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-teal/5 border border-teal/20 rounded-2xl space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal/15 flex items-center justify-center text-base flex-shrink-0">🎵</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-700 truncate">{pending.name}</p>
              <p className="text-[11px] text-stone-400">{(pending.size / (1024 * 1024)).toFixed(1)} MB</p>
            </div>
            <button type="button" onClick={cancel} aria-label="Remove selected file"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:bg-stone-100 transition-colors">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1l10 10M11 1L1 11"/></svg>
            </button>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-2">Plays during</p>
            <div className="flex flex-wrap gap-1.5">
              {AUDIO_CONTEXTS.map(c => (
                <button key={c} type="button" onClick={() => setCtx(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${ctx === c ? "bg-teal text-white shadow-sm" : "bg-white border border-stone-200 text-stone-500 hover:border-teal/40"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={confirm}
            className="w-full h-9 rounded-xl bg-teal text-white text-xs font-display font-800 hover:bg-teal/90 transition-colors shadow-sm">
            Add Track
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
          <span className="text-sm flex-shrink-0">⚠️</span>
          <p className="text-xs text-red-600 font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}

// Reusable toggle component with smooth animations and accessible labels for screen readers
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      aria-label={label ? (on ? `Disable ${label}` : `Enable ${label}`) : (on ? "Disable" : "Enable")}
      onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${on ? "bg-teal" : "bg-stone-200"}`}
    >
      <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-all ${on ? "left-5" : "left-0.5"}`} />
    </button>
  );
}

function NumberInput({
  value, onChange, min, max, unit, label,
}: {
  value: number; onChange: (v: number) => void; min: number; max: number; unit: string; label: string;
}) {
  const [local, setLocal] = useState(String(value));
  const commit = () => {
    const n = Math.max(min, Math.min(max, parseInt(local, 10) || min));
    setLocal(String(n));
    onChange(n);
  };
  return (
    <div className="flex items-center justify-between py-3 border-b border-stone-50 last:border-0">
      <div>
        <div className="text-sm font-semibold text-stone-700">{label}</div>
        <div className="text-xs text-stone-400 mt-0.5">{min}–{max} {unit}</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center border border-stone-200 rounded-xl overflow-hidden bg-stone-50">
          <button onClick={() => { const n = Math.max(min, value - 5); onChange(n); setLocal(String(n)); }}
            className="w-8 h-9 flex items-center justify-center text-stone-500 hover:bg-stone-100 transition-colors text-lg font-light">−</button>
          <input
            aria-label={`Set ${label}`}
            type="number" value={local} min={min} max={max}
            onChange={e => setLocal(e.target.value)}
            onBlur={commit}
            onKeyDown={e => e.key === "Enter" && commit()}
            className="w-14 h-9 text-center text-sm font-display font-800 text-stone-800 bg-stone-50 outline-none border-x border-stone-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button onClick={() => { const n = Math.min(max, value + 5); onChange(n); setLocal(String(n)); }}
            className="w-8 h-9 flex items-center justify-center text-stone-500 hover:bg-stone-100 transition-colors text-lg font-light">+</button>
        </div>
        <span className="text-xs text-stone-400 font-medium w-6">{unit}</span>
      </div>
    </div>
  );
}

// ─── Correct Rate Donut ───────────────────────────────────────────────────────
function CorrectRateDonut({ correctPct = 72 }: { correctPct?: number }) {
  const incorrectPct = 100 - correctPct;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const gap = 6;
  const correctLen = circ * (correctPct / 100) - gap;
  const incorrectLen = circ * (incorrectPct / 100) - gap;

  return (
    <SectionCard title="Answer Accuracy">
      <div className="flex flex-col items-center gap-5 py-1">
        <div className="relative w-40 h-40 drop-shadow-sm">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r={r} fill="none" stroke="#f5f5f4" strokeWidth="13" />
            <circle
              cx="50" cy="50" r={r} fill="none"
              stroke="#f73160"
              strokeWidth="13"
              strokeDasharray={`${Math.max(0, incorrectLen)} ${circ}`}
              strokeDashoffset={-(correctLen + gap)}
              strokeLinecap="round"
            />
            <circle
              cx="50" cy="50" r={r} fill="none"
              stroke="#2DD4BF"
              strokeWidth="13"
              strokeDasharray={`${Math.max(0, correctLen)} ${circ}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-display font-800 text-3xl text-stone-800 leading-none tabular-nums">{correctPct}%</span>
            <span className="text-[11px] text-stone-400 font-semibold mt-1">correct</span>
          </div>
        </div>

        <div className="w-full divide-y divide-stone-50 border border-stone-100 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-teal" />
              <span className="text-xs font-semibold text-stone-500">Correct</span>
            </div>
            <span className="font-display font-800 text-base text-teal tabular-nums">{correctPct}%</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0  bg-[#f73160]" />
              <span className="text-xs font-semibold text-stone-500">Incorrect</span>
            </div>
            <span className="font-display font-800 text-base text-[#f73160] tabular-nums">{incorrectPct}%</span>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Tab sections ─────────────────────────────────────────────────────────────
function OverviewTab({ child }: { child: Child }) {
  const max = Math.max(...child.activity.map(d => d.attempted), 1);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="🎯" label="Problems (7d)" value={child.stats7.attempted}       color="bg-teal/10" />
        <StatCard icon="✅" label="Correct Rate"  value={`${child.stats7.rate}%`}       color="bg-green-50" />
        <StatCard icon="✨" label="Tricks Found"  value={`${child.tricks.length}/25`}   color="bg-violet/10" />
        <StatCard icon="🪙" label="Coin Balance"  value={child.coins.toLocaleString()}  color="bg-amber-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SectionCard title="Daily Activity — This Week">
            <div className="flex items-end gap-2 h-28">
              {child.activity.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end gap-0.5 h-20">
                    <div className="flex-1 bg-teal/20 rounded-t" style={{ height: `${(d.attempted / max) * 100}%` }} />
                    <div className="flex-1 bg-teal/60 rounded-t"  style={{ height: `${(d.correct   / max) * 100}%` }} />
                  </div>
                  <span className="text-[9px] text-stone-400 font-medium">{d.day.slice(0, 2)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-[11px] text-stone-400"><span className="w-2.5 h-2.5 rounded-sm bg-teal/20 inline-block"/>Attempted</span>
              <span className="flex items-center gap-1.5 text-[11px] text-stone-400"><span className="w-2.5 h-2.5 rounded-sm bg-teal/60 inline-block"/>Correct</span>
            </div>
          </SectionCard>
        </div>

        <CorrectRateDonut correctPct={65} />
      </div>

      {/* <SectionCard title="Boss Completions" badge={<Pill label={`${child.bosses.length} cleared`} color="bg-coral/10 text-coral" />}>
        {child.bosses.length === 0 ? (
          <p className="text-xs text-stone-400 text-center py-4">No bosses defeated yet</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {child.bosses.map(b => (
              <div key={b.id} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
                <div className="w-9 h-9 rounded-xl bg-white border border-stone-100 flex items-center justify-center text-lg flex-shrink-0">{b.emoji}</div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-stone-700 truncate">{b.name}</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">{b.zone} · {b.date}</div>
                  <div className="text-[11px] font-bold text-amber-500 mt-0.5">+{b.coins}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard> */}
    </div>
  );
}

// ─── Trick Discoveries helpers ────────────────────────────────────────────────
const TRICK_PALETTE = [
  { bg: 'bg-teal/10',    text: 'text-teal',      border: 'border-teal/20'   },
  { bg: 'bg-violet/10',  text: 'text-violet',    border: 'border-violet/20' },
  { bg: 'bg-amber-50',   text: 'text-amber-600', border: 'border-amber-200' },
  { bg: 'bg-coral/10',   text: 'text-coral',     border: 'border-coral/20'  },
  { bg: 'bg-blue-50',    text: 'text-blue-600',  border: 'border-blue-200'  },
  { bg: 'bg-rose-50',    text: 'text-rose-500',  border: 'border-rose-200'  },
]

function trickCatStyle(category: string) {
  const idx = [...category].reduce((a, c) => a + c.charCodeAt(0), 0) % TRICK_PALETTE.length
  return TRICK_PALETTE[idx]
}

function trickTimeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function TrickDiscoveriesSection({ childId }: { childId: string }) {
  const [tricks, setTricks] = useState<ChildTrick[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchChildTricks(childId)
      .then(data => setTricks([...data].sort((a, b) => new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime())))
      .finally(() => setLoading(false))
  }, [childId])

  return (
    <SectionCard
      title="Trick Discoveries"
      badge={loading ? undefined : <Pill label={`${tricks.length} / 25 unlocked`} color="bg-violet/10 text-violet" />}
    >
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[72px] bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tricks.length === 0 ? (
        <div className="py-6 text-center">
          <div className="text-3xl mb-2">✨</div>
          <p className="text-xs font-semibold text-stone-500">No tricks discovered yet</p>
          <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">
            Tricks unlock when the child solves problems with insight
          </p>
        </div>
      ) : (
        <div className={`space-y-2 ${tricks.length > 4 ? "max-h-[340px] overflow-y-auto pr-1" : ""}`}>
          {tricks.map(t => {
            const s = trickCatStyle(t.category)
            return (
              <div key={t.trick_id} className={`p-3 rounded-xl border ${s.bg} ${s.border}`}>
                <div className="flex items-start gap-2.5">
                  <span className={`mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide flex-shrink-0 bg-white/70 ${s.text}`}>
                    {t.category}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-stone-800 truncate">{t.name}</span>
                      {t.insight_count > 0 && (
                        <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 whitespace-nowrap">
                          ✦ {t.insight_count}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {t.description}
                    </p>
                    <div className="text-[10px] text-stone-400 mt-1.5 text-right">
                      {trickTimeAgo(t.unlocked_at)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}

function AnalyticsTab({ child }: { child: Child }) {
  const [range, setRange] = useState<"7" | "30">("7");
  const stats = range === "7" ? child.stats7 : child.stats30;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-800 text-stone-800 text-sm">Performance Overview</h3>
        <div className="flex bg-stone-100 rounded-xl p-1">
          {(["7", "30"] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${range === r ? "bg-white text-stone-800 shadow-sm" : "text-stone-400"}`}>
              {r} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="🎯" label="Attempted"    value={stats.attempted}        color="bg-teal/10" />
        <StatCard icon="✅" label="Correct"      value={stats.correct}          color="bg-green-50" />
        <StatCard icon="💡" label="Hinted"       value={stats.hinted}           color="bg-amber-50" />
        <StatCard icon="📈" label="Correct Rate" value={`${stats.rate}%`}       color="bg-violet/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Weakest Concepts" badge={<Pill label="by error rate" color="bg-coral/10 text-coral" />}>
          {child.weakConcepts.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-4">Not enough data yet</p>
          ) : (
            <div className="space-y-3.5">
              {child.weakConcepts.map((c, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-stone-700 truncate max-w-[180px]">{c.name}</span>
                    <span className={`text-xs font-bold ${c.pct > 60 ? "text-coral" : c.pct > 40 ? "text-amber-500" : "text-teal"}`}>{c.pct}%</span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${c.pct > 60 ? "bg-coral" : c.pct > 40 ? "bg-amber-400" : "bg-teal"}`} style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <TrickDiscoveriesSection childId={child.game_id} />
      </div>

      {/* <SectionCard title="Session History">
        {child.sessions.length === 0 ? (
          <p className="text-xs text-stone-400 text-center py-4">No sessions yet</p>
        ) : (
          <div className="space-y-1">
            {child.sessions.map(s => (
              <div key={s.id} className="grid grid-cols-4 items-center py-2.5 border-b border-stone-50 last:border-0 text-xs">
                <span className="font-semibold text-stone-700">{s.date}</span>
                <span className="text-stone-500 text-center">{s.mins} min</span>
                <span className="text-stone-500 text-center">{s.problems} problems · {s.rate}%</span>
                <span className="font-bold text-amber-500 text-right">+{s.coins} 🪙</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard> */}

      {/* <SectionCard title="Boss Completion Log" badge={<Pill label={`${child.bosses.length} cleared`} color="bg-coral/10 text-coral" />}>
        {child.bosses.length === 0 ? (
          <p className="text-xs text-stone-400 text-center py-4">No bosses defeated yet</p>
        ) : (
          <div className="space-y-2">
            {child.bosses.map(b => (
              <div key={b.id} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
                <div className="w-9 h-9 rounded-xl bg-white border border-stone-100 flex items-center justify-center text-xl flex-shrink-0">{b.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-stone-700">{b.name}</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">{b.zone} · {b.date}</div>
                </div>
                <div className="font-bold text-amber-500 text-sm">+{b.coins}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard> */}
    </div>
  );
}

function SettingsTab({ child, childGameId, onSave, onAudioChange }: {
  child: Child;
  childGameId: string;
  onSave: (s: Child["settings"]) => void;
  onAudioChange: (audio: Child["audio"]) => void;
}) {
  const [cfg, setCfg] = useState({ ...child.settings });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const set = <K extends keyof Child["settings"]>(k: K, v: Child["settings"][K]) => {
    setCfg(p => ({ ...p, [k]: v }));
    setSaved(false);
    setSaveError(null);
  };
  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const result = await updateDifficultyCeiling(childGameId, cfg.diffCeiling);
    setSaving(false);
    if (result.error) { setSaveError(result.error); return; }
    onSave(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUpload = (file: File, ctx: AudioContext) => {
    const newTrack: Child["audio"][number] = {
      id: `${Date.now()}`,
      name: file.name.replace(/\.(mp3|wav)$/i, ""),
      ctx,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      on: true,
    };
    onAudioChange([...child.audio, newTrack]);
  };

  const toggleTrack = (id: string) =>
    onAudioChange(child.audio.map(a => a.id === id ? { ...a, on: !a.on } : a));

  const deleteTrack = (id: string) =>
    onAudioChange(child.audio.filter(a => a.id !== id));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="🎮 Difficulty Ceiling">
          <p className="text-xs text-stone-400 mb-4">Max difficulty level (1–10). System will not serve problems above this regardless of auto-scaling.</p>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-stone-700">Current ceiling</span>
            <span className="font-display font-800 text-2xl text-primary">{cfg.diffCeiling}</span>
          </div>
          <div className="relative h-3">
            <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal to-gold rounded-full transition-all" style={{ width: `${(cfg.diffCeiling / 10) * 100}%` }} />
            </div>
            <input aria-label="Difficulty ceiling slider" type="range" min={1} max={10} value={cfg.diffCeiling}
              onChange={e => set("diffCeiling", Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer" />
          </div>
          <div className="flex justify-between text-[10px] text-stone-400 mt-1.5"><span>Basic (1)</span><span>Competition (10)</span></div>
          <div className="mt-4 pt-4 border-t border-stone-50">
            <div className="text-[11px] text-stone-400 font-semibold uppercase tracking-wide mb-2">Applied to all zones</div>
            <div className="flex gap-1.5">
              {["Z1","Z2","Z3","Z4","Z5"].map(z => (
                <div key={z} className="flex-1 h-7 rounded-lg bg-stone-50 border border-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-400">{z}</div>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* <SectionCard title="⏱️ Time Limits">
          <p className="text-xs text-stone-400 mb-4">Set daily and per-session maximums. Soft warning at 80%, hard exit at 100%.</p>
          <NumberInput label="Daily Maximum" unit="min" min={10} max={180} value={cfg.dailyLimitMins} onChange={v => set("dailyLimitMins", v)} />
          <NumberInput label="Per-Session Maximum" unit="min" min={5} max={90} value={cfg.sessionLimitMins} onChange={v => set("sessionLimitMins", v)} />
          <div className="mt-4 space-y-2">
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
              <span className="text-sm flex-shrink-0">⚠️</span>
              <p className="text-[11px] text-amber-700 leading-relaxed">Child sees a soft warning when they reach <strong>80%</strong> of either limit.</p>
            </div>
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
              <span className="text-sm flex-shrink-0">🔒</span>
              <p className="text-[11px] text-red-600 leading-relaxed">Hard save-and-exit at <strong>100%</strong>. Child cannot override.</p>
            </div>
          </div>
        </SectionCard> */}


               <SectionCard
          title="🔊 Audio Management"
          badge={child.audio.length > 0 ? <Pill label={`${child.audio.length} track${child.audio.length !== 1 ? "s" : ""}`} color="bg-teal/10 text-teal" /> : undefined}
        >
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-stone-700">Master Volume</span>
              <span className="font-display font-800 text-amber-500 text-lg">{cfg.volumeLevel}%</span>
            </div>
            <div className="relative h-3">
              <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${cfg.volumeLevel}%` }} />
              </div>
              <input aria-label="Master volume slider" type="range" min={0} max={100} value={cfg.volumeLevel}
                onChange={e => set("volumeLevel", Number(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer" />
            </div>
          </div>

          <div className="border-t border-stone-50 pt-4 mb-4">
            <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-3">Upload Music</div>
            <MusicUploadZone onUpload={handleUpload} />
          </div>

          {child.audio.length > 0 && (
            <div className="border-t border-stone-50 pt-4">
              <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-3">Uploaded Tracks</div>
              <div className="space-y-2">
                {child.audio.map(af => (
                  <div key={af.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${af.on ? "bg-stone-50 border-stone-100" : "bg-white border-stone-100 opacity-60"}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 transition-colors ${af.on ? "bg-teal/10" : "bg-stone-100"}`}>🎵</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-stone-700 truncate">{af.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet/10 text-violet">{af.ctx}</span>
                        <span className="text-[10px] text-stone-400">{af.size}</span>
                      </div>
                    </div>
                    <Toggle on={af.on} onChange={() => toggleTrack(af.id)} label={af.name} />
                    <button type="button" aria-label={`Delete ${af.name}`} onClick={() => deleteTrack(af.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M1.5 3h9M4.5 3V2a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1m1 0l-.5 7a.5.5 0 01-.5.5h-4a.5.5 0 01-.5-.5L3.5 3"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="📈 Difficulty Auto-Scaling">
          <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl mb-4">
            <div>
              <div className="text-sm font-semibold text-stone-700">Auto-Scaling</div>
              <div className="text-xs text-stone-400 mt-0.5">{cfg.autoScaling ? "System advances zones automatically" : "Manual zone advancement only"}</div>
            </div>
            <Toggle on={cfg.autoScaling} onChange={v => set("autoScaling", v)} label="auto-scaling" />
          </div>
          <div className="p-3.5 bg-teal/5 border border-teal/20 rounded-xl">
            <div className="text-xs font-semibold text-stone-700 mb-1">Rule</div>
            <p className="text-[11px] text-stone-500 leading-relaxed">Zone advances when child sustains <strong className="text-stone-700">≥ 80% correct</strong> over the last <strong className="text-stone-700">10 problems</strong> at the current difficulty level.</p>
          </div>
          {!cfg.autoScaling && (
            <div className="mt-3 p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
              <div className="text-xs font-semibold text-stone-700 mb-1">Manual mode active</div>
              <p className="text-[11px] text-stone-500">Zone will only advance when you approve it manually.</p>
            </div>
          )}
        </SectionCard>

 
      </div>

      <div className="flex flex-col items-end gap-2">
        {saveError && (
          <p className="text-xs text-red-500 font-medium">{saveError}</p>
        )}
        <button type="button" onClick={save} disabled={saving}
          className={`h-11 px-8 rounded-xl text-sm font-display font-800 transition-all shadow-sm disabled:opacity-60 ${saved ? "bg-teal text-white" : "bg-primary text-white hover:bg-navy-light"}`}>
          {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

function ChapterAccordion({ chapter, open, onToggle }: {
  chapter: StoryChapter;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-stone-50 last:border-0">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50 transition-colors text-left">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center font-display font-800 text-primary text-xs flex-shrink-0">
          {chapter.number}
        </div>
        <span className="flex-1 text-sm font-semibold text-stone-700">{chapter.title}</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#a8a29e" strokeWidth="2"
          className={`flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path d="M2 5l5 5 5-5"/>
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1">
          <div className="p-4 bg-stone-50 rounded-xl text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">
            {chapter.content}
          </div>
        </div>
      )}
    </div>
  );
}

function ContentTab({ childId, childName }: { childId: string; childName: string }) {
  const [script, setScript] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [stories, setStories] = useState<GeneratedStory[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState<number | null>(null);

  const selected = stories.find(s => s.id === selectedId) ?? null;

  async function handleGenerate() {
    if (!script.trim() || generating) return;
    setGenError(null);
    setGenerating(true);
    const result = await generateStory(childId, script.trim());
    setGenerating(false);
    if (result.error) {
      setGenError(result.error);
      return;
    }
    if (result.story) {
      setStories(prev => [result.story!, ...prev]);
      setSelectedId(result.story!.id);
      setOpenChapter(1);
      setScript("");
    }
  }

  return (
    <div className="space-y-4">
      {/* Script input */}
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-50">
          <h3 className="font-display font-800 text-stone-800 text-sm">Generate a Story</h3>
          <p className="text-xs text-stone-400 mt-0.5">Describe the story you want for {childName}</p>
        </div>
        <div className="p-5 space-y-3">
          <textarea
            value={script}
            onChange={e => setScript(e.target.value)}
            placeholder={`e.g. A space adventure where ${childName} must solve multiplication puzzles to repair a rocket and return home…`}
            rows={4}
            disabled={generating}
            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-700 resize-none outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all leading-relaxed placeholder:text-stone-300 disabled:opacity-50"
          />
          {genError && (
            <p className="text-xs text-coral font-medium">{genError}</p>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={handleGenerate}
              disabled={!script.trim() || generating}
              className="h-10 px-6 rounded-xl bg-primary text-white text-sm font-display font-800 hover:bg-navy-light transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {generating ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin flex-shrink-0" />
                  Generating…
                </>
              ) : "✨ Generate Story"}
            </button>
          </div>
        </div>
      </div>

      {/* Loading skeleton */}
      {generating && (
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden animate-pulse">
          <div className="px-5 py-4 border-b border-stone-50 flex items-center justify-between">
            <div>
              <div className="h-4 bg-stone-100 rounded-lg w-44 mb-2" />
              <div className="h-3 bg-stone-100 rounded-lg w-32" />
            </div>
            <div className="h-3 bg-stone-100 rounded w-20" />
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-stone-50 last:border-0">
              <div className="w-7 h-7 rounded-lg bg-stone-100 flex-shrink-0" />
              <div className="h-3 bg-stone-100 rounded flex-1" />
            </div>
          ))}
        </div>
      )}

      {/* Story selector (when multiple stories generated in session) */}
      {!generating && stories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
          {stories.map(s => (
            <button key={s.id} type="button"
              onClick={() => { setSelectedId(s.id); setOpenChapter(null); }}
              className={`flex-shrink-0 h-9 px-4 rounded-xl text-xs font-semibold transition-all ${selectedId === s.id ? "bg-primary text-white shadow-sm" : "bg-white border border-stone-200 text-stone-500 hover:border-stone-300"}`}>
              {s.title}
            </button>
          ))}
        </div>
      )}

      {/* Generated story */}
      {!generating && selected && (
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-50 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-800 text-stone-800 text-base">{selected.title}</h3>
              <p className="text-xs text-stone-400 mt-0.5 line-clamp-1 italic">"{selected.generated_at}"</p>
            </div>
            <span className="text-[10px] text-stone-400 flex-shrink-0 mt-1 whitespace-nowrap">
              {selected.chapters.length} chapters
            </span>
          </div>
          <div>
            {selected.chapters.map(ch => (
              <ChapterAccordion
                key={ch.number}
                chapter={ch}
                open={openChapter === ch.number}
                onToggle={() => setOpenChapter(openChapter === ch.number ? null : ch.number)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!generating && stories.length === 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center">
          <div className="text-4xl mb-3">📖</div>
          <p className="text-sm font-semibold text-stone-600">No stories yet</p>
          <p className="text-xs text-stone-400 mt-1">
            Write a description above and {childName} will get a personalised adventure
          </p>
        </div>
      )}
    </div>
  );
}

function ResetTab({
  childName,
  onReset,
  onDeleteAccount,
  deleting = false,
  deleteError,
}: {
  childName: string;
  onReset: (t: "zone" | "coins" | "tricks") => void;
  onDeleteAccount: () => void;
  deleting?: boolean;
  deleteError?: string | null;
}) {
  const [step, setStep] = useState<Record<string, 0|1|2>>({ zone: 0, coins: 0, tricks: 0 });
  const [checked, setChecked] = useState<Record<string, boolean>>({ zone: false, coins: false, tricks: false });
  const [done, setDone] = useState<string[]>([]);
  const [deleteStep, setDeleteStep] = useState<0|1|2>(0);
  const [deleteChecked, setDeleteChecked] = useState(false);

  const resets = [
    { id: "zone",   emoji: "🗺️", label: "Zone Progress",       desc: "Resets zone to Zone 1. All progress is lost." },
    { id: "coins",  emoji: "🪙", label: "Coin Balance",         desc: "Sets coin balance to zero permanently." },
    { id: "tricks", emoji: "✨", label: "Trick Discovery Log",  desc: "Clears all discovered math tricks." },
  ] as const;

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-100">
        <span className="text-xl flex-shrink-0">⚠️</span>
        <div>
          <div className="font-display font-800 text-stone-800 text-sm">Destructive & Irreversible</div>
          <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
            These actions for <strong>{childName}</strong> are permanent. Each requires double confirmation.
          </p>
        </div>
      </div>

      {resets.map(r => {
        const st = step[r.id];
        const isDone = done.includes(r.id);
        return (
          <div key={r.id} className={`bg-white rounded-2xl border overflow-hidden transition-all ${st > 0 ? "border-red-200" : "border-stone-100"}`}>
            <div className="flex items-center gap-4 p-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${isDone ? "bg-green-50" : "bg-red-50"}`}>
                {isDone ? "✅" : r.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-700 text-stone-800 text-sm">{r.label}</div>
                <div className="text-xs text-stone-400 mt-0.5">{r.desc}</div>
              </div>
              {!isDone && st === 0 && (
                <button onClick={() => setStep(s => ({ ...s, [r.id]: 1 }))}
                  className="flex-shrink-0 h-9 px-4 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">Reset</button>
              )}
              {isDone && <span className="text-xs font-semibold text-teal flex-shrink-0">Done</span>}
            </div>
            {st === 1 && (
              <div className="border-t border-stone-100 bg-stone-50 p-4">
                <label className="flex items-start gap-2.5 cursor-pointer mb-4">
                  <input type="checkbox" checked={checked[r.id]}
                    onChange={e => setChecked(c => ({ ...c, [r.id]: e.target.checked }))}
                    className="mt-0.5 accent-red-500 w-4 h-4 flex-shrink-0" />
                  <span className="text-xs text-stone-600 font-medium leading-snug">I understand this is permanent and cannot be undone</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setStep(s => ({ ...s, [r.id]: 0 }))}
                    className="flex-1 h-9 rounded-xl border border-stone-200 text-stone-500 text-xs font-semibold hover:bg-white transition-colors">Cancel</button>
                  <button disabled={!checked[r.id]}
                    onClick={() => checked[r.id] && setStep(s => ({ ...s, [r.id]: 2 }))}
                    className={`flex-1 h-9 rounded-xl text-xs font-semibold transition-all ${checked[r.id] ? "bg-red-500 text-white hover:bg-red-600 shadow-sm" : "bg-red-100 text-red-300 cursor-not-allowed"}`}>Continue →</button>
                </div>
              </div>
            )}
            {st === 2 && (
              <div className="border-t border-red-100 bg-red-50 p-4">
                <p className="text-xs text-red-700 font-medium text-center mb-3">
                  Last chance — this will permanently reset <strong>{r.label}</strong> for {childName}.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setStep(s => ({ ...s, [r.id]: 0 }))}
                    className="flex-1 h-9 rounded-xl border border-stone-200 bg-white text-stone-500 text-xs font-semibold hover:bg-stone-50 transition-colors">Cancel</button>
                  <button onClick={() => { onReset(r.id); setDone(d => [...d, r.id]); setStep(s => ({ ...s, [r.id]: 0 })); }}
                    className="flex-1 h-9 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 shadow-sm transition-colors">⚠️ Yes, Reset</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Delete Child Account ─────────────────────────────────────────────── */}
      <div className="pt-2 border-t border-red-100">
        <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2 px-1">Danger Zone</div>
        <div className={`bg-white rounded-2xl border overflow-hidden transition-all ${deleteStep > 0 ? "border-red-300" : "border-red-200"}`}>
          <div className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-xl flex-shrink-0">🗑️</div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-700 text-red-600 text-sm">Remove Child Account</div>
              <div className="text-xs text-stone-400 mt-0.5">Permanently deletes {childName}'s account and all data.</div>
            </div>
            {deleteStep === 0 && (
              <button type="button" onClick={() => { setDeleteStep(1); setDeleteChecked(false); }}
                className="flex-shrink-0 h-9 px-4 rounded-xl border border-red-300 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
                Remove
              </button>
            )}
          </div>

          {deleteStep === 1 && (
            <div className="border-t border-stone-100 bg-stone-50 p-4">
              <label className="flex items-start gap-2.5 cursor-pointer mb-4">
                <input type="checkbox" checked={deleteChecked}
                  onChange={e => setDeleteChecked(e.target.checked)}
                  className="mt-0.5 accent-red-500 w-4 h-4 flex-shrink-0" />
                <span className="text-xs text-stone-600 font-medium leading-snug">
                  I understand this will permanently delete <strong>{childName}</strong>'s account and all their progress — this cannot be undone
                </span>
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setDeleteStep(0)}
                  className="flex-1 h-9 rounded-xl border border-stone-200 text-stone-500 text-xs font-semibold hover:bg-white transition-colors">Cancel</button>
                <button type="button" disabled={!deleteChecked}
                  onClick={() => deleteChecked && setDeleteStep(2)}
                  className={`flex-1 h-9 rounded-xl text-xs font-semibold transition-all ${deleteChecked ? "bg-red-500 text-white hover:bg-red-600 shadow-sm" : "bg-red-100 text-red-300 cursor-not-allowed"}`}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {deleteStep === 2 && (
            <div className="border-t border-red-200 bg-red-50 p-4">
              <p className="text-xs text-red-700 font-semibold text-center mb-3">
                Final confirmation — <strong>{childName}'s account and all data will be gone forever.</strong>
              </p>
              {deleteError && (
                <p className="text-xs text-red-600 text-center mb-3 bg-red-100 rounded-lg px-3 py-2">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setDeleteStep(0)} disabled={deleting}
                  className="flex-1 h-9 rounded-xl border border-stone-200 bg-white text-stone-500 text-xs font-semibold hover:bg-stone-50 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" onClick={onDeleteAccount} disabled={deleting}
                  className="flex-1 h-9 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 shadow-sm transition-colors disabled:opacity-60">
                  {deleting ? "Deleting…" : "⚠️ Yes, Remove Account"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  parentName: string;
  parentEmail: string;
  dbChildren: DBChild[];
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function ParentDashboardClient({ parentName, parentEmail, dbChildren }: Props) {
  const [children, setChildren] = useState<Child[]>(() => dbChildren.map(dbChildToChild));
  const [selectedId, setSelectedId] = useState<string>(dbChildren[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("overview");
  const [showAdd, setShowAdd] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const child = children.find(c => c.id === selectedId) ?? null;
  const pending = 0;

  const updateChild = (id: string, patch: Partial<Child>) =>
    setChildren(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));

  // ── Add child via server action ──────────────────────────────────────────────
  function handleAddChild(form: AddChildForm) {
    setAddError(null);
    startTransition(async () => {
      const result = await addChild(form);
      if (result.error) {
        setAddError(result.error);
        return;
      }
      if (result.child) {
        const nc = dbChildToChild(result.child);
        setChildren(cs => [...cs, nc]);
        setSelectedId(nc.id);
        setShowAdd(false);
      }
    });
  }

  // ── Delete child via server action ──────────────────────────────────────────
  function handleDeleteChild(childId: string) {
    setDeleteError(null);
    setIsDeleting(true);
    startTransition(async () => {
      const result = await deleteChild(childId);
      setIsDeleting(false);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      const remaining = children.filter(c => c.id !== childId);
      setChildren(remaining);
      setSelectedId(remaining[0]?.id ?? "");
      setTab("overview");
    });
  }

  // ── Sign out ─────────────────────────────────────────────────────────────────
  function handleSignOut() {
    startTransition(async () => { await logout(); });
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  const sidebarInner = (onClose?: () => void) => (
    <div className="flex flex-col h-full">
      {/* Logo + parent name */}
      <div className="px-5 pt-6 pb-5 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-gold rounded-2xl flex items-center justify-center font-display font-900 text-primary text-base">M</div>
          <span className="font-display font-800 text-white text-lg">Math<span className="text-gold">Quest</span></span>
          {onClose && (
            <button type="button" aria-label="Close menu" onClick={onClose}
              className="ml-auto w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 2l10 10M12 2L2 12"/></svg>
            </button>
          )}
        </div>
        {/* Parent info */}
        <div className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl bg-white/5">
          <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center font-display font-800 text-gold text-sm flex-shrink-0">
            {parentName[0]?.toUpperCase() ?? "P"}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{parentName}</div>
            <div className="text-[10px] text-white/40 truncate">{parentEmail}</div>
          </div>
        </div>
      </div>

      {/* Children list */}
      <div className="px-3 mb-3 flex-shrink-0">
        <div className="text-white/30 text-[10px] font-bold uppercase tracking-widest px-2 mb-2">My Children</div>
        <div className="space-y-0.5">
          {children.map(c => (
            <button type="button" aria-label={c.name} key={c.id}
              onClick={() => { setSelectedId(c.id); setTab("overview"); onClose?.(); }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left transition-all ${selectedId === c.id ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80"}`}>
              <Avatar name={c.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{c.name}</div>
                <div className="text-[10px] opacity-50">Grade {c.grade} · Zone {c.zone}</div>
              </div>
              {selectedId === c.id && <div className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0" />}
            </button>
          ))}
        </div>
        <button type="button" aria-label="Add child"
          onClick={() => { setAddError(null); setShowAdd(true); onClose?.(); }}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-white/15 text-white/35 text-xs font-semibold hover:border-gold/50 hover:text-gold/70 transition-all">
          + Add Child
        </button>
      </div>

      <div className="mx-3 border-t border-white/8 mb-3 flex-shrink-0" />

      {/* Nav */}
      {child && (
        <div className="px-3 flex-1 overflow-y-auto">
          <div className="text-white/30 text-[10px] font-bold uppercase tracking-widest px-2 mb-2">{child.name}</div>
          {TABS.map(t => (
            <button type="button" aria-label={t.label} key={t.id}
              onClick={() => { setTab(t.id); onClose?.(); }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left text-sm transition-all mb-0.5 relative ${tab === t.id ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/75"}`}>
              {tab === t.id && <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-gold rounded-full" />}
              <span className="text-base w-5 text-center">{t.emoji}</span>
              <span className="font-medium">{t.label}</span>
              {t.id === "content" && pending > 0 && (
                <span className="ml-auto w-4 h-4 rounded-full bg-coral text-white text-[9px] font-bold flex items-center justify-center">{pending}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Sign out */}
      <div className="px-3 pb-5 mt-auto flex-shrink-0">
        <button type="button" onClick={handleSignOut} disabled={isPending}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-white/25 text-xs font-medium hover:text-white/60 hover:bg-white/5 transition-colors disabled:opacity-50">
          🚪 {isPending ? "Signing out…" : "Sign Out"}
        </button>
      </div>
    </div>
  );

  // ── Empty state (no children yet) ───────────────────────────────────────────
  if (children.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="relative mb-8">
          <div className="w-28 h-28 rounded-3xl bg-primary flex items-center justify-center shadow-2xl">
            <span className="text-5xl">🏰</span>
          </div>
          <div className="absolute -top-2 -right-2 w-9 h-9 rounded-xl bg-gold flex items-center justify-center font-display font-900 text-primary text-sm shadow-lg">M</div>
        </div>
        <h2 className="font-display font-800 text-stone-800 text-2xl mb-2">Welcome, {parentName}!</h2>
        <p className="text-stone-500 text-sm max-w-xs leading-relaxed mb-8">Create your first child account to get started. Each child gets their own adventure.</p>
        <button onClick={() => { setAddError(null); setShowAdd(true); }}
          className="px-8 h-12 rounded-2xl bg-primary text-white font-display font-800 text-sm hover:bg-navy-light transition-colors shadow-lg">
          ✨ Add Your First Child
        </button>
        {showAdd && (
          <AddChildModal
            onClose={() => setShowAdd(false)}
            onAdd={handleAddChild}
            loading={isPending}
            serverError={addError}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 font-body flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 bg-primary flex-col flex-shrink-0 sticky top-0 h-screen overflow-hidden">
        {sidebarInner()}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-primary/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-primary shadow-2xl overflow-y-auto">
            {sidebarInner(() => setDrawerOpen(false))}
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-stone-100 flex items-center gap-3 px-4 py-3">
          <button onClick={() => setDrawerOpen(true)} aria-label="Open menu" type="button"
            className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4h12M2 8h12M2 12h12"/></svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-xl flex items-center justify-center font-display font-900 text-gold text-xs">M</div>
            <span className="font-display font-800 text-stone-800 text-base">Math<span className="text-gold">Quest</span></span>
          </div>
          {child && (
            <div className="ml-auto flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-full px-3 py-1">
              <span className="text-sm">🪙</span>
              <span className="font-display font-800 text-amber-600 text-xs">{child.coins.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
          {!child ? (
            <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Select a child</div>
          ) : (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
              <div className="flex items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={child.name} size="lg" />
                  <div className="min-w-0">
                    <h1 className="font-display font-800 text-stone-800 text-xl lg:text-2xl truncate">{child.name}</h1>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-xs text-stone-400">Grade {child.grade}</span>
                      <span className="text-stone-200">·</span>
                      <span className="text-xs font-semibold text-teal">Zone {child.zone} — {child.zoneName}</span>
                      <span className="text-stone-200 hidden sm:inline">·</span>
                      <span className="hidden sm:inline text-xs text-stone-400">{child.lastActive}</span>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-2.5 flex-shrink-0">
                  <span className="text-lg">🪙</span>
                  <div>
                    <div className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide">Coins</div>
                    <div className="font-display font-800 text-amber-600 text-base leading-none">{child.coins.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div className="pb-6">
                {tab === "overview"  && <OverviewTab child={child} />}
                {tab === "analytics" && <AnalyticsTab child={child} />}
                {tab === "settings"  && <SettingsTab child={child} childGameId={child.game_id} onSave={s => updateChild(child.id, { settings: s })} onAudioChange={audio => updateChild(child.id, { audio })} />}
                {tab === "content" && (
                  <ContentTab childId={child.id} childName={child.name} />
                )}
                {tab === "reset" && (
                  <ResetTab
                    childName={child.name}
                    onReset={type => {
                      if (type === "zone")   updateChild(child.id, { zone: 1, zoneName: ZONE_NAMES[1] });
                      if (type === "coins")  updateChild(child.id, { coins: 0 });
                      if (type === "tricks") updateChild(child.id, { tricks: [] });
                    }}
                    onDeleteAccount={() => handleDeleteChild(child.id)}
                    deleting={isDeleting}
                    deleteError={deleteError}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile bottom nav */}
        {child && (
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-100 flex shadow-lg">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 relative transition-colors ${tab === t.id ? "text-primary" : "text-stone-400"}`}>
                {tab === t.id && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-gold rounded-full" />}
                <span className="text-base leading-none">{t.emoji}</span>
                <span className="text-[9px] font-semibold">{t.label}</span>
                {t.id === "content" && pending > 0 && (
                  <span className="absolute top-2 right-[15%] w-3.5 h-3.5 rounded-full bg-coral text-white text-[8px] font-bold flex items-center justify-center">{pending}</span>
                )}
              </button>
            ))}
          </nav>
        )}
      </main>

      {showAdd && (
        <AddChildModal
          onClose={() => { setShowAdd(false); setAddError(null); }}
          onAdd={handleAddChild}
          loading={isPending}
          serverError={addError}
        />
      )}
    </div>
  );
}
