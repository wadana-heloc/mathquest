
import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import FormField from "@/components/auth/FormField";
import { login } from "@/lib/auth/actions";

// ── Sub-components ────────────────────────────────────────────────────────────

function InsightBadge() {
  return (
    <div
      className="flex items-center gap-2 rounded-md px-3 py-2.5 mb-6 border border-violet/30"
      style={{ background: "rgba(124,58,237,0.08)" }}
    >
      <span className="text-violet text-base flex-shrink-0">✦</span>
      <p className="text-white/50 text-xs sm:text-sm font-body leading-relaxed">
        <span className="text-violet font-medium">Insight:</span> Every gifted
        mind starts here. Math is your superpower.
      </p>
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

// ── Success banner (shown after signup redirect) ──────────────────────────────

function SuccessBanner({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-md px-3 py-2.5 mb-5 border border-teal/30"
      style={{ background: "rgba(45,212,191,0.08)" }}
    >
      <span className="text-teal text-base flex-shrink-0">✓</span>
      <p className="text-teal/80 text-xs sm:text-sm font-body leading-relaxed">
        {message}
      </p>
    </div>
  );
}

// ── Error banner (server-side auth error) ─────────────────────────────────────

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const searchParams = useSearchParams();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  // Read message from URL — e.g. /login?message=check-your-email
  const urlMessage = searchParams.get("message");
  const successMessage = urlMessage === "check-your-email"
    ? "Account created! Check your email to confirm, then log in."
    : null;

  // ── Client-side validation ───────────────────────────────────────────────
  function validate() {
    const errs: Record<string, string> = {};
    if (!email.trim())
      errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Enter a valid email address.";
    if (!password)
      errs.password = "Password is required.";
    else if (password.length < 6)
      errs.password = "Password must be at least 6 characters.";
    return errs;
  }

  // ── Submit handler ───────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    // Validate locally first (fast feedback)
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    // Call the server action
    // login() will redirect on success, or return { error } on failure
    startTransition(async () => {
      const result = await login(email, password);
      if (result?.error) {
        setServerError(result.error);
      }
      // On success: login() calls redirect() which navigates automatically
    });
  }

  return (
    <AuthLayout>
      <AuthCard active="login">

        {/* Success message (after signup) */}
        {successMessage && <SuccessBanner message={successMessage} />}

        {/* Server auth error */}
        {serverError && <ErrorBanner message={serverError} />}

        {/* Insight badge (only when no messages showing) */}
        {!successMessage && !serverError && <InsightBadge />}

        <form onSubmit={handleSubmit} noValidate className="space-y-4 md:space-y-5">
          <FormField
            label="Email Address"
            type="email"
            placeholder="wanderer@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setServerError(null); }}
            error={fieldErrors.email}
            autoComplete="email"
            autoFocus
          />

          <FormField
            label="Password"
            type="password"
            placeholder="Your secret key"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setServerError(null); }}
            error={fieldErrors.password}
            autoComplete="current-password"
          />

          {/* Forgot password */}
          <div className="flex justify-end -mt-1">
            <button
              type="button"
              className="text-xs sm:text-sm font-body text-white/30 hover:text-gold transition-colors py-1"
            >
              Forgot your password?
            </button>
          </div>

          <div className="pt-1">
            <button type="submit" disabled={isPending} className="btn-gold">
              {isPending ? (
                <>
                  <Spinner />
                  <span>Entering the Wilds…</span>
                </>
              ) : (
                <>
                  <span>Enter the Number Wilds</span>
                  <span className="text-primary/70 text-lg">→</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="auth-divider mt-6 md:mt-8">
          <span>or</span>
        </div>

        <p className="text-center text-white/40 text-sm font-body">
          New Wanderer?{" "}
          <Link
            href="/signup"
            className="text-gold font-medium hover:underline underline-offset-2 transition-colors"
          >
            Create your account
          </Link>
        </p>

        {/* Zone preview */}
        <div className="mt-6 md:mt-8 pt-6 border-t border-white/5">
          <p className="text-center text-white/20 text-xs font-body uppercase tracking-widest mb-3">
            Zones awaiting you
          </p>
          <div className="flex justify-center gap-4 sm:gap-6 md:gap-8">
            {[
              { name: "Pebble Shore", color: "bg-teal" },
              { name: "Echo Caves",   color: "bg-violet" },
              { name: "Iron Summit",  color: "bg-coral" },
            ].map((zone) => (
              <div key={zone.name} className="flex flex-col items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${zone.color} opacity-60`} />
                <span className="text-white/25 text-[11px] font-body whitespace-nowrap">
                  {zone.name}
                </span>
              </div>
            ))}
          </div>
        </div>

      </AuthCard>
    </AuthLayout>
  );
}