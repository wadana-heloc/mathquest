"use client";

// ─────────────────────────────────────────────────────────────────────────────
// GameSpinner
// Three concentric spinning rings (gold/teal/violet) + floating emoji center
// + animated bouncing-dot loading label below.
// ─────────────────────────────────────────────────────────────────────────────
export function GameSpinner({
  emoji = "⭐",
  label,
  size = "md",
}: {
  emoji?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim    = { sm: "w-14 h-14", md: "w-20 h-20",  lg: "w-28 h-28"  }[size];
  const gap1   = { sm: "inset-1.5", md: "inset-2",    lg: "inset-3"    }[size];
  const gap2   = { sm: "inset-3",   md: "inset-4.5",  lg: "inset-6.5"  }[size];
  const center = { sm: "text-xl",   md: "text-2xl",   lg: "text-4xl"   }[size];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`relative ${dim}`} role="status" aria-label={label ?? "Loading"}>
        {/* Outer ring — gold, slow clockwise */}
        <div
          className="absolute inset-0 rounded-full border-2 border-gold/25 border-t-gold animate-spin"
          style={{ animationDuration: "3s" }}
        />
        {/* Mid ring — teal, medium counter-clockwise */}
        <div
          className={`absolute ${gap1} rounded-full border-2 border-teal/20 border-b-teal animate-spin`}
          style={{ animationDuration: "2.1s", animationDirection: "reverse" }}
        />
        {/* Inner ring — violet, fast clockwise */}
        <div
          className={`absolute ${gap2} rounded-full border-2 border-violet/20 border-r-violet animate-spin`}
          style={{ animationDuration: "1.3s" }}
        />
        {/* Center emoji — gentle bob using existing float-logo keyframe */}
        <div
          className={`absolute inset-0 flex items-center justify-center ${center} select-none animate-float-logo`}
        >
          {emoji}
        </div>
      </div>

      {label && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-stone-400 font-body">{label}</span>
          <span className="flex items-end gap-[3px] h-3 pb-px" aria-hidden="true">
            {[0, 0.2, 0.4].map((delay, i) => (
              <span
                key={i}
                className="w-[3px] h-[3px] rounded-full bg-stone-400 inline-block"
                style={{ animation: `wave-dot 1.4s ease-in-out ${delay}s infinite` }}
              />
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton — single shimmer bar; pass className for size / shape
// ─────────────────────────────────────────────────────────────────────────────
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`skeleton rounded-xl ${className}`}
      aria-hidden="true"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatCardSkeleton — matches StatCard layout exactly
// ─────────────────────────────────────────────────────────────────────────────
export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-4 flex items-center gap-3">
      <Skeleton className="w-10 h-10 flex-shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-5 w-12" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConceptBarSkeleton — matches a concept progress-bar row
// ─────────────────────────────────────────────────────────────────────────────
export function ConceptBarSkeleton() {
  return (
    <div className="space-y-1.5" aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-8" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-2 w-10" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProblemRowSkeleton — matches a today-problems list row
// ─────────────────────────────────────────────────────────────────────────────
export function ProblemRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-stone-100 bg-white">
      <Skeleton className="w-6 h-6 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-2.5 w-16 rounded-full" />
      </div>
      <Skeleton className="w-8 h-5 flex-shrink-0" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TrickCardSkeleton — matches a trick discovery card
// ─────────────────────────────────────────────────────────────────────────────
export function TrickCardSkeleton() {
  return (
    <div className="p-3 rounded-xl border border-stone-100 bg-white">
      <div className="flex items-start gap-2.5">
        <Skeleton className="w-10 h-5 rounded-md flex-shrink-0" />
        <div className="flex-1 space-y-1.5 min-w-0">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-4/5" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReportSectionSkeleton — matches a report section card (colored border + header)
// ─────────────────────────────────────────────────────────────────────────────
export function ReportSectionSkeleton({
  border,
  hdr,
  lines,
}: {
  border: string;
  hdr: string;
  lines: string[];
}) {
  return (
    <div className={`rounded-2xl border overflow-hidden ${border}`}>
      <div className={`px-5 py-4 ${hdr}`}>
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="px-5 py-4 bg-white space-y-2.5">
        {lines.map((w, i) => (
          <Skeleton key={i} className={`h-3 ${w}`} />
        ))}
      </div>
    </div>
  );
}
