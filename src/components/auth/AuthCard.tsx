// "use client";

// import { ReactNode } from "react";
// import Link from "next/link";

// // ── Geometric Wanderer logo mark ──────────────────────────────────────────
// function WandererMark() {
//   return (
//     <svg
//       width="48"
//       height="48"
//       viewBox="0 0 48 48"
//       fill="none"
//       aria-hidden="true"
//     >
//       {/* Outer hexagon */}
//       <path
//         d="M24 2 L44 13 L44 35 L24 46 L4 35 L4 13 Z"
//         stroke="#E8B84B"
//         strokeWidth="1.5"
//         fill="rgba(232,184,75,0.08)"
//       />
//       {/* Inner diamond */}
//       <path
//         d="M24 10 L36 24 L24 38 L12 24 Z"
//         stroke="#2DD4BF"
//         strokeWidth="1"
//         fill="rgba(45,212,191,0.1)"
//       />
//       {/* Center star */}
//       <circle cx="24" cy="24" r="4" fill="#E8B84B" />
//       {/* Corner dots */}
//       <circle cx="24" cy="10" r="1.5" fill="#E8B84B" opacity="0.6" />
//       <circle cx="36" cy="24" r="1.5" fill="#E8B84B" opacity="0.6" />
//       <circle cx="24" cy="38" r="1.5" fill="#E8B84B" opacity="0.6" />
//       <circle cx="12" cy="24" r="1.5" fill="#E8B84B" opacity="0.6" />
//     </svg>
//   );
// }

// // ── Tab switcher: Login ↔ Sign Up ─────────────────────────────────────────
// interface TabSwitcherProps {
//   active: "login" | "signup";
// }

// function TabSwitcher({ active }: TabSwitcherProps) {
//   return (
//     <div className="flex rounded-md bg-white/5 p-1 mb-8">
//       <Link
//         href="/auth/login"
//         className={[
//           "flex-1 h-10 rounded flex items-center justify-center text-sm font-medium transition-all duration-200",
//           "font-display",
//           active === "login"
//             ? "bg-gold text-primary shadow-lg shadow-gold/20"
//             : "text-white/50 hover:text-white/80",
//         ].join(" ")}
//       >
//         Login
//       </Link>
//       <Link
//         href="/auth/signup"
//         className={[
//           "flex-1 h-10 rounded flex items-center justify-center text-sm font-medium transition-all duration-200",
//           "font-display",
//           active === "signup"
//             ? "bg-gold text-primary shadow-lg shadow-gold/20"
//             : "text-white/50 hover:text-white/80",
//         ].join(" ")}
//       >
//         Sign Up
//       </Link>
//     </div>
//   );
// }

// // ── Main AuthCard ─────────────────────────────────────────────────────────
// interface AuthCardProps {
//   children: ReactNode;
//   active: "login" | "signup";
//   animationClass?: string;
// }

// export default function AuthCard({
//   children,
//   active,
//   animationClass = "animate-fade-up",
// }: AuthCardProps) {
//   return (
//     <div
//       className={[
//         "relative z-10 w-full max-w-[440px] mx-auto",
//         animationClass,
//         "opacity-0", // animation starts hidden, fade-up reveals it
//       ].join(" ")}
//       style={{ animationFillMode: "forwards", animationDelay: "0.1s" }}
//     >
//       {/* Glow behind the card */}
//       <div
//         className="absolute -inset-1 rounded-xl opacity-30 blur-xl pointer-events-none"
//         style={{
//           background:
//             "radial-gradient(ellipse at center, rgba(232,184,75,0.3) 0%, transparent 70%)",
//         }}
//         aria-hidden="true"
//       />

//       {/* Glass card */}
//       <div
//         className="relative rounded-xl p-8 border border-white/10"
//         style={{
//           background:
//             "linear-gradient(135deg, rgba(37,37,71,0.95) 0%, rgba(26,26,46,0.98) 100%)",
//           backdropFilter: "blur(20px)",
//           WebkitBackdropFilter: "blur(20px)",
//           boxShadow:
//             "0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
//         }}
//       >
//         {/* Logo + brand */}
//         <div className="flex flex-col items-center mb-8">
//           <div className="animate-float mb-4">
//             <WandererMark />
//           </div>
//           <h1
//             className="font-display font-black text-2xl text-white tracking-tight"
//             style={{ letterSpacing: "-0.02em" }}
//           >
//             Math<span className="text-gold">Quest</span>
//           </h1>
//           <p className="text-white/30 text-xs mt-1 font-body tracking-widest uppercase">
//             The Number Wilds
//           </p>
//         </div>

//         {/* Tab switcher */}
//         <TabSwitcher active={active} />

//         {/* Page content */}
//         {children}
//       </div>

//       {active === "login" && (
//         <p className="text-center text-white/20 text-xs mt-6 font-body">
//           By continuing, you agree to the MathQuest{" "}
//           <span className="text-white/40 underline underline-offset-2 cursor-pointer hover:text-gold transition-colors">
//             Terms of Play
//           </span>
//           .
//         </p>
//       )}
//     </div>
//   );
// }

"use client";

import { ReactNode } from "react";
import Link from "next/link";

// ── Geometric Wanderer logo mark ──────────────────────────────────────────
function WandererMark() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M24 2 L44 13 L44 35 L24 46 L4 35 L4 13 Z"
        stroke="#E8B84B"
        strokeWidth="1.5"
        fill="rgba(232,184,75,0.08)"
      />
      <path
        d="M24 10 L36 24 L24 38 L12 24 Z"
        stroke="#2DD4BF"
        strokeWidth="1"
        fill="rgba(45,212,191,0.1)"
      />
      <circle cx="24" cy="24" r="4" fill="#E8B84B" />
      <circle cx="24" cy="10" r="1.5" fill="#E8B84B" opacity="0.6" />
      <circle cx="36" cy="24" r="1.5" fill="#E8B84B" opacity="0.6" />
      <circle cx="24" cy="38" r="1.5" fill="#E8B84B" opacity="0.6" />
      <circle cx="12" cy="24" r="1.5" fill="#E8B84B" opacity="0.6" />
    </svg>
  );
}

// ── Tab switcher ──────────────────────────────────────────────────────────
interface TabSwitcherProps {
  active: "login" | "signup";
}

function TabSwitcher({ active }: TabSwitcherProps) {
  return (
    <div className="flex rounded-md bg-white/5 p-1 mb-8">
      <Link
        href="/login"
        className={[
          "flex-1 h-11 rounded flex items-center justify-center",
          "text-sm md:text-base font-medium font-display",
          "transition-all duration-200",
          active === "login"
            ? "bg-gold text-primary shadow-lg shadow-gold/20"
            : "text-white/50 hover:text-white/80",
        ].join(" ")}
      >
        Login
      </Link>
      <Link
        href="/signup"
        className={[
          "flex-1 h-11 rounded flex items-center justify-center",
          "text-sm md:text-base font-medium font-display",
          "transition-all duration-200",
          active === "signup"
            ? "bg-gold text-primary shadow-lg shadow-gold/20"
            : "text-white/50 hover:text-white/80",
        ].join(" ")}
      >
        Sign Up
      </Link>
    </div>
  );
}

// ── Main AuthCard ─────────────────────────────────────────────────────────
interface AuthCardProps {
  children: ReactNode;
  active: "login" | "signup";
  animationClass?: string;
}

export default function AuthCard({
  children,
  active,
  animationClass = "animate-fade-up",
}: AuthCardProps) {
  return (
    <div
      className={[
        "relative z-10 w-full mx-auto",
        // ── Responsive max-width ──────────────────────────────────────
        // mobile:  full width with small side padding (handled by AuthLayout)
        // tablet:  560px — primary target (iPad 768px viewport)
        // desktop: 640px — comfortable on large screens
        "max-w-[560px] md:max-w-[600px] lg:max-w-[640px]",
        animationClass,
        "opacity-0",
      ].join(" ")}
      style={{ animationFillMode: "forwards", animationDelay: "0.1s" }}
    >
      {/* Glow behind the card */}
      <div
        className="absolute -inset-2 rounded-2xl opacity-25 blur-2xl pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(232,184,75,0.35) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Glass card */}
      <div
        className={[
          "relative rounded-2xl border border-white/10",
          // ── Responsive padding ────────────────────────────────────────
          // mobile:  compact — 24px
          // tablet:  comfortable — 40px
          // desktop: generous — 48px
          "p-6 sm:p-8 md:p-10 lg:p-12",
        ].join(" ")}
        style={{
          background:
            "linear-gradient(135deg, rgba(37,37,71,0.95) 0%, rgba(26,26,46,0.98) 100%)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo + brand */}
        {/* Logo + brand — clicking navigates back to home page */}
        <Link href="/" className="flex flex-col items-center mb-8 md:mb-10 group cursor-pointer">
          <div className="animate-float mb-4 group-hover:scale-110 transition-transform duration-300">
            <WandererMark />
          </div>
          <h1
            className="font-display font-black text-white tracking-tight
               text-2xl sm:text-3xl md:text-3xl"
            style={{ letterSpacing: "-0.02em" }}
          >
            Math<span className="text-gold">Quest</span>
          </h1>
          <p className="text-white/30 text-xs mt-1.5 font-body tracking-widest uppercase">
            The Number Wilds
          </p>
        </Link>

        {/* Tab switcher */}
        <TabSwitcher active={active} />

        {/* Page content */}
        {children}
      </div>

      {/* Bottom legal copy */}
      <p className="text-center text-white/20 text-xs mt-5 font-body">
        By continuing, you agree to the MathQuest{" "}
        <span className="text-white/40 underline underline-offset-2 cursor-pointer hover:text-gold transition-colors">
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold/70 hover:text-gold transition-colors underline underline-offset-2"
          >
            Terms of Play
          </Link>

        </span>
        .
      </p>
    </div>
  );
}