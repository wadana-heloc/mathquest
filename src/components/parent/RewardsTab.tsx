"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { fetchParentWishes, reviewWish, deliverWish } from "@/lib/parent/wishActions";
import type { ParentWishItem } from "@/lib/parent/wishActions";

// ─── Types ────────────────────────────────────────────────────────────────────

type WishStatus = "pending_approval" | "approved" | "rejected" | "redeemed" | "delivered";

type ParentWish = Omit<ParentWishItem, "status"> & { status: WishStatus };

function toStatus(s: string): WishStatus {
  const valid: WishStatus[] = ["pending_approval", "approved", "rejected", "redeemed", "delivered"];
  return valid.includes(s as WishStatus) ? (s as WishStatus) : "pending_approval";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Child chip ───────────────────────────────────────────────────────────────

const CHILD_PALETTE = [
  "bg-teal/15 text-teal",
  "bg-violet/15 text-violet",
  "bg-amber-100 text-amber-700",
  "bg-coral/15 text-coral",
];

function ChildChip({ name }: { name: string }) {
  const cls = CHILD_PALETTE[name.charCodeAt(0) % CHILD_PALETTE.length];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>
      <span className="w-3.5 h-3.5 rounded-full bg-white/60 flex items-center justify-center font-black text-[9px]">
        {name[0]}
      </span>
      {name}
    </span>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-50">
        <h3 className="font-display font-800 text-stone-800 text-sm">{title}</h3>
        {badge}
      </div>
      <div className="divide-y divide-stone-50">{children}</div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function RewardsTabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-50">
          <div className="h-4 w-36 bg-stone-100 rounded-full" />
          <div className="h-5 w-20 bg-stone-100 rounded-full" />
        </div>
        {[0, 1].map(i => (
          <div key={i} className="px-5 py-4 space-y-3.5 border-b border-stone-50 last:border-0">
            <div className="flex items-center gap-2">
              <div className="h-5 w-14 bg-stone-100 rounded-full" />
              <div className="h-4 w-24 bg-stone-100 rounded-full" />
            </div>
            <div className="h-5 w-48 bg-stone-100 rounded-full" />
            <div className="h-3 w-full bg-stone-100 rounded-full" />
            <div className="h-3 w-3/4 bg-stone-100 rounded-full" />
            <div className="flex gap-2 pt-1">
              <div className="flex-1 h-9 bg-stone-100 rounded-xl" />
              <div className="flex-1 h-9 bg-stone-100 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── WishReviewCard ───────────────────────────────────────────────────────────

function WishReviewCard({
  wish,
  isPending,
  actionError,
  onApprove,
  onReject,
}: {
  wish: ParentWish;
  isPending: boolean;
  actionError: string | null;
  onApprove: (id: string, finalCost: number) => void;
  onReject: (id: string, note: string) => void;
}) {
  const [cost, setCost]           = useState<string>(String(wish.ai_suggested_cost ?? ""));
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote]           = useState("");

  const costNum    = Number(cost);
  const costValid  = !isNaN(costNum) && costNum > 0;
  const costChanged = String(wish.ai_suggested_cost) !== cost;

  return (
    <div className="px-5 py-4 space-y-3.5">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <ChildChip name={wish.child_name} />
            <span className="text-[10px] text-stone-400 font-body">{formatDate(wish.created_at)}</span>
          </div>
          <p className="font-display font-800 text-stone-800 text-base leading-snug">{wish.title}</p>
          {wish.ai_reasoning && (
            <p className="text-[11px] text-stone-400 font-body mt-1.5 leading-relaxed italic">
              {wish.ai_reasoning}
            </p>
          )}
        </div>
      </div>

      {/* Coin cost editor */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-xs text-stone-500 font-medium">Coin cost</span>
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-xl px-3 py-1.5">
          <span className="text-sm leading-none">🪙</span>
          <input
            type="number"
            min={1}
            aria-label="Coin cost"
            value={cost}
            onChange={e => setCost(e.target.value)}
            disabled={isPending}
            className="w-20 text-sm font-display font-800 text-amber-700 bg-transparent outline-none tabular-nums disabled:opacity-60"
          />
        </div>
        {wish.ai_suggested_cost !== null && costChanged && (
          <button
            type="button"
            onClick={() => setCost(String(wish.ai_suggested_cost))}
            className="text-[10px] text-stone-400 hover:text-stone-600 underline transition-colors"
          >
            reset to AI ({wish.ai_suggested_cost?.toLocaleString()})
          </button>
        )}
      </div>

      {/* Reject note input */}
      {rejecting && (
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optional note for the child… (e.g. Let's revisit this later!)"
          rows={2}
          className="w-full text-sm px-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 resize-none outline-none focus:border-coral/50 focus:ring-1 focus:ring-coral/20 transition-all placeholder:text-stone-300 font-body"
        />
      )}

      {/* Action error */}
      {actionError && (
        <p className="text-[11px] text-coral font-medium">{actionError}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {!rejecting ? (
          <>
            <button
              type="button"
              disabled={!costValid || isPending}
              onClick={() => onApprove(wish.id, costNum)}
              className="flex-1 h-9 rounded-xl bg-teal text-white text-xs font-bold hover:bg-teal/80 active:scale-[.98] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? "Saving…" : "✓ Approve"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setRejecting(true)}
              className="flex-1 h-9 rounded-xl bg-red-50 border border-red-100 text-coral text-xs font-bold hover:bg-red-100 active:scale-[.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✕ Reject
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onReject(wish.id, note)}
              className="flex-1 h-9 rounded-xl bg-coral text-white text-xs font-bold hover:bg-coral/80 active:scale-[.98] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Saving…" : "Confirm rejection"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => { setRejecting(false); setNote(""); }}
              className="h-9 px-4 rounded-xl border border-stone-200 text-stone-500 text-xs font-semibold hover:bg-stone-50 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── WishDeliverCard ──────────────────────────────────────────────────────────

function WishDeliverCard({
  wish,
  delivering,
  actionError,
  onDeliver,
}: {
  wish: ParentWish;
  delivering: boolean;
  actionError: string | null;
  onDeliver: (id: string) => void;
}) {
  return (
    <div
      className={`px-5 py-4 flex items-center gap-4 transition-all duration-500 ${
        delivering ? "opacity-0 translate-y-1 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <ChildChip name={wish.child_name} />
        </div>
        <p className="font-display font-800 text-stone-800 text-sm mt-1 leading-snug">{wish.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="flex items-center gap-1 text-[11px] text-amber-600 font-semibold">
            🪙 {(wish.final_cost ?? 0).toLocaleString()} coins spent
          </span>
          {wish.redeemed_at && (
            <span className="text-[11px] text-stone-400 font-body">
              · redeemed {daysAgo(wish.redeemed_at)}
            </span>
          )}
        </div>
        {actionError && (
          <p className="text-[11px] text-coral font-medium mt-1">{actionError}</p>
        )}
      </div>

      <button
        type="button"
        disabled={delivering}
        onClick={() => onDeliver(wish.id)}
        className="flex-shrink-0 h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold hover:bg-navy-light active:scale-[.98] transition-all shadow-sm disabled:opacity-50"
      >
        {delivering ? "Marking…" : "Mark as delivered"}
      </button>
    </div>
  );
}

// ─── WishHistoryRow ───────────────────────────────────────────────────────────

const HISTORY_STATUS: Partial<Record<WishStatus, { label: string; cls: string; icon: string }>> = {
  delivered: { label: "Delivered",        cls: "bg-teal/15 text-teal",                     icon: "✓" },
  approved:  { label: "Approved",         cls: "bg-green-50 text-green-700 border border-green-100", icon: "✓" },
  rejected:  { label: "Rejected",         cls: "bg-red-50 text-coral border border-red-100",         icon: "✕" },
  redeemed:  { label: "Pending delivery", cls: "bg-sky-50 text-sky-600 border border-sky-100",        icon: "○" },
};

function WishHistoryRow({ wish }: { wish: ParentWish }) {
  const cfg = HISTORY_STATUS[wish.status] ?? HISTORY_STATUS.delivered!;
  const date = wish.delivered_at ?? wish.redeemed_at ?? wish.created_at;

  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 flex items-center gap-2.5 flex-wrap">
          <ChildChip name={wish.child_name} />
          <span className="text-sm font-semibold text-stone-600 truncate">{wish.title}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {wish.final_cost !== null && (
            <span className="text-[11px] text-amber-600 font-semibold hidden sm:inline">
              🪙 {wish.final_cost.toLocaleString()}
            </span>
          )}
          <span className="text-[11px] text-stone-400 font-body hidden sm:inline">
            {formatDate(date)}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.cls}`}>
            {cfg.icon} {cfg.label}
          </span>
        </div>
      </div>
      {wish.status === "rejected" && wish.parent_note && (
        <p className="text-[11px] text-stone-400 font-body italic mt-1 pl-0.5">
          &ldquo;{wish.parent_note}&rdquo;
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RewardsTab({
  onPendingCountChange,
  children: childList = [],
  defaultChildId,
}: {
  onPendingCountChange?: (n: number) => void;
  children?: { id: string; name: string }[];
  defaultChildId?: string;
}) {
  const [wishes, setWishes]             = useState<ParentWish[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [deliveringIds, setDeliveringIds] = useState<Set<string>>(new Set());
  const [childFilter, setChildFilter]   = useState<string>(defaultChildId ?? "all");

  const onPendingCountChangeRef = useRef(onPendingCountChange);
  onPendingCountChangeRef.current = onPendingCountChange;

  const loadWishes = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await fetchParentWishes();
    if (error || !data) {
      setLoadError(error ?? "Failed to load rewards.");
      setLoading(false);
      return;
    }
    setWishes(data.wishes.map(w => ({ ...w, status: toStatus(w.status) })));
    onPendingCountChangeRef.current?.(data.pending_count);
    setLoading(false);
  }, []);

  useEffect(() => { loadWishes(); }, [loadWishes]);

  const filteredWishes = childFilter === "all"
    ? wishes
    : wishes.filter(w => w.child_id === childFilter);

  const pending = filteredWishes.filter(w => w.status === "pending_approval");
  const redeemed = filteredWishes.filter(w => w.status === "redeemed");
  const history = filteredWishes
    .filter(w => ["delivered", "approved", "rejected"].includes(w.status))
    .sort((a, b) => {
      const da = new Date(a.delivered_at ?? a.redeemed_at ?? a.created_at).getTime();
      const db = new Date(b.delivered_at ?? b.redeemed_at ?? b.created_at).getTime();
      return db - da;
    });

  const clearActionError = (id: string) =>
    setActionErrors(prev => { const n = { ...prev }; delete n[id]; return n; });

  const handleApprove = useCallback(async (id: string, finalCost: number) => {
    setPendingActions(prev => ({ ...prev, [id]: true }));
    clearActionError(id);

    const { error } = await reviewWish(id, { action: "approve", final_cost: finalCost });

    if (error) {
      setActionErrors(prev => ({ ...prev, [id]: error }));
      setPendingActions(prev => { const n = { ...prev }; delete n[id]; return n; });
      return;
    }

    setWishes(prev => {
      const updated = prev.map(w =>
        w.id === id ? { ...w, status: "approved" as WishStatus, final_cost: finalCost } : w
      );
      const newPendingCount = updated.filter(w => w.status === "pending_approval").length;
      onPendingCountChangeRef.current?.(newPendingCount);
      return updated;
    });
    setPendingActions(prev => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const handleReject = useCallback(async (id: string, note: string) => {
    setPendingActions(prev => ({ ...prev, [id]: true }));
    clearActionError(id);

    const { error } = await reviewWish(id, { action: "reject", parent_note: note || undefined });

    if (error) {
      setActionErrors(prev => ({ ...prev, [id]: error }));
      setPendingActions(prev => { const n = { ...prev }; delete n[id]; return n; });
      return;
    }

    setWishes(prev => {
      const updated = prev.map(w =>
        w.id === id ? { ...w, status: "rejected" as WishStatus, parent_note: note || null } : w
      );
      const newPendingCount = updated.filter(w => w.status === "pending_approval").length;
      onPendingCountChangeRef.current?.(newPendingCount);
      return updated;
    });
    setPendingActions(prev => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const handleDeliver = useCallback(async (id: string) => {
    setDeliveringIds(prev => new Set(Array.from(prev).concat(id)));
    clearActionError(id);

    const { error } = await deliverWish(id);

    if (error) {
      setDeliveringIds(prev => {
        const n = new Set(Array.from(prev));
        n.delete(id);
        return n;
      });
      setActionErrors(prev => ({ ...prev, [id]: error }));
      return;
    }

    setTimeout(() => {
      setWishes(prev =>
        prev.map(w =>
          w.id === id
            ? { ...w, status: "delivered" as WishStatus, delivered_at: new Date().toISOString() }
            : w
        )
      );
      setDeliveringIds(prev => {
        const n = new Set(Array.from(prev));
        n.delete(id);
        return n;
      });
    }, 500);
  }, []);

  if (loading) return <RewardsTabSkeleton />;

  if (loadError) {
    return (
      <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-sm font-semibold text-stone-600">{loadError}</p>
        <button
          type="button"
          onClick={loadWishes}
          className="mt-4 text-xs text-violet underline font-semibold hover:text-violet/70 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  const noWishesAtAll  = wishes.length === 0;
  const noWishesFiltered = !noWishesAtAll && pending.length === 0 && redeemed.length === 0 && history.length === 0;
  const activeChildName  = childList.find(c => c.id === childFilter)?.name;

  const childFilterChips = childList.length > 1 ? (
    <div className="flex gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => setChildFilter("all")}
        className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
          childFilter === "all"
            ? "bg-violet text-white border-violet"
            : "bg-white text-stone-400 border-stone-200 hover:border-violet/40 hover:text-violet"
        }`}
      >
        All children
      </button>
      {childList.map(c => (
        <button
          key={c.id}
          type="button"
          onClick={() => setChildFilter(c.id)}
          className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
            childFilter === c.id
              ? "bg-violet text-white border-violet"
              : "bg-white text-stone-400 border-stone-200 hover:border-violet/40 hover:text-violet"
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  ) : null;

  if (noWishesAtAll) {
    return (
      <div className="space-y-4">
        {childFilterChips && <div>{childFilterChips}</div>}
        <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center">
          <div className="text-4xl mb-3">🎁</div>
          <p className="text-sm font-semibold text-stone-600">No wishes yet</p>
          <p className="text-xs text-stone-400 mt-1 leading-relaxed">
            Your children&apos;s wishes will appear here once they add some.
          </p>
        </div>
      </div>
    );
  }

  if (noWishesFiltered) {
    return (
      <div className="space-y-4">
        {childFilterChips && <div>{childFilterChips}</div>}
        <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center">
          <div className="text-4xl mb-3">🎁</div>
          <p className="text-sm font-semibold text-stone-600">
            No wishes for {activeChildName ?? "this child"} yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Child filter ─────────────────────────────────────────────────────── */}
      {childFilterChips}

      {/* ── Needs your review ───────────────────────────────────────────────── */}
      {pending.length > 0 && (
        <Section
          title="Needs your review"
          badge={
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-coral/10 text-coral">
              {pending.length} waiting
            </span>
          }
        >
          {pending.map(w => (
            <WishReviewCard
              key={w.id}
              wish={w}
              isPending={!!pendingActions[w.id]}
              actionError={actionErrors[w.id] ?? null}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </Section>
      )}

      {/* ── Redeemed — waiting for delivery ────────────────────────────────── */}
      {redeemed.length > 0 && (
        <Section
          title="Redeemed — waiting for you to deliver"
          badge={
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-600 border border-sky-100">
              {redeemed.length} to deliver
            </span>
          }
        >
          {redeemed.map(w => (
            <WishDeliverCard
              key={w.id}
              wish={w}
              delivering={deliveringIds.has(w.id)}
              actionError={actionErrors[w.id] ?? null}
              onDeliver={handleDeliver}
            />
          ))}
        </Section>
      )}

      {/* ── History ─────────────────────────────────────────────────────────── */}
      {history.length > 0 && (
        <Section
          title="History"
          badge={
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-stone-50 text-stone-400 border border-stone-100">
              {history.length} {history.length === 1 ? "wish" : "wishes"}
            </span>
          }
        >
          {history.map(w => (
            <WishHistoryRow key={w.id} wish={w} />
          ))}
        </Section>
      )}
    </div>
  );
}
