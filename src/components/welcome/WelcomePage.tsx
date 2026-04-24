"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const MathParticles = dynamic(
  () => import("@/components/phaser/MathParticles"),
  { ssr: false }
);

// ── Animated counter hook ─────────────────────────────────────────────────
function useCounter(target: number, duration: number, start: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return value;
}

// ── Wanderer SVG mark — larger hero version ───────────────────────────────
function HeroMark() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <path
        d="M40 4 L74 22 L74 58 L40 76 L6 58 L6 22 Z"
        stroke="#E8B84B" strokeWidth="1.5"
        fill="rgba(232,184,75,0.06)"
      />
      <path
        d="M40 16 L60 40 L40 64 L20 40 Z"
        stroke="#2DD4BF" strokeWidth="1"
        fill="rgba(45,212,191,0.08)"
      />
      <path
        d="M40 28 L52 40 L40 52 L28 40 Z"
        stroke="#7C3AED" strokeWidth="1"
        fill="rgba(124,58,237,0.12)"
      />
      <circle cx="40" cy="40" r="6" fill="#E8B84B" />
      <circle cx="40" cy="16" r="2.5" fill="#E8B84B" opacity="0.7" />
      <circle cx="60" cy="40" r="2.5" fill="#2DD4BF" opacity="0.7" />
      <circle cx="40" cy="64" r="2.5" fill="#E8B84B" opacity="0.7" />
      <circle cx="20" cy="40" r="2.5" fill="#7C3AED" opacity="0.7" />
      {/* Orbit dots */}
      <circle cx="62" cy="22" r="1.5" fill="#E8B84B" opacity="0.4" />
      <circle cx="62" cy="58" r="1.5" fill="#F97316" opacity="0.4" />
      <circle cx="18" cy="22" r="1.5" fill="#2DD4BF" opacity="0.4" />
      <circle cx="18" cy="58" r="1.5" fill="#7C3AED" opacity="0.4" />
    </svg>
  );
}

// ── Zone card ─────────────────────────────────────────────────────────────
interface ZoneCardProps {
  number: string;
  name: string;
  description: string;
  color: string;
  glowColor: string;
  borderColor: string;
  tricks: string;
  boss: string;
  delay: string;
  visible: boolean;
}

function ZoneCard({
  number, name, description, color, glowColor,
  borderColor, tricks, boss, delay, visible,
}: ZoneCardProps) {
  return (
    <div
      className="relative rounded-xl p-5 md:p-6 border transition-all duration-700 group cursor-default"
      style={{
        background: "linear-gradient(135deg, rgba(37,37,71,0.9) 0%, rgba(26,26,46,0.95) 100%)",
        borderColor,
        boxShadow: `0 0 0 0 ${glowColor}`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transitionDelay: delay,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 32px ${glowColor}`;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 0 ${glowColor}`;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {/* Zone number badge */}
      <div
        className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-display font-black mb-3"
        style={{ background: color, color: "#1A1A2E" }}
      >
        {number}
      </div>

      <h3 className="font-display font-bold text-white text-base md:text-lg mb-1">
        {name}
      </h3>
      <p className="text-white/40 text-xs md:text-sm font-body leading-relaxed mb-3">
        {description}
      </p>

      <div className="flex flex-wrap gap-2">
        <span
          className="text-[10px] font-body px-2 py-0.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
        >
          {tricks}
        </span>
        <span
          className="text-[10px] font-body px-2 py-0.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
        >
          Boss: {boss}
        </span>
      </div>
    </div>
  );
}

// ── Stat counter block ────────────────────────────────────────────────────
function StatBlock({
  target, suffix, label, color, start,
}: {
  target: number; suffix: string; label: string; color: string; start: boolean;
}) {
  const value = useCounter(target, 1800, start);
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="font-display font-black text-3xl md:text-4xl lg:text-5xl tabular-nums"
        style={{ color }}
      >
        {value}{suffix}
      </span>
      <span className="text-white/30 text-xs font-body uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

// ── Floating math badge ───────────────────────────────────────────────────
function FloatingBadge({
  symbol, x, y, color, animDelay, size,
}: {
  symbol: string; x: string; y: string;
  color: string; animDelay: string; size: string;
}) {
  return (
    <div
      className="absolute select-none pointer-events-none font-display font-black opacity-20"
      style={{
        left: x, top: y, color,
        fontSize: size,
        animation: `floatBadge 6s ease-in-out infinite`,
        animationDelay: animDelay,
      }}
    >
      {symbol}
    </div>
  );
}

// ── Trick preview pills ───────────────────────────────────────────────────
const TRICKS = [
  { label: "×11 Digit-Sum", color: "#E8B84B" },
  { label: "×9 Complement", color: "#2DD4BF" },
  { label: "Near-Doubles",  color: "#7C3AED" },
  { label: "Chunking",      color: "#F97316" },
  { label: "Mod Arithmetic",color: "#22C55E" },
  { label: "Triangular Nos",color: "#E8B84B" },
  { label: "Diff of Squares",color: "#2DD4BF" },
  { label: "×25 via 100/4", color: "#7C3AED" },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function WelcomePage() {
  const [visible, setVisible]       = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  // Staggered entrance
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Trigger counters when stats section scrolls into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* ── Global keyframes injected once ──────────────────────────────── */}
      <style>{`
        @keyframes floatBadge {
          0%, 100% { transform: translateY(0px) rotate(-3deg); }
          50%       { transform: translateY(-18px) rotate(3deg); }
        }
        @keyframes heroGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.08); }
        }
        @keyframes titleReveal {
          0%   { opacity: 0; transform: translateY(40px) skewY(2deg); }
          100% { opacity: 1; transform: translateY(0) skewY(0deg); }
        }
        @keyframes pulseRing {
          0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(232,184,75,0.5); }
          70%  { transform: scale(1);    box-shadow: 0 0 0 16px rgba(232,184,75,0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(232,184,75,0); }
        }
        @keyframes tickerMove {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes fadeSlideUp {
          0%   { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="relative min-h-screen w-full overflow-x-hidden"
        style={{ background: "radial-gradient(ellipse at 30% 10%, #252547 0%, #1A1A2E 45%, #0d0d1f 100%)" }}
      >
        {/* ── Noise texture ─────────────────────────────────────────────── */}
        <div className="noise-overlay" aria-hidden="true" />

        {/* ── Gold grid ─────────────────────────────────────────────────── */}
        <div
          className="fixed inset-0 z-0 pointer-events-none opacity-[0.035]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(232,184,75,1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(232,184,75,1) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
          aria-hidden="true"
        />

        {/* ── Corner glows ──────────────────────────────────────────────── */}
        <div className="fixed top-0 left-0 w-96 h-96 pointer-events-none opacity-25"
          style={{ background: "radial-gradient(circle at 0% 0%, rgba(45,212,191,0.6) 0%, transparent 60%)" }}
          aria-hidden="true" />
        <div className="fixed bottom-0 right-0 w-[600px] h-[600px] pointer-events-none opacity-20"
          style={{ background: "radial-gradient(circle at 100% 100%, rgba(124,58,237,0.5) 0%, transparent 60%)" }}
          aria-hidden="true" />
        <div className="fixed top-1/2 right-0 w-64 h-64 pointer-events-none opacity-15"
          style={{ background: "radial-gradient(circle at 100% 50%, rgba(249,115,22,0.4) 0%, transparent 60%)" }}
          aria-hidden="true" />

        {/* ── Phaser particles ──────────────────────────────────────────── */}
        <MathParticles />

        {/* ── Floating decorative math symbols ──────────────────────────── */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
          <FloatingBadge symbol="×" x="5%"  y="15%" color="#E8B84B" animDelay="0s"    size="4rem" />
          <FloatingBadge symbol="∑" x="88%" y="8%"  color="#2DD4BF" animDelay="1.2s"  size="3rem" />
          <FloatingBadge symbol="π" x="92%" y="40%" color="#7C3AED" animDelay="0.5s"  size="3.5rem" />
          <FloatingBadge symbol="√" x="3%"  y="55%" color="#F97316" animDelay="2s"    size="3rem" />
          <FloatingBadge symbol="∞" x="80%" y="72%" color="#E8B84B" animDelay="0.8s"  size="2.5rem" />
          <FloatingBadge symbol="?" x="10%" y="80%" color="#2DD4BF" animDelay="1.5s"  size="3rem" />
          <FloatingBadge symbol="²" x="50%" y="5%"  color="#22C55E" animDelay="2.5s"  size="2rem" />
          <FloatingBadge symbol="÷" x="45%" y="88%" color="#F97316" animDelay="0.3s"  size="2.5rem" />
        </div>

        {/* ════════════════════════════════════════════════════════════════
            HERO SECTION
        ════════════════════════════════════════════════════════════════ */}
        <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 pt-20 pb-16 text-center">

          {/* Top nav bar */}
          <nav
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 md:px-10 py-4"
            style={{
              background: "rgba(13,13,31,0.8)",
              backdropFilter: "blur(12px)",
              borderBottom: "1px solid rgba(232,184,75,0.08)",
            }}
          >
            <div className="flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
                <path d="M24 2 L44 13 L44 35 L24 46 L4 35 L4 13 Z" stroke="#E8B84B" strokeWidth="1.5" fill="rgba(232,184,75,0.08)" />
                <circle cx="24" cy="24" r="5" fill="#E8B84B" />
              </svg>
              <span className="font-display font-black text-white text-lg">
                Math<span className="text-gold">Quest</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-white/50 hover:text-white text-sm font-body transition-colors px-3 py-1.5"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="text-primary font-display font-bold text-sm px-4 py-2 rounded-md transition-all duration-200 hover:opacity-90 hover:-translate-y-px"
                style={{ background: "#E8B84B" }}
              >
                Play Free
              </Link>
            </div>
          </nav>

          {/* Hero glow orb behind logo */}
          <div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(232,184,75,0.12) 0%, transparent 70%)",
              animation: "heroGlow 4s ease-in-out infinite",
            }}
            aria-hidden="true"
          />

          {/* Logo mark */}
          <div
            className="mb-8 relative"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "scale(1)" : "scale(0.7)",
              transition: "all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {/* Spinning outer ring */}
            <div
              className="absolute inset-0 -m-4 rounded-full border border-gold/20"
              style={{ animation: "spinSlow 20s linear infinite" }}
              aria-hidden="true"
            />
            <HeroMark />
          </div>

          {/* EYEBROW */}
          <div
            className="mb-4 flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold/20"
            style={{
              background: "rgba(232,184,75,0.08)",
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.6s ease-out 0.2s",
            }}
          >
            <span className="text-gold text-xs">✦</span>
            <span className="text-gold/80 text-xs font-body uppercase tracking-widest">
              The Number Wilds Await
            </span>
            <span className="text-gold text-xs">✦</span>
          </div>

          {/* MAIN TITLE */}
          <div className="overflow-hidden mb-2">
            <h1
              className="font-display font-black leading-none tracking-tight"
              style={{
                fontSize: "clamp(3.5rem, 12vw, 9rem)",
                letterSpacing: "-0.04em",
                animation: visible ? "titleReveal 0.8s cubic-bezier(0.16,1,0.3,1) 0.3s both" : "none",
                background: "linear-gradient(135deg, #ffffff 0%, #E8B84B 40%, #ffffff 70%, #E8B84B 100%)",
                backgroundSize: "300% 300%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              MathQuest
            </h1>
          </div>

          {/* SUBTITLE */}
          <div
            className="mb-10 md:mb-12"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.7s ease-out 0.6s",
            }}
          >
            <p
              className="font-display font-bold text-white/70 max-w-xl mx-auto"
              style={{ fontSize: "clamp(1rem, 3vw, 1.5rem)" }}
            >
              Where{" "}
              <span className="text-teal">mathematical insight</span>{" "}
              is the only currency of power.
            </p>
            <p className="text-white/30 text-sm md:text-base font-body mt-2 max-w-md mx-auto">
              No shortcuts. No luck. Just the pure thrill of thinking faster,
              deeper, and more cleverly than anyone else.
            </p>
          </div>

          {/* CTA BUTTONS */}
          <div
            className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-16"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(20px)",
              transition: "all 0.7s ease-out 0.8s",
            }}
          >
            {/* Primary CTA */}
            <Link
              href="/signup"
              className="relative flex items-center gap-3 px-8 py-4 rounded-xl font-display font-black text-primary text-lg transition-all duration-200 hover:-translate-y-1 group"
              style={{
                background: "#E8B84B",
                animation: "pulseRing 2.5s ease-in-out infinite",
                minWidth: "220px",
                justifyContent: "center",
              }}
            >
              <span>Begin Your Quest</span>
              <span className="text-primary/60 group-hover:translate-x-1 transition-transform duration-200">→</span>
            </Link>

            {/* Secondary CTA */}
            <Link
              href="/login"
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-display font-semibold text-white/70 text-base border border-white/10 hover:border-white/30 hover:text-white transition-all duration-200 hover:-translate-y-px"
              style={{ background: "rgba(255,255,255,0.04)", minWidth: "180px", justifyContent: "center" }}
            >
              <span>I have an account</span>
            </Link>
          </div>

          {/* Scroll hint */}
          <div
            className="flex flex-col items-center gap-2"
            style={{
              opacity: visible ? 0.4 : 0,
              transition: "opacity 1s ease-out 1.5s",
            }}
          >
            <span className="text-white/40 text-xs font-body uppercase tracking-widest">
              Explore the world
            </span>
            <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent" />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            STATS TICKER BAND
        ════════════════════════════════════════════════════════════════ */}
        <div
          className="relative z-10 py-4 overflow-hidden border-y border-gold/10"
          style={{ background: "rgba(232,184,75,0.04)" }}
        >
          <div
            className="flex items-center gap-8 whitespace-nowrap"
            style={{ animation: "tickerMove 18s linear infinite", width: "max-content" }}
          >
            {[...Array(2)].map((_, repeatIdx) => (
              <div key={repeatIdx} className="flex items-center gap-8">
                {[
                  "⚡ Insight-Based Rewards",
                  "✦ 25 Mathematical Tricks",
                  "🗺 3 Epic Zones",
                  "👑 Boss Encounters",
                  "📖 Personalised Stories",
                  "🧠 No Brute Force — Only Thinking",
                  "⚡ Insight-Based Rewards",
                  "✦ 25 Mathematical Tricks",
                ].map((item, i) => (
                  <span key={i} className="text-gold/50 text-xs font-body uppercase tracking-widest">
                    {item}
                    <span className="ml-8 text-gold/20">◆</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            STATS SECTION
        ════════════════════════════════════════════════════════════════ */}
        <section
          ref={statsRef}
          className="relative z-10 py-16 md:py-24 px-4 sm:px-6 md:px-8"
        >
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 text-center">
            <StatBlock target={25}  suffix="" label="Math Tricks"    color="#E8B84B" start={statsVisible} />
            <StatBlock target={100} suffix="+" label="Problems"      color="#2DD4BF" start={statsVisible} />
            <StatBlock target={3}   suffix=""  label="Epic Zones"    color="#7C3AED" start={statsVisible} />
            <StatBlock target={5}   suffix=""  label="Boss Battles"  color="#F97316" start={statsVisible} />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            ZONES SECTION
        ════════════════════════════════════════════════════════════════ */}
        <section className="relative z-10 py-12 md:py-20 px-4 sm:px-6 md:px-8">
          <div className="max-w-5xl mx-auto">

            {/* Section header */}
            <div className="text-center mb-10 md:mb-14">
              <p className="text-gold/60 text-xs font-body uppercase tracking-widest mb-3">
                ✦ The World ✦
              </p>
              <h2
                className="font-display font-black text-white"
                style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.03em" }}
              >
                Explore the{" "}
                <span className="text-gold">Number Wilds</span>
              </h2>
              <p className="text-white/30 font-body mt-3 max-w-lg mx-auto text-sm md:text-base">
                Three zones, three bosses, twenty-five mathematical superpowers
                waiting to be discovered.
              </p>
            </div>

            {/* Zone cards — auto-animate on mount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              <ZoneCard
                number="1" name="Pebble Shore"
                description="Arithmetic through 20. Gentle terrain, first pattern shortcuts. The adventure begins here."
                color="#2DD4BF" glowColor="rgba(45,212,191,0.3)" borderColor="rgba(45,212,191,0.2)"
                tricks="Near-doubles · Chunking · Parity"
                boss="The Tidal Sentinel"
                delay="0.1s" visible={visible}
              />
              <ZoneCard
                number="2" name="Echo Caves"
                description="Multiplication tables 1–9. Mirror puzzles. Near-doubles and chunking unlock here."
                color="#7C3AED" glowColor="rgba(124,58,237,0.35)" borderColor="rgba(124,58,237,0.2)"
                tricks="×9 Complement · ×11 Rule · ×25 Trick"
                boss="The Cave Resonator"
                delay="0.2s" visible={visible}
              />
              <ZoneCard
                number="3" name="Iron Summit"
                description="Multi-step problems. Multiplication 10–12. Parity-based navigation puzzles."
                color="#F97316" glowColor="rgba(249,115,22,0.3)" borderColor="rgba(249,115,22,0.2)"
                tricks="Difference of Squares · Triangular Nos"
                boss="The Granite Colossus"
                delay="0.3s" visible={visible}
              />
            </div>

            {/* Coming soon zones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 md:mt-5">
              {[
                { n: "4", name: "The Fractured Expanse", desc: "Integer arithmetic, negative numbers, algebraic reasoning.", color: "rgba(255,255,255,0.06)" },
                { n: "5", name: "The Proof Labyrinth",   desc: "Modular arithmetic, combinatorics, geometric series. No ceiling.",  color: "rgba(255,255,255,0.06)" },
              ].map((z) => (
                <div
                  key={z.n}
                  className="rounded-xl p-5 border border-white/5 flex items-center gap-4"
                  style={{ background: z.color }}
                >
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-display font-black text-white/20 flex-shrink-0">
                    {z.n}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-white/30 text-sm">{z.name}</h3>
                    <p className="text-white/20 text-xs font-body mt-0.5">{z.desc}</p>
                  </div>
                  <span className="ml-auto text-[10px] font-body text-white/20 bg-white/5 px-2 py-1 rounded-full flex-shrink-0">
                    Phase 2
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            TRICKS SECTION
        ════════════════════════════════════════════════════════════════ */}
        <section className="relative z-10 py-12 md:py-20 px-4 sm:px-6 md:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-violet/70 text-xs font-body uppercase tracking-widest mb-3">
              ✦ The Power System ✦
            </p>
            <h2
              className="font-display font-black text-white mb-4"
              style={{ fontSize: "clamp(1.8rem, 4.5vw, 3rem)", letterSpacing: "-0.03em" }}
            >
              25 Tricks to{" "}
              <span style={{
                background: "linear-gradient(90deg, #7C3AED, #2DD4BF)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                Discover
              </span>
            </h2>
            <p className="text-white/30 font-body text-sm md:text-base max-w-md mx-auto mb-10">
              Each trick is a deeper view of the same mathematical structure.
              Discover them through play — never taught in a tutorial.
            </p>

            {/* Trick pills */}
            <div className="flex flex-wrap justify-center gap-2 md:gap-3">
              {TRICKS.map((trick, i) => (
                <div
                  key={trick.label}
                  className="px-3 py-2 rounded-full border text-xs font-body transition-all duration-300 hover:scale-105 cursor-default"
                  style={{
                    borderColor: `${trick.color}30`,
                    background: `${trick.color}10`,
                    color: trick.color,
                    animation: `fadeSlideUp 0.5s ease-out ${0.05 * i}s both`,
                  }}
                >
                  {trick.label}
                </div>
              ))}
              <div
                className="px-3 py-2 rounded-full border text-xs font-body text-white/20 border-white/10"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                + 17 more waiting…
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            FOR PARENTS SECTION
        ════════════════════════════════════════════════════════════════ */}
        <section className="relative z-10 py-12 md:py-20 px-4 sm:px-6 md:px-8">
          <div className="max-w-4xl mx-auto">
            <div
              className="rounded-2xl border border-gold/15 p-8 md:p-12 text-center relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(37,37,71,0.8) 0%, rgba(26,26,46,0.95) 100%)" }}
            >
              {/* Corner decoration */}
              <div
                className="absolute top-0 right-0 w-48 h-48 pointer-events-none"
                style={{ background: "radial-gradient(circle at 100% 0%, rgba(232,184,75,0.1) 0%, transparent 60%)" }}
                aria-hidden="true"
              />

              <p className="text-gold/60 text-xs font-body uppercase tracking-widest mb-3">
                ✦ For Parents ✦
              </p>
              <h2
                className="font-display font-black text-white mb-4"
                style={{ fontSize: "clamp(1.6rem, 4vw, 2.8rem)", letterSpacing: "-0.03em" }}
              >
                You set the world.{" "}
                <span className="text-gold">They explore it.</span>
              </h2>
              <p className="text-white/40 font-body text-sm md:text-base max-w-xl mx-auto mb-8">
                Full analytics dashboard, time limits, difficulty controls, personalised
                stories, and custom music. You stay in control — your child stays in flow.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { icon: "📊", label: "Analytics",    desc: "Insight-level reports" },
                  { icon: "⏱",  label: "Time Limits",  desc: "Daily & session caps" },
                  { icon: "📖", label: "Stories",      desc: "Upload or AI-generate" },
                  { icon: "🎵", label: "Custom Music", desc: "4 context mappings" },
                ].map((f) => (
                  <div key={f.label} className="flex flex-col items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <span className="text-2xl">{f.icon}</span>
                    <span className="text-white font-display font-bold text-sm">{f.label}</span>
                    <span className="text-white/30 text-xs font-body">{f.desc}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-display font-black text-primary text-base transition-all duration-200 hover:-translate-y-1 hover:opacity-90"
                style={{ background: "#E8B84B" }}
              >
                Create Parent Account
                <span>✦</span>
              </Link>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            FINAL CTA SECTION
        ════════════════════════════════════════════════════════════════ */}
        <section className="relative z-10 py-16 md:py-28 px-4 sm:px-6 md:px-8 text-center">
          <div className="max-w-3xl mx-auto">
            <p className="text-white/20 text-xs font-body uppercase tracking-widest mb-6">
              Ready to begin?
            </p>
            <h2
              className="font-display font-black text-white mb-6"
              style={{ fontSize: "clamp(2.5rem, 8vw, 6rem)", letterSpacing: "-0.04em", lineHeight: 1 }}
            >
              Math is your{" "}
              <span
                style={{
                  background: "linear-gradient(90deg, #E8B84B, #F97316, #E8B84B)",
                  backgroundSize: "200%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                superpower.
              </span>
            </h2>
            <p className="text-white/30 font-body text-sm md:text-base max-w-md mx-auto mb-10">
              Join the Number Wilds. Discover 25 hidden tricks. Defeat the bosses.
              Become the Wanderer.
            </p>

            <Link
              href="/signup"
              className="inline-flex items-center gap-3 px-10 py-5 rounded-xl font-display font-black text-primary text-xl transition-all duration-200 hover:opacity-90 hover:-translate-y-1"
              style={{
                background: "linear-gradient(135deg, #E8B84B 0%, #f0c55c 100%)",
                boxShadow: "0 16px 48px rgba(232,184,75,0.35)",
              }}
            >
              Start for Free
              <span className="text-primary/60">→</span>
            </Link>

            <p className="text-white/15 text-xs font-body mt-6">
              No payment required · Parent-controlled · Browser-based
            </p>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer
          className="relative z-10 py-8 px-4 sm:px-6 md:px-8 border-t border-white/5 text-center"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between max-w-4xl mx-auto gap-4">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
                <path d="M24 2 L44 13 L44 35 L24 46 L4 35 L4 13 Z" stroke="#E8B84B" strokeWidth="1.5" fill="rgba(232,184,75,0.08)" />
                <circle cx="24" cy="24" r="5" fill="#E8B84B" />
              </svg>
              <span className="font-display font-bold text-white/40 text-sm">
                MathQuest · Wadana AI
              </span>
            </div>
            <p className="text-white/20 text-xs font-body">
              Built for gifted children who deserve better than average math.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}