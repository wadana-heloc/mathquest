"use client";
// src/app/(auth)/signup/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// SIGNUP PAGE — wired to Supabase
//
// Changes from the fake version:
//   1. Calls signup() server action instead of setTimeout
//   2. Displays server-side error messages (email taken, etc.)
//   3. On success → redirects to /login?message=check-your-email
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useTransition } from "react";
import Link from "next/link";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import FormField from "@/components/auth/FormField";
import { signup } from "@/lib/auth/actions";

// ── Password strength indicator ───────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", pass: password.length >= 8 },
    { label: "Uppercase",     pass: /[A-Z]/.test(password) },
    { label: "Number",        pass: /\d/.test(password) },
    { label: "Symbol",        pass: /[^a-zA-Z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const strengthColor = ["", "bg-coral", "bg-gold", "bg-teal", "bg-game-green"][score] ?? "";

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={[
            "h-1 flex-1 rounded-full transition-all duration-300",
            i <= score ? strengthColor : "bg-white/10",
          ].join(" ")} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map((c) => (
          <span key={c.label} className={[
            "text-[11px] font-body transition-colors flex items-center gap-1",
            c.pass ? "text-game-green" : "text-white/25",
          ].join(" ")}>
            {c.pass ? "✓" : "○"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-md px-3 py-2.5 mb-5 border border-coral/30"
      style={{ background: "rgba(249,115,22,0.08)" }}
    >
      <span className="text-coral text-base flex-shrink-0">!</span>
      <p className="text-coral/80 text-xs sm:text-sm font-body leading-relaxed">
        {message}
      </p>
    </div>
  );
}

const FEATURES = [
  { icon: "⚡", text: "Insight-based rewards" },
  { icon: "🗺", text: "3 unlockable zones" },
  { icon: "✦",  text: "25 math tricks" },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SignUpPage() {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed]   = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  // ── Client-side validation ───────────────────────────────────────────────
  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim())
      errs.name = "Name is required.";
    if (!email.trim())
      errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Enter a valid email address.";
    if (!password)
      errs.password = "Password is required.";
    else if (password.length < 8)
      errs.password = "Password must be at least 8 characters.";
    if (!confirm)
      errs.confirm = "Please confirm your password.";
    else if (confirm !== password)
      errs.confirm = "Passwords do not match.";
    if (!agreed)
      errs.agreed = "You must agree to continue.";
    return errs;
  }

  // ── Submit handler ───────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    // Call the server action
    // On success → redirects to /login?message=check-your-email
    // On failure → returns { error }
    startTransition(async () => {
      const result = await signup(name, email, password);
      if (result?.error) {
        setServerError(result.error);
      }
    });
  }

  return (
    <AuthLayout>
      <AuthCard active="signup" animationClass="animate-slide-left">

        {/* Server error */}
        {serverError && <ErrorBanner message={serverError} />}

        {/* Feature chips */}
        <div className="flex gap-2 flex-wrap mb-6">
          {FEATURES.map((f) => (
            <div key={f.text}
              className="flex items-center gap-1.5 text-xs font-body text-white/50 rounded-full px-3 py-1.5"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4 md:space-y-5">

          {/* Name + Email — side by side on tablet+ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Your Name"
              type="text"
              placeholder="Parent / Guardian"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
              autoComplete="name"
              autoFocus
            />
            <FormField
              label="Email Address"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setServerError(null); }}
              error={fieldErrors.email}
              autoComplete="email"
            />
          </div>

          {/* Password + Confirm — side by side on tablet+ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FormField
                label="Create Password"
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
                autoComplete="new-password"
              />
              <PasswordStrength password={password} />
            </div>
            <FormField
              label="Confirm Password"
              type="password"
              placeholder="Repeat password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={fieldErrors.confirm}
              autoComplete="new-password"
            />
          </div>

          {/* Terms checkbox */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer group">
              <div
                onClick={() => setAgreed((v) => !v)}
                className={[
                  "mt-0.5 w-5 h-5 rounded flex-shrink-0 border flex items-center justify-center",
                  "transition-all duration-150 cursor-pointer",
                  agreed ? "bg-gold border-gold" : "border-white/20 group-hover:border-white/40",
                ].join(" ")}
                role="checkbox"
                aria-checked={agreed}
                tabIndex={0}
                onKeyDown={(e) => e.key === " " && setAgreed((v) => !v)}
              >
                {agreed && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                    <path d="M1 4L4 7L10 1" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="text-xs sm:text-sm font-body text-white/40 leading-relaxed">
                I confirm I am a parent or guardian. I have read the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold/70 hover:text-gold transition-colors underline underline-offset-2"
                >
                  Terms of Play
                </Link>
                .
              </span>
            </label>
            {fieldErrors.agreed && (
              <p className="field-error mt-1">{fieldErrors.agreed}</p>
            )}
          </div>

          {/* Parent role notice */}
          <div
            className="rounded-md px-3 py-2.5 flex items-start gap-2 border border-teal/20"
            style={{ background: "rgba(45,212,191,0.05)" }}
          >
            <span className="text-teal text-base mt-0.5 flex-shrink-0">ℹ</span>
            <p className="text-white/40 text-xs sm:text-sm font-body leading-relaxed">
              This creates a{" "}
              <span className="text-teal font-medium">parent account</span>. You
              will add your child&apos;s profile from the dashboard.
            </p>
          </div>

          <div className="pt-1">
            <button type="submit" disabled={isPending} className="btn-gold">
              {isPending ? (
                <>
                  <Spinner />
                  <span>Creating your account…</span>
                </>
              ) : (
                <>
                  <span>Begin the Adventure</span>
                  <span className="text-primary/70 text-lg">✦</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="auth-divider mt-6 md:mt-8">
          <span>already a wanderer?</span>
        </div>

        <p className="text-center text-white/40 text-sm font-body">
          <Link
            href="/login"
            className="text-gold font-medium hover:underline underline-offset-2 transition-colors"
          >
            Sign in to your account →
          </Link>
        </p>

      </AuthCard>
    </AuthLayout>
  );
}