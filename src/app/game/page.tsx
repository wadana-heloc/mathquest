// 'use client'



// import { useState, useEffect, useCallback } from 'react'
// import { ProblemCard } from '@/components/game/ProblemCard'
// import { fetchProblems } from '@/lib/game/actions'
// import type { Problem, AttemptResult, HintResult } from '@/types/game'
// import MathParticles from '@/components/phaser/MathParticles'

// // ── UI Components ───────────────────────────────────────────

// function CoinPill({ coins }: { coins: number }) {
//   return (
//     <div className="flex items-center gap-2 bg-[#16213E] border border-yellow-500/20 rounded-full px-4 py-2">
//       <div className="w-5 h-5 rounded-full bg-yellow-400" />
//       <span className="text-yellow-400 font-bold text-sm">{coins}</span>
//     </div>
//   )
// }

// // function StreakDots({ streak }: { streak: number }) {
// //   return (
// //     <div className="flex items-center gap-2">
// //       {Array.from({ length: 5 }).map((_, i) => (
// //         <span
// //           key={i}
// //           className={`w-2.5 h-2.5 rounded-full ${
// //             i < streak ? 'bg-teal-400' : 'bg-white/10'
// //           }`}
// //         />
// //       ))}
// //     </div>
// //   )
// // }
// // function StreakDots({ streak }: { streak: number }) {
// //   return (
// //     <div className="flex items-center items-center gap-2">
// //       <span className="text-lg">🔥</span>

// //       <span className="text-white font-bold text-sm tabular-nums">
// //         {streak}
// //       </span>
// //     </div>
// //   )
// // }
// function StreakDots({ streak }: { streak: number }) {
//   return (
//     <div className="flex items-center gap-2 bg-[#16213E] px-3 py-1 rounded-full border border-orange-400/20">
//       <span className="text-base">🔥</span>

//       <span className="text-orange-300 font-black text-sm tabular-nums">
//         {streak}
//       </span>
//     </div>
//   )
// }

// // ── Main Page ───────────────────────────────────────────────

// export default function GamePage() {
//   const [problems, setProblems] = useState<Problem[]>([])
//   const [currentIdx, setCurrentIdx] = useState(0)

//   const [coins, setCoins] = useState(240)
//   const [streak, setStreak] = useState(0)

//   // 🔴 NEW: separate counter for streak bonus (PRD fix)
//   const [streakBonusCounter, setStreakBonusCounter] = useState(0)

//   const [loading, setLoading] = useState(true)

//   useEffect(() => {
//     fetchProblems(1).then(p => {
//       setProblems(p)
//       setLoading(false)
//     })
//   }, [])

//   // ── FIXED: handleCorrect ─────────────────────────────────

//   const handleCorrect = (result: AttemptResult) => {
//     const newStreak = streak + 1
//     const newBonusCounter = streakBonusCounter + 1

//     let bonus = 0

//     // ✅ PRD milestones
//     if (newBonusCounter === 3) bonus = 20
//     if (newBonusCounter === 5) bonus = 40
//     if (newBonusCounter === 10) bonus = 100

//     const totalGain = result.coins_delta + bonus

//     // ✅ Daily cap
//     const DAILY_CAP = 300
//     const allowed = Math.max(0, DAILY_CAP - coins)
//     const actualGain = Math.min(totalGain, allowed)

//     setCoins(prev => prev + actualGain)
//     setStreak(newStreak)
//     setStreakBonusCounter(newBonusCounter)
//   }

//   // ── FIXED: Insight ───────────────────────────────────────

//   const handleInsight = (result: AttemptResult) => {
//     // same logic as correct
//     handleCorrect(result)
//   }

//   // ── FIXED: Hint ──────────────────────────────────────────

//   const handleHintUsed = (result: HintResult) => {
//     setCoins(result.new_coin_balance)

//     // ❗ PRD: reset bonus counter ONLY
//     setStreakBonusCounter(0)
//   }

//   const handleNextProblem = useCallback(() => {
//     setCurrentIdx(i => (i + 1) % problems.length)
//   }, [problems])

//   if (loading) return <div>Loading...</div>

//   const problem = problems[currentIdx]

//   return (
//     <div className="min-h-screen flex flex-col items-center pt-10">
//       <MathParticles />
//       <div className="flex justify-between w-full max-w-sm mb-4">
//         <CoinPill coins={coins} />
//         <StreakDots streak={streak} />
//       </div>

//       <ProblemCard
//         problem={problem}
//         sessionId="dev"
//         currentCoins={coins}
//         currentStreak={streak}
//         onCorrect={handleCorrect}
//         onInsight={handleInsight}
//         onHintUsed={handleHintUsed}
//         onNextProblem={handleNextProblem}
//       />
//     </div>
//   )
// }


// "use client";

// import { useRouter } from "next/navigation";
// import { useUser } from "@/lib/hooks/useUser";

// export default function GamePage() {
//   const { user, loading } = useUser();
//   const router = useRouter();

//   if (loading) {
//     return (
//       <div className="min-h-screen flex flex-col items-center justify-center bg-primary">
//         <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin" />
//         <p className="mt-4 text-white/60 animate-fade-in">
//           Loading your adventure...
//         </p>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-primary flex items-center justify-center px-6">

//       {/* Main Card */}
//       <div className="w-full max-w-md text-center animate-fade-up">

//         {/* Title */}
//         <h1 className="text-4xl font-display font-extrabold text-gold animate-title-reveal">
//           Welcome to MathQuest 🎮
//         </h1>

//         {/* Subtitle */}
//         <p className="mt-3 text-white/60 text-sm">
//           Your journey of logic and adventure begins here
//         </p>

//         {/* User Card */}
//         <div className="mt-8 bg-white/5 border border-white/10 rounded-xl p-5 backdrop-blur-md animate-fade-slide-up">

//           <p className="text-white/60 text-xs uppercase tracking-widest">
//             Player Profile
//           </p>

//           <h2 className="mt-2 text-lg font-bold text-white">
//             {user?.email || "Guest Player"}
//           </h2>

//           <p className="text-white/40 text-sm mt-1">
//             {user?.email ? "Ready to play" : "Login to save progress"}
//           </p>

//         </div>

//         {/* Stats / Info (optional feel) */}
//         <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
//           <div className="bg-white/5 rounded-lg p-3 border border-white/10">
//             <p className="text-white/40">Level</p>
//             <p className="text-gold font-bold">1</p>
//           </div>

//           <div className="bg-white/5 rounded-lg p-3 border border-white/10">
//             <p className="text-white/40">Zone</p>
//             <p className="text-teal font-bold">1</p>
//           </div>
//         </div>

//         {/* Start Button */}
//         <button
//           disabled={!user}
//           onClick={() => router.push("/game/zone/1")}
//           className="mt-8 w-full btn-gold animate-glow-pulse disabled:opacity-40 disabled:cursor-not-allowed"
//         >
//           ▶ Start Adventure
//         </button>

//         {/* Hint */}
//         {!user && (
//           <p className="mt-3 text-xs text-white/40">
//             You need to login to start playing
//           </p>
//         )}

//       </div>
//     </div>
//   );
// }

"use client";

/**
 * MathQuest · Welcome Page  (src/app/page.tsx)
 *
 * LAYOUT STRATEGY
 * ─────────────────────────────────────────────────────────────
 *  Mobile  (<768px)  : single column, full-width stack
 *  Tablet  (768px+)  : two-column — hero/profile left, zone grid right
 *  Desktop (1024px+) : same two-column, wider max-width
 *
 * ZONE UNLOCK RULE
 *   zone.id <= currentZone  →  unlocked & selectable
 *   zone.id >  currentZone  →  locked, dimmed, unclickable
 *
 * ZONE NAVIGATION  →  /game/zone/[zoneId]  (dynamic route)
 *   ✅ Semantic, bookmarkable, server-readable, zero extra deps
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/hooks/useUser";
import { useChildProfile } from "@/lib/hooks/useChildProfile";
import MathParticles from "@/components/phaser/MathParticles";
import { LogoutButton } from "@/components/game/LogoutModal";
import { SettingsButton } from "@/components/game/SettingsModal";
import { StoryButton } from "@/components/game/StoryModal";
import { AudioControls, loadAudioSettings, AUDIO_EVENT, type AudioSettings } from "@/components/game/AudioControlModal";


// ─── Types ────────────────────────────────────────────────────────────────────

interface ZoneInfo {
  id: number;
  name: string;
  tagline: string;
  emoji: string;
  boss: string;
  activeBorder: string;
  activeBg: string;
  activeGlow: string;
  activeText: string;
  badgeBg: string;
  difficulty: string;
  difficultyStars: number;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const ZONES: ZoneInfo[] = [
  {
    id: 1,
    name: "Pebble Shore",
    tagline: "Arithmetic through 20",
    emoji: "🌊",
    boss: "Tidal Sentinel",
    activeBorder: "border-teal",
    activeBg: "bg-teal/10",
    activeGlow: "shadow-[0_0_40px_rgba(45,212,191,0.4)]",
    activeText: "text-teal",
    badgeBg: "bg-teal/20 text-teal border-teal/30",
    difficulty: "Beginner",
    difficultyStars: 1,
  },
  {
    id: 2,
    name: "Echo Caves",
    tagline: "Multiplication 1–9",
    emoji: "🔮",
    boss: "Cave Resonator",
    activeBorder: "border-violet",
    activeBg: "bg-violet/10",
    activeGlow: "shadow-[0_0_40px_rgba(124,58,237,0.45)]",
    activeText: "text-violet",
    badgeBg: "bg-violet/20 text-violet border-violet/30",
    difficulty: "Explorer",
    difficultyStars: 2,
  },
  {
    id: 3,
    name: "Iron Summit",
    tagline: "Multiplication 10–12",
    emoji: "⛰️",
    boss: "Granite Colossus",
    activeBorder: "border-coral",
    activeBg: "bg-coral/10",
    activeGlow: "shadow-[0_0_40px_rgba(249,115,22,0.45)]",
    activeText: "text-coral",
    badgeBg: "bg-coral/20 text-coral border-coral/30",
    difficulty: "Champion",
    difficultyStars: 3,
  },
  {
    id: 4,
    name: "Iron Summit",
    tagline: "Multiplication 10–12",
    emoji: "⛰️",
    boss: "Granite Colossus",
    activeBorder: "border-coral",
    activeBg: "bg-coral/10",
    activeGlow: "shadow-[0_0_40px_rgba(249,115,22,0.45)]",
    activeText: "text-coral",
    badgeBg: "bg-coral/20 text-coral border-coral/30",
    difficulty: "Champion",
    difficultyStars: 4,
  },
  {
    id: 5,
    name: "Iron Summit",
    tagline: "Multiplication 10–12",
    emoji: "⛰️",
    boss: "Granite Colossus",
    activeBorder: "border-coral",
    activeBg: "bg-coral/10",
    activeGlow: "shadow-[0_0_40px_rgba(249,115,22,0.45)]",
    activeText: "text-coral",
    badgeBg: "bg-coral/20 text-coral border-coral/30",
    difficulty: "Champion",
    difficultyStars: 3,
  },
];

// ─── Animated coin count-up ───────────────────────────────────────────────────

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const steps = 45;
    const increment = target / steps;
    const interval = duration / steps;
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) { setValue(target); clearInterval(timer); }
      else setValue(Math.floor(start));
    }, interval);
    return () => clearInterval(timer);
  }, [target, duration]);
  return value;
}

// ─── Stat trophy card ─────────────────────────────────────────────────────────
// Shows an emoji icon, a big animated number and a label

function StatCard({
  icon,
  value,
  label,
  colorClass,
  borderClass,
  bgClass,
  animDelay,
}: {
  icon: string;
  value: string | number;
  label: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  animDelay: string;
}) {
  return (
    
    <div
      style={{ animationDelay: animDelay }}
      className={[
        "flex flex-col items-center justify-center gap-1",
        "rounded-xl border-2 py-4 px-3",
        "animate-fade-slide-up opacity-0 [animation-fill-mode:forwards]",
        "transition-transform duration-200 hover:-translate-y-1",
        bgClass,
        borderClass,
      ].join(" ")}
    >
      
      <span className="text-2xl md:text-3xl leading-none">{icon}</span>
      <span className={`font-display font-black text-xl md:text-2xl tabular-nums leading-none ${colorClass}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="text-white/40 text-[10px] md:text-xs font-body uppercase tracking-widest text-center">
        {label}
      </span>
    </div>
  );
}

// ─── Difficulty stars ─────────────────────────────────────────────────────────

function DifficultyStars({ count, colorClass }: { count: number; colorClass: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Difficulty: ${count} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`text-xs transition-all duration-200 ${i <= count ? colorClass : "text-white/15"
            }`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

// ─── Zone card ────────────────────────────────────────────────────────────────

function ZoneCard({
  zone,
  isUnlocked,
  isActive,
  isCurrent,
  onSelect,
  disabled,
  animDelay,
}: {
  zone: ZoneInfo;
  isUnlocked: boolean;
  isActive: boolean;
  isCurrent: boolean;
  onSelect: () => void;
  disabled: boolean;
  animDelay: string;
}) {
  const isClickable = isUnlocked && !disabled;

  return (
    <button
    
      onClick={onSelect}
      disabled={!isClickable}
      // aria-pressed={isActive}
      aria-current={isActive ? "page" : undefined}
      aria-label={`Zone ${zone.id}: ${zone.name}. ${zone.tagline}.${!isUnlocked ? " Locked." : ""}`}
      style={{ animationDelay: animDelay }}
      className={[
        // Layout
        "group relative flex flex-col items-center gap-2 text-center",
        "rounded-xl border-2 p-4 md:p-5",
        // Entrance animation
        "animate-fade-slide-up opacity-0 [animation-fill-mode:forwards]",
        // Interaction
        "transition-all duration-200",
        // State: active
        isActive ? `${zone.activeBorder} ${zone.activeBg} ${zone.activeGlow}` : "border-white/10 bg-navy-mid",
        // Hover (only when clickable)
        isClickable && !isActive ? "hover:border-white/30 hover:bg-navy-light hover:-translate-y-1.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.6)]" : "",
        isClickable && isActive ? "hover:-translate-y-1.5" : "",
        isClickable ? "active:scale-95 cursor-pointer" : "",
        // Locked state
        !isClickable ? "opacity-35 cursor-not-allowed grayscale-[60%]" : "",
      ].filter(Boolean).join(" ")}
    >
      {/* "Current zone" ribbon */}
      {isCurrent && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gold text-primary text-[9px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full whitespace-nowrap shadow-lg">
          ⚡ Current
        </span>
      )}

      {/* Active checkmark */}
      {isActive && (
        <span
          aria-hidden="true"
          className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white ${zone.activeBg.replace("/10", "").replace("bg-", "bg-")
            } border ${zone.activeBorder}`}
        >
          ✓
        </span>
      )}

      {/* Lock overlay */}
      {!isUnlocked && (
        <span className="absolute inset-0 flex items-center justify-center text-3xl" aria-hidden="true">
          🔒
        </span>
      )}

      {/* Zone emoji — bigger on tablet */}
      <span
        className={`text-3xl md:text-4xl leading-none transition-transform duration-200 ${isClickable ? "group-hover:scale-110" : ""} ${!isUnlocked ? "opacity-0" : ""}`}
        aria-hidden="true"
      >
        {zone.emoji}
      </span>

      {/* Zone number */}
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 font-body">
        Zone {zone.id}
      </span>

      {/* Zone name */}
      <span className={`font-display font-black text-sm md:text-base leading-tight ${isActive ? zone.activeText : "text-white"}`}>
        {zone.name}
      </span>

      {/* Tagline */}
      <span className="text-[11px] md:text-xs text-white/40 font-body leading-tight">
        {zone.tagline}
      </span>

      {/* Stars + difficulty label */}
      {isUnlocked && (
        <div className="flex flex-col items-center gap-1 mt-1">
          <DifficultyStars count={zone.difficultyStars} colorClass={zone.activeText} />
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${zone.badgeBg}`}>
            {zone.difficulty}
          </span>
        </div>
      )}

      {/* Boss teaser — visible on tablet+ when active */}
      {isUnlocked && isActive && (
        <span className="hidden md:block text-[10px] text-white/30 font-body mt-1 italic">
          Boss: {zone.boss}
        </span>
      )}
    </button>
  );
}

// ─── Floating particle (stable positions — no hydration mismatch) ─────────────

const PARTICLES = [
  { w: 7, top: "8%", left: "6%", dur: "5.5s", del: "0s" },
  { w: 4, top: "22%", left: "91%", dur: "7s", del: "1.4s" },
  { w: 6, top: "58%", left: "3%", dur: "6.5s", del: ".7s" },
  { w: 5, top: "80%", left: "94%", dur: "5s", del: "2.1s" },
  { w: 3, top: "44%", left: "97%", dur: "8s", del: ".3s" },
  { w: 8, top: "90%", left: "15%", dur: "6s", del: "1.9s" },
  { w: 4, top: "3%", left: "50%", dur: "7.5s", del: "1s" },
  { w: 5, top: "66%", left: "88%", dur: "6s", del: "2.8s" },
  { w: 3, top: "35%", left: "1%", dur: "9s", del: ".5s" },
];

// ─── Loading ──────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary gap-5" role="status" aria-live="polite">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-gold/15" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-gold animate-spin" />
        <span className="absolute inset-0 flex items-center justify-center text-2xl animate-float-logo" aria-hidden="true">🎮</span>
      </div>
      <p className="text-white/50 text-sm font-body animate-fade-in tracking-widest uppercase">
        Loading adventure…
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GamePage() {
  const { user, loading } = useUser();
  const { profile, loading: profileLoading } = useChildProfile();
  const router = useRouter();

  const coins = profile?.coins ?? 0;
  const streak = profile?.streak ?? 0;
  const storyChapters = 0;  // not yet in DB
  const stars = 0;           // not yet in DB
  const currentZone = profile?.currentZone ?? 1;

  const [selectedZone, setSelectedZone] = useState<number>(1);
  const [displayNameOverride, setDisplayNameOverride] = useState<string | null>(null);
  const animatedCoins = useCountUp(user ? coins : 0);
  const selectedZoneInfo = ZONES.find((z) => z.id === selectedZone)!;

  // Sync selectedZone once profile loads
  useEffect(() => {
    if (profile) setSelectedZone(profile.currentZone);
  }, [profile]);

  // ── Background music ───────────────────────────────────────────────────────
  // Plays bg_main on loop at low volume. Respects the audio settings from
  // AudioControlModal (localStorage + live mq:audioSettings events).
  const bgRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = new Audio('/audio/music/bg_main.mp3');
    audio.loop   = true;
    audio.volume = 0.20;
    bgRef.current = audio;

    const { musicMuted } = loadAudioSettings();
    if (!musicMuted) {
      audio.play().catch(() => {
        // Autoplay blocked — start on first page interaction instead
        const unlock = () => { audio.play().catch(() => {}); };
        document.addEventListener('click', unlock, { once: true });
        document.addEventListener('keydown', unlock, { once: true });
      });
    }

    const onSettings = (e: Event) => {
      const { musicMuted: muted } = (e as CustomEvent<AudioSettings>).detail;
      if (muted) audio.pause();
      else audio.play().catch(() => {});
    };
    window.addEventListener(AUDIO_EVENT, onSettings);

    return () => {
      audio.pause();
      audio.src = '';
      window.removeEventListener(AUDIO_EVENT, onSettings);
    };
  }, []);

  const handleStart = () => router.push(`/game/zone/${selectedZone}`);

  if (loading || profileLoading) return <LoadingScreen />;

  return (
    <div className="relative min-h-screen bg-primary overflow-hidden flex items-center justify-center px-4 py-10 md:py-14 lg:px-8">
      {/* ── Floating action buttons ──────────────────────────────────────── */}
      <div className="fixed top-4 left-4 z-40">
        <SettingsButton
          initialName={displayNameOverride ?? profile?.displayName}
          onSaved={setDisplayNameOverride}
        />
      </div>
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <AudioControls />
        <StoryButton />
        <LogoutButton />
      </div>

      <MathParticles />
      {/* ── Background layers ─────────────────────────────────────────── */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Star-dot texture */}
        <div
          className="absolute inset-0 opacity-30"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)", backgroundSize: "44px 44px" }}
        />
        {/* Ambient blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] rounded-full bg-gold/[0.05] blur-3xl animate-hero-glow" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[280px] rounded-full bg-teal/[0.05] blur-3xl animate-hero-glow [animation-delay:2s]" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] rounded-full bg-violet/[0.04] blur-3xl animate-hero-glow [animation-delay:4s]" />
        {/* Floating particles */}
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-gold/25 animate-float"
            style={{ width: p.w, height: p.w, top: p.top, left: p.left, animationDuration: p.dur, animationDelay: p.del }}
          />
        ))}
      </div>

      {/* ── Page wrapper — wider on tablet/desktop ─────────────────────── */}
      <div className="relative w-full max-w-lg md:max-w-3xl lg:max-w-5xl">

        {/* ═══ TWO-COLUMN GRID on tablet+ ════════════════════════════════ */}
        {/* if you want to display on tablet like laptop set md:grid-cols-2  not lg:grid-cols-2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-start">

          {/* ── LEFT COLUMN: Hero + Player HUD ──────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* Hero */}
            <header className="text-center md:text-left animate-fade-up">
              {/* Orbit + emoji */}
              <div className="relative inline-flex items-center justify-center mb-4 md:mb-5">
                <div
                  aria-hidden="true"
                  className="absolute w-24 h-24 rounded-full border border-dashed border-gold/20 animate-spin-slow"
                />
                <div
                  aria-hidden="true"
                  className="absolute w-16 h-16 rounded-full border border-dotted border-teal/15 animate-spin-slow [animation-direction:reverse] [animation-duration:14s]"
                />
                <span className="relative text-5xl md:text-6xl animate-float-logo" aria-hidden="true">🎮</span>
              </div>

              <h1 className="font-display font-black text-gold leading-none tracking-tight animate-title-reveal"
                style={{ fontSize: "clamp(2.4rem, 6vw, 3.5rem)" }}>
                MathQuest
              </h1>

              <p className="mt-3 text-white/45 font-body tracking-wide animate-fade-in [animation-delay:0.5s] opacity-0 [animation-fill-mode:forwards]"
                style={{ fontSize: "clamp(0.7rem, 2vw, 0.875rem)" }}>
                Enter the Number Wilds · Solve · Discover · Conquer
              </p>

              {/* Decorative rule */}
              <div className="flex items-center gap-2 mt-4 mx-auto md:mx-0 w-44 animate-fade-in [animation-delay:0.7s] opacity-0 [animation-fill-mode:forwards]">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gold/40" />
                <span className="text-gold/55 text-sm">✦</span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gold/40" />
              </div>
            </header>

            {/* Player HUD card */}
            {/* <div
              className="bg-navy-mid border border-white/10 rounded-xl p-5 md:p-6 shadow-[0_6px_40px_rgba(0,0,0,0.55)] animate-fade-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:0.25s]"
              role="region"
              aria-label="Player profile"
            > */}
            <div
              className="bg-navy-mid border border-white/10 rounded-xl p-5 md:p-6 shadow-[0_6px_40px_rgba(0,0,0,0.55)] animate-fade-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:0.25s] md:col-span-2"
              role="region"
              aria-label="Player profile"
            >
              {/* Avatar row */}
              <div className="flex items-center gap-4 mb-5">
                <div className="relative w-14 h-14 md:w-16 md:h-16 flex-shrink-0">
                  <div className="absolute inset-0 rounded-full border-2 border-gold/40 animate-pulse-ring" />
                  <div className="w-full h-full rounded-full bg-gold/14 border-2 border-gold/35 flex items-center justify-center">
                    <span className="font-display font-black text-gold text-lg md:text-xl">
                      {(displayNameOverride ?? profile?.displayName)
                        ? (displayNameOverride ?? profile!.displayName).slice(0, 2).toUpperCase()
                        : "👤"}
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-white text-base md:text-lg leading-tight truncate">
                      {displayNameOverride ?? profile?.displayName ?? user?.email ?? "Guest Adventurer"}
                    </p>
                    {user && (
                      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-game-green shadow-[0_0_7px_rgba(34,197,94,0.9)]" aria-label="Online" />
                    )}
                  </div>
                  <p className="text-white/40 text-xs md:text-sm mt-1 font-body">
                    {profile
                      ? `Wanderer · Zone ${currentZone} reached`
                      : "Log in to save your progress"}
                  </p>
                </div>
              </div>

              {/* ── Trophy stat shelf ─────────────────────────────────── */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  icon="💰"
                  value={animatedCoins}
                  label="Coins"
                  colorClass="text-gold"
                  borderClass="border-gold/25"
                  bgClass="bg-gold/8"
                  animDelay="0.4s"
                />
                <StatCard
                  icon="📖"
                  value={storyChapters}
                  label="Stories"
                  colorClass="text-teal"
                  borderClass="border-teal/25"
                  bgClass="bg-teal/8"
                  animDelay="0.5s"
                />
                <StatCard
                  icon="⭐"
                  value={stars}
                  label="Stars"
                  colorClass="text-violet"
                  borderClass="border-violet/25"
                  bgClass="bg-violet/8"
                  animDelay="0.6s"
                />
              </div>

              {/* Streak bar — full width under the grid */}
              <div
                className="mt-3 flex items-center justify-between bg-coral/8 border border-coral/20 rounded-lg px-4 py-3 animate-fade-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:0.65s]"
                aria-label={`Current streak: ${streak}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none" aria-hidden="true">🔥</span>
                  <div>
                    <p className="font-display font-black text-coral text-lg leading-none tabular-nums">
                      {streak}
                    </p>
                    <p className="text-white/35 text-[10px] uppercase tracking-widest font-body">
                      Streak
                    </p>
                  </div>
                </div>
                {/* Streak milestone dots */}
                <div className="flex flex-col items-end gap-1">
                  <div className="flex gap-1.5" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`block w-2 h-2 rounded-full transition-all duration-300 ${i <= streak % 6
                            ? streak >= 3 ? "bg-gold scale-110 shadow-[0_0_5px_rgba(232,184,75,0.8)]" : "bg-coral"
                            : "bg-white/15"
                          }`}
                      />
                    ))}
                  </div>
                  <p className="text-white/25 text-[9px] font-body">
                    {streak >= 3 ? "🏆 Bonus active!" : `${3 - streak} more for bonus`}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* ── RIGHT COLUMN: Zone selector + CTA ───────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* Section header */}
            <div className="flex items-center justify-between animate-fade-in lg:mt-40 [animation-delay:0.3s] opacity-0 [animation-fill-mode:forwards]">
              <div>
                <p className="font-display font-black text-white text-lg md:text-xl">
                  Choose Your Zone
                </p>
                <p className="text-white/35 text-xs font-body mt-0.5">
                  {ZONES.filter((z) => z.id <= currentZone).length} of {ZONES.length} portals open
                </p>
              </div>
              <span className="text-3xl animate-float-logo [animation-delay:1s]" aria-hidden="true">🗺️</span>
            </div>

            {/* Zone cards — stack on mobile, 1-col on tablet (full width) */}
            {/* <div
              className="grid grid-cols-3 md:grid-cols-1 gap-3 md:gap-4"
              role="group"
              aria-labelledby="zone-label"
            >
              {ZONES.map((zone, i) => (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  isUnlocked={zone.id <= currentZone}
                  isActive={selectedZone === zone.id}
                  isCurrent={zone.id === currentZone}
                  onSelect={() => setSelectedZone(zone.id)}
                  disabled={!user}
                  animDelay={`${0.4 + i * 0.12}s`}
                />
              ))}
            </div> */}
            <div className="relative w-full py-6" role="group" aria-labelledby="zone-label">
  
  {/* Connection Line */}
  <div className="absolute top-1/2 left-4 right-4 h-[2px] bg-white/10 -translate-y-1/2" />

  {/* Zones */}
  <div className="relative flex items-center justify-between px-2">
    {ZONES.map((zone, i) => {
      const isUnlocked = zone.id <= currentZone;
      const isActive = selectedZone === zone.id;
      const isCurrent = zone.id === currentZone;

      return (
        <button
          key={zone.id}
          onClick={() => setSelectedZone(zone.id)}
          disabled={!isUnlocked || !user}
          aria-label={`Zone ${zone.id}: ${zone.name}`}
          className={`
            relative flex flex-col items-center gap-1
            transition-all duration-300
            ${isActive ? "scale-110" : "hover:scale-105"}
            ${!isUnlocked ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
          `}
          style={{ animationDelay: `${0.4 + i * 0.12}s` }}
        >
          {/* Current Badge */}
          {isCurrent && (
            <span className="absolute -top-4 text-[9px] bg-gold text-primary px-2 py-0.5 rounded-full font-bold">
              ⚡current
            </span>
          )}

          {/* Node Circle */}
          <div
            className={`
              w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center
              border-2 text-xl md:text-2xl
              transition-all duration-300
              ${
                isActive
                  ? `${zone.activeBg} ${zone.activeBorder} ${zone.activeGlow} scale-105`
                  : "bg-navy-mid border-white/20"
              }
            `}
          >
            {isUnlocked ? zone.emoji : "🔒"}
          </div>

          {/* Zone Label */}
          <span className="text-[10px] md:text-xs text-white/60 font-body text-center leading-tight">
            {zone.name}
          </span>
        </button>
      );
    })}
  </div>
</div>

            {/* ── Destination preview ─────────────────────────────────── */}
            {user && selectedZoneInfo && (
              <div
                className={`flex items-center gap-4 rounded-xl border-2 px-5 py-4 transition-all duration-300 animate-fade-in ${selectedZoneInfo.activeBorder} ${selectedZoneInfo.activeBg} ${selectedZoneInfo.activeGlow}`}
                aria-live="polite"
              >
                <span className="text-3xl leading-none flex-shrink-0" aria-hidden="true">{selectedZoneInfo.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-display font-black text-base leading-tight ${selectedZoneInfo.activeText}`}>
                    {selectedZoneInfo.name}
                  </p>
                  <p className="text-white/40 text-xs font-body mt-0.5">{selectedZoneInfo.tagline}</p>
                  <p className="text-white/25 text-[10px] font-body mt-0.5 italic">Boss: {selectedZoneInfo.boss}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <DifficultyStars count={selectedZoneInfo.difficultyStars} colorClass={selectedZoneInfo.activeText} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${selectedZoneInfo.badgeBg}`}>
                    {selectedZoneInfo.difficulty}
                  </span>
                </div>
              </div>
            )}

            {/* ── Start button ─────────────────────────────────────────── */}
            <div className="animate-fade-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:0.75s]">
              <button
                disabled={!user}
                onClick={handleStart}
                className="btn-gold animate-glow-pulse disabled:opacity-30 disabled:cursor-not-allowed text-lg md:text-xl"
                aria-label={`Start adventure in Zone ${selectedZone}: ${selectedZoneInfo?.name}`}
              >
                ▶ Start Adventure
              </button>
            </div>

            {/* Guest nudge */}
            {!user && (
              <p className="text-center text-xs text-white/35 font-body -mt-2 animate-fade-in">
                <a href="/login" className="text-gold font-bold hover:underline">Log in</a>
                {" "}to save coins, stars & progress
              </p>
            )}

          </div>
          {/* end right column */}

        </div>
        {/* end grid */}

      </div>
    </div>
  );
}