// "use client";

// import dynamic from "next/dynamic";
// import { ReactNode } from "react";

// // Phaser is client-only and must not SSR
// const MathParticles = dynamic(
//   () => import("@/components/phaser/MathParticles"),
//   { ssr: false }
// );

// interface AuthLayoutProps {
//   children: ReactNode;
// }

// export default function AuthLayout({ children }: AuthLayoutProps) {
//   return (
//     <main className="relative min-h-screen w-full flex items-center justify-center px-4 py-12 overflow-hidden">
//       {/* ── Deep navy base background ─────────────────────────────────── */}
//       <div
//         className="fixed inset-0 z-0"
//         style={{
//           background:
//             "radial-gradient(ellipse at 30% 20%, #252547 0%, #1A1A2E 40%, #0f0f1e 100%)",
//         }}
//         aria-hidden="true"
//       />

//       {/* ── Subtle grid lines ─────────────────────────────────────────── */}
//       <div
//         className="fixed inset-0 z-0 opacity-[0.04]"
//         style={{
//           backgroundImage: `
//             linear-gradient(rgba(232,184,75,1) 1px, transparent 1px),
//             linear-gradient(90deg, rgba(232,184,75,1) 1px, transparent 1px)
//           `,
//           backgroundSize: "60px 60px",
//         }}
//         aria-hidden="true"
//       />

//       {/* ── Corner accent lines ───────────────────────────────────────── */}
//       <div
//         className="fixed top-0 left-0 w-64 h-64 z-0 opacity-20 pointer-events-none"
//         style={{
//           background:
//             "radial-gradient(circle at 0% 0%, rgba(45,212,191,0.5) 0%, transparent 60%)",
//         }}
//         aria-hidden="true"
//       />
//       <div
//         className="fixed bottom-0 right-0 w-96 h-96 z-0 opacity-20 pointer-events-none"
//         style={{
//           background:
//             "radial-gradient(circle at 100% 100%, rgba(124,58,237,0.4) 0%, transparent 60%)",
//         }}
//         aria-hidden="true"
//       />

//       {/* ── Phaser particle layer ─────────────────────────────────────── */}
//       <MathParticles />

//       {/* ── Page content ─────────────────────────────────────────────── */}
//       <div className="relative z-10 w-full">
//         {children}
//       </div>
//     </main>
//   );
// }

"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

const MathParticles = dynamic(
  () => import("@/components/phaser/MathParticles"),
  { ssr: false }
);

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main
      className={[
        "relative min-h-screen w-full overflow-hidden",
        "flex items-center justify-center",
        // ── Responsive padding ─────────────────────────────────────────
        // mobile:  16px sides, 32px top/bottom
        // tablet:  32px sides, 48px top/bottom  ← primary target
        // desktop: 48px sides, 64px top/bottom
        "px-4 py-8",
        "sm:px-6 sm:py-10",
        "md:px-8 md:py-12",
        "lg:px-12 lg:py-16",
      ].join(" ")}
    >
      {/* ── Deep navy base background ──────────────────────────────────── */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, #252547 0%, #1A1A2E 40%, #0f0f1e 100%)",
        }}
        aria-hidden="true"
      />

      {/* ── Subtle gold grid ───────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(232,184,75,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(232,184,75,1) 1px, transparent 1px)
          `,
          // Larger grid on tablet+, tighter on mobile
          backgroundSize: "40px 40px",
        }}
        aria-hidden="true"
      />

      {/* ── Teal corner accent — top left ─────────────────────────────── */}
      <div
        className="fixed top-0 left-0 z-0 pointer-events-none
                   w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80
                   opacity-20"
        style={{
          background:
            "radial-gradient(circle at 0% 0%, rgba(45,212,191,0.5) 0%, transparent 60%)",
        }}
        aria-hidden="true"
      />

      {/* ── Violet corner accent — bottom right ───────────────────────── */}
      <div
        className="fixed bottom-0 right-0 z-0 pointer-events-none
                   w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96
                   opacity-20"
        style={{
          background:
            "radial-gradient(circle at 100% 100%, rgba(124,58,237,0.4) 0%, transparent 60%)",
        }}
        aria-hidden="true"
      />

      {/* ── Phaser particle layer ──────────────────────────────────────── */}
      <MathParticles />

      {/* ── Page content — full width, card constrains itself ─────────── */}
      <div className="relative z-10 w-full">
        {children}
      </div>
    </main>
  );
}