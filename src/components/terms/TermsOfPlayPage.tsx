"use client";

import Link from "next/link";
import { useState } from "react";

// ── Data ──────────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: "who",
    number: "01",
    title: "Who These Terms Apply To",
    color: "text-teal",
    borderColor: "border-teal/30",
    friendly: "These terms cover everyone who uses MathQuest — parents who manage accounts, and children who play the game.",
    content: [
      {
        subtitle: "Parent Accounts",
        items: [
          "A parent or legal guardian must create the account.",
          "You must be 18 years or older to register.",
          "You are responsible for all activity under your account and your child's account.",
          "You confirm that any information you provide is accurate and current.",
        ],
      },
      {
        subtitle: "Child Accounts",
        items: [
          "Child accounts are created by and owned by the parent account.",
          "Children cannot self-register under any circumstance.",
          "Children aged 7–12 are the intended primary users.",
          "The parent-set difficulty ceiling, time limits, and content restrictions apply at all times.",
        ],
      },
    ],
  },
  {
    id: "what",
    number: "02",
    title: "What MathQuest Is (and Is Not)",
    color: "text-gold",
    borderColor: "border-gold/30",
    friendly: "MathQuest is a math adventure game — not a tutoring service, not a social platform, and not a place where children talk to AI.",
    content: [
      {
        subtitle: "What It Is",
        items: [
          "A browser-based, single-player math adventure game.",
          "A learning system designed for mathematically gifted children.",
          "A parent-controlled environment with analytics, time limits, and content approval.",
          "A platform where mathematical insight is the only path to progression.",
        ],
      },
      {
        subtitle: "What It Is Not",
        items: [
          "A replacement for school curriculum or professional tutoring.",
          "A social platform — no chat, messaging, or multiplayer features in MVP.",
          "A platform where children interact with AI directly — all AI output is parent-approved first.",
          "A platform with advertising, real-money purchases, or third-party integrations.",
        ],
      },
    ],
  },
  {
    id: "accounts",
    number: "03",
    title: "Accounts & Security",
    color: "text-violet",
    borderColor: "border-violet/30",
    friendly: "Your account is your responsibility. Keep credentials safe, and notify us if anything looks wrong.",
    content: [
      {
        subtitle: "Parent Responsibilities",
        items: [
          "Keep your login credentials secure and do not share them.",
          "Ensure your child's account credentials are not shared with others.",
          "Review AI-generated content before approving it for your child.",
          "Set appropriate difficulty ceilings, time limits, and content settings.",
        ],
      },
      {
        subtitle: "Account Termination",
        items: [
          "You may delete your account and all child accounts at any time from the parent dashboard.",
          "Wadana AI reserves the right to suspend accounts that violate these Terms.",
          "Suspension will be communicated via the email address on file.",
        ],
      },
    ],
  },
  {
    id: "coins",
    number: "04",
    title: "The Coin Economy & Rewards",
    color: "text-gold",
    borderColor: "border-gold/30",
    friendly: "Coins are earned by solving math problems. They have no real-world value and cannot be bought or sold.",
    content: [
      {
        subtitle: "Earning Coins",
        items: [
          "Coins are earned by solving math problems correctly.",
          "Faster, insight-based solutions earn more coins than brute-force solutions.",
          "Streaks and boss defeats award bonus coins.",
          "A daily coin cap of 300 coins applies per child account.",
        ],
      },
      {
        subtitle: "Spending Coins",
        items: [
          "Coins can be spent on in-game cosmetics, hints, and story chapter unlocks.",
          "Hint 2 costs 5 coins. Hint 3 costs 15 coins.",
          "Coin balances cannot go below zero. Purchases are blocked when insufficient.",
        ],
      },
      {
        subtitle: "Stars",
        items: [
          "Parents set a coin threshold to earn one star (default: 500 coins = 1 star).",
          "Stars have no value assigned by MathQuest. Their real-world meaning is entirely the parent's decision.",
          "There are no third-party integrations, no payment processing, and no real-money mechanics of any kind.",
        ],
      },
    ],
  },
  {
    id: "ai",
    number: "05",
    title: "AI-Generated Content",
    color: "text-teal",
    borderColor: "border-teal/30",
    friendly: "Children never talk to AI. All AI-generated stories are reviewed and approved by a parent before a child can read them.",
    content: [
      {
        subtitle: "Story Generation",
        items: [
          "Parents may request AI-generated stories — server-side only, using the Anthropic Claude API.",
          "Generated stories are held as 'pending' and invisible to children until a parent approves them.",
          "Parents may approve as-is, edit then approve, or reject generated content.",
          "A maximum of 2 AI story generation requests per 7-day rolling window applies.",
          "The AI system prompt is hardcoded server-side and cannot be modified by anyone.",
        ],
      },
      {
        subtitle: "Content Standards",
        items: [
          "The system prompt prohibits: violence, romantic content, political/religious content, brand names, copyrighted characters, and dangerous instructions.",
          "Despite these safeguards, the parent review gate is the final check before any content reaches a child.",
          "All AI generation events are logged with timestamp, input parameters, and approval status.",
        ],
      },
      {
        subtitle: "Parent Liability",
        items: [
          "By approving AI-generated content, the parent takes responsibility for its appropriateness.",
          "Wadana AI is not liable for content that a parent approves and a child subsequently reads.",
        ],
      },
    ],
  },
  {
    id: "privacy",
    number: "06",
    title: "Privacy & Data",
    color: "text-coral",
    borderColor: "border-coral/30",
    friendly: "We collect only what we need to run the game. We don't sell your data, show ads, or share anything with third parties.",
    content: [
      {
        subtitle: "Data We Collect",
        items: [
          "Parent: email address, hashed password, settings and preferences.",
          "Child: display name, game progress, problem attempts, session durations, coin balance, trick discoveries.",
          "Audio and story files uploaded by parents, stored in private Supabase Storage.",
        ],
      },
      {
        subtitle: "How We Use Data",
        items: [
          "Game progress and analytics are used to surface insights in the parent dashboard.",
          "We do not sell, share, or license any user data to third parties.",
          "We do not serve advertising of any kind.",
          "Analytics data is scoped per family — no cross-family data sharing.",
        ],
      },
      {
        subtitle: "Data Deletion",
        items: [
          "Parents may reset a child's progress at any time from the parent dashboard.",
          "Account deletion removes all associated data within 30 days.",
          "Session and attempt logs are retained for analytics during the account lifetime.",
        ],
      },
    ],
  },
  {
    id: "use",
    number: "07",
    title: "Acceptable Use",
    color: "text-violet",
    borderColor: "border-violet/30",
    friendly: "Play the game fairly. Don't try to cheat the math gate, extract answers, or misuse the platform.",
    content: [
      {
        subtitle: "You agree not to:",
        items: [
          "Attempt to circumvent server-side answer validation or game progression gates.",
          "Inspect or extract correct answers from network responses.",
          "Submit AI generation requests containing violent, sexual, or harmful content.",
          "Attempt to access another family's data.",
          "Reverse-engineer, decompile, or modify the application.",
          "Use the platform for any commercial purpose without written permission from Wadana AI.",
        ],
      },
    ],
  },
  {
    id: "time",
    number: "08",
    title: "Time Limits & Child Safety",
    color: "text-game-green",
    borderColor: "border-game-green/30",
    friendly: "Time limits are real and enforced on the server. Children cannot override them.",
    content: [
      {
        subtitle: "How time limits work",
        items: [
          "Daily and per-session time limits are enforced server-side and cannot be overridden by the child.",
          "Sessions never end mid-problem — the system always resolves to a stable state first.",
          "The game does not track physical location, device identifiers, or biometric data.",
          "All audio and story content is served via pre-signed, time-limited URLs (1-hour expiry).",
          "The correct answer to any math problem is never transmitted to the client. All validation is server-side.",
        ],
      },
    ],
  },
  {
    id: "ip",
    number: "09",
    title: "Intellectual Property",
    color: "text-gold",
    borderColor: "border-gold/30",
    friendly: "MathQuest's content belongs to Wadana AI. Content you upload belongs to you.",
    content: [
      {
        subtitle: "Ownership",
        items: [
          "All MathQuest content — zone design, boss concepts, trick taxonomy, problem bank, UI, and codebase — is the intellectual property of Wadana AI.",
          "You may not reproduce, distribute, or create derivative works without written permission.",
          "Audio files uploaded by parents remain the property of the uploader.",
          "By uploading audio or stories, you confirm you have the right to use that content.",
        ],
      },
    ],
  },
  {
    id: "disclaimers",
    number: "10",
    title: "Disclaimers & Limitations",
    color: "text-coral",
    borderColor: "border-coral/30",
    friendly: "MathQuest is provided as-is. We don't guarantee specific educational outcomes or that the service will always be error-free.",
    content: [
      {
        subtitle: "Educational Outcomes",
        items: [
          "MathQuest is designed to support mathematical insight development. We do not guarantee specific test score improvements or learning milestones.",
          "Results will vary based on individual children and usage patterns.",
        ],
      },
      {
        subtitle: "AI Content",
        items: [
          "AI-generated stories are produced by Anthropic Claude. While our system prompt enforces strict content standards, we cannot guarantee all AI output will be free of errors.",
          "The parent review gate exists precisely because of this limitation.",
        ],
      },
      {
        subtitle: "Limitation of Liability",
        items: [
          "Wadana AI shall not be liable for indirect, incidental, or consequential damages arising from your use of MathQuest.",
          "Our total liability shall not exceed the amount you paid to Wadana AI in the twelve months preceding any claim.",
        ],
      },
    ],
  },
];

// ── Section component ─────────────────────────────────────────────────────
function Section({
  number, title, color, borderColor, friendly, content, id,
}: (typeof SECTIONS)[0]) {
  const [open, setOpen] = useState(false);

  return (
    <div
      id={id}
      className={[
        "rounded-xl border transition-all duration-300",
        open ? borderColor : "border-white/5",
        "overflow-hidden",
      ].join(" ")}
      style={{
        background: open
          ? "linear-gradient(135deg, rgba(37,37,71,0.8) 0%, rgba(26,26,46,0.9) 100%)"
          : "rgba(255,255,255,0.03)",
      }}
    >
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-4 p-5 md:p-6 text-left group"
      >
        <span className={`font-display font-black text-sm mt-0.5 flex-shrink-0 ${color}`}>
          {number}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-white text-base md:text-lg leading-snug">
            {title}
          </h3>
          {!open && (
            <p className="text-white/30 text-xs font-body mt-1 leading-relaxed line-clamp-1">
              {friendly}
            </p>
          )}
        </div>
        <span className={[
          "flex-shrink-0 text-white/30 text-lg transition-transform duration-300 mt-0.5",
          open ? "rotate-45" : "",
        ].join(" ")}>
          +
        </span>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-5 md:px-6 pb-6">
          {/* Friendly summary */}
          <div
            className={`rounded-md px-4 py-3 mb-5 border ${borderColor}`}
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <p className="text-white/60 text-sm font-body leading-relaxed">
              <span className={`${color} font-semibold`}>In plain terms: </span>
              {friendly}
            </p>
          </div>

          {/* Legal detail */}
          {content.map((block) => (
            <div key={block.subtitle} className="mb-5 last:mb-0">
              <h4 className="text-white/50 text-xs font-body uppercase tracking-widest mb-3">
                {block.subtitle}
              </h4>
              <ul className="space-y-2">
                {block.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className={`${color} text-xs mt-1 flex-shrink-0`}>◆</span>
                    <span className="text-white/60 text-sm font-body leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TermsOfPlayPage() {
  return (
    <div
      className="relative min-h-screen w-full"
      style={{ background: "radial-gradient(ellipse at 30% 10%, #252547 0%, #1A1A2E 50%, #0d0d1f 100%)" }}
    >
      {/* Noise + grid */}
      <div className="noise-overlay" aria-hidden="true" />
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(rgba(232,184,75,1) 1px, transparent 1px), linear-gradient(90deg, rgba(232,184,75,1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
        aria-hidden="true"
      />

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 md:px-10 py-4 border-b border-gold/[0.08] backdrop-blur-md"
        style={{ background: "rgba(13,13,31,0.85)" }}
      >
        <Link href="/" className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
            <path d="M24 2 L44 13 L44 35 L24 46 L4 35 L4 13 Z" stroke="#E8B84B" strokeWidth="1.5" fill="rgba(232,184,75,0.08)" />
            <circle cx="24" cy="24" r="5" fill="#E8B84B" />
          </svg>
          <span className="font-display font-black text-white">
            Math<span className="text-gold">Quest</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <a
            href="/MathQuest_Terms_of_Play.docx"
            download
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-gold/30 text-gold text-xs font-body hover:bg-gold/10 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download .docx
          </a>
          <Link href="/signup" className="bg-gold text-primary font-display font-bold text-sm px-4 py-2 rounded-md hover:opacity-90 transition-opacity">
            Play Free
          </Link>
        </div>
      </nav>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 md:px-8 pt-28 pb-20">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/20 bg-gold/[0.06] mb-5">
            <span className="text-gold text-xs">✦</span>
            <span className="text-gold/70 text-xs font-body uppercase tracking-widest">Legal · v1.0 · 2025</span>
          </div>
          <h1
            className="font-display font-black text-white mb-4"
            style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", letterSpacing: "-0.03em" }}
          >
            Terms of <span className="text-gold">Play</span>
          </h1>
          <p className="text-white/40 font-body text-sm md:text-base max-w-lg mx-auto leading-relaxed">
            The rules of the Number Wilds. Plain language up front, legal
            detail underneath. Click any section to expand it.
          </p>
        </div>

        {/* Core promise box */}
        <div
          className="rounded-xl border border-teal/20 p-5 md:p-6 mb-10"
          style={{ background: "rgba(45,212,191,0.05)" }}
        >
          <div className="flex items-start gap-3">
            <span className="text-teal text-xl flex-shrink-0 mt-0.5">✦</span>
            <div>
              <p className="text-white font-display font-bold text-base mb-2">The short version</p>
              <p className="text-white/50 font-body text-sm leading-relaxed">
                MathQuest is a parent-controlled math adventure game. Parents manage accounts and
                approve all content. Children solve math to progress — there are no shortcuts.
                No ads, no real-money purchases, no third-party data sharing, and children never
                interact with AI directly.
              </p>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {SECTIONS.map((section) => (
            <Section key={section.id} {...section} />
          ))}
        </div>

        {/* Additional sections (non-accordion) */}
        <div className="mt-6 space-y-3">
          {/* Changes to terms */}
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-5 md:p-6">
            <div className="flex items-start gap-4">
              <span className="font-display font-black text-sm text-violet flex-shrink-0 mt-0.5">11</span>
              <div>
                <h3 className="font-display font-bold text-white text-base mb-2">Changes to These Terms</h3>
                <p className="text-white/40 text-sm font-body leading-relaxed">
                  Wadana AI may update these Terms at any time. Material changes will be communicated
                  via email at least 14 days before taking effect. Continued use of MathQuest after
                  the effective date constitutes acceptance.
                </p>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="rounded-xl border border-gold/15 p-5 md:p-6" style={{ background: "rgba(232,184,75,0.04)" }}>
            <div className="flex items-start gap-4">
              <span className="font-display font-black text-sm text-gold flex-shrink-0 mt-0.5">12</span>
              <div>
                <h3 className="font-display font-bold text-white text-base mb-2">Contact</h3>
                <p className="text-white/40 text-sm font-body leading-relaxed mb-3">
                  Questions about these Terms? Reach us at:
                </p>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-gold/50 text-xs font-body uppercase tracking-wider w-16">Email</span>
                    <span className="text-white/60 text-sm font-body">Hello@wadana.ai</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gold/50 text-xs font-body uppercase tracking-wider w-16">Product</span>
                    <span className="text-white/60 text-sm font-body">MathQuest by Wadana AI</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gold/50 text-xs font-body uppercase tracking-wider w-16">Effective</span>
                    <span className="text-white/60 text-sm font-body">2025</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Download CTA */}
        <div className="mt-10 text-center">
          <p className="text-white/20 text-xs font-body mb-4 uppercase tracking-widest">
            Want a copy for your records?
          </p>
          <a
            href="/MathQuest_Terms_of_Play.docx"
            download
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-gold/30 text-gold text-sm font-display font-semibold hover:bg-gold/10 transition-all duration-200 hover:-translate-y-px"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Terms of Play (.docx)
          </a>
        </div>

        {/* Footer line */}
        <div className="mt-16 pt-8 border-t border-white/5 text-center">
          <p className="text-white/15 text-xs font-body italic">
            Math is the gate to power. These Terms are the rules of the game.
          </p>
          <p className="text-white/10 text-xs font-body mt-2">
            MathQuest · Wadana AI · wadana.ai
          </p>
        </div>
      </main>
    </div>
  );
}