"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchChildWishes, submitWish, redeemWish } from "@/lib/child/wishActions";
import type { WishItem } from "@/lib/child/wishActions";

// ─── Local type alias ─────────────────────────────────────────────────────────

type WishStatus = "pending_approval" | "approved" | "rejected" | "redeemed" | "delivered";

// Cast the string status from the API to the known union
function toStatus(s: string): WishStatus {
  return s as WishStatus;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4_000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm font-body px-5 py-2.5 rounded-xl shadow-2xl animate-fade-slide-up whitespace-nowrap pointer-events-none">
      {message}
    </div>
  );
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function WishSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3 animate-pulse">
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-slate-200 rounded-lg w-3/4" />
        <div className="h-2.5 bg-slate-100 rounded-lg w-1/2" />
      </div>
      <div className="h-5 w-16 bg-slate-200 rounded-full" />
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<WishStatus, { label: string; cls: string }> = {
  pending_approval: { label: "Waiting",          cls: "bg-amber-50 text-amber-600 border-amber-200" },
  approved:         { label: "Approved",          cls: "bg-green-50 text-green-700 border-green-200" },
  rejected:         { label: "Not approved",      cls: "bg-slate-50 text-slate-400 border-slate-200" },
  redeemed:         { label: "Pending delivery",  cls: "bg-sky-50 text-sky-600 border-sky-200" },
  delivered:        { label: "Done ✓",            cls: "bg-slate-50 text-slate-400 border-slate-200" },
};

function StatusBadge({ status }: { status: WishStatus }) {
  const { label, cls } = STATUS_BADGE[status] ?? STATUS_BADGE.pending_approval;
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

// ─── Wish row ─────────────────────────────────────────────────────────────────

function WishRow({
  wish,
  isNewlyApproved,
  onRedeem,
  redeemError,
}: {
  wish: WishItem;
  isNewlyApproved: boolean;
  onRedeem: (id: string) => void;
  redeemError: string | null;
}) {
  const status      = toStatus(wish.status);
  const canRedeem   = status === "approved" && wish.coins_needed === 0;
  const isAffordable = wish.final_cost !== null && wish.coins_needed === 0;
  const isPricing   = status === "pending_approval" && wish.ai_suggested_cost === null;

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-all duration-500",
        isNewlyApproved
          ? "border-green-300 bg-green-50/80 shadow-[0_0_18px_rgba(34,197,94,0.28)]"
          : "border-slate-100 bg-slate-50/50",
      ].join(" ")}
    >
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-slate-800 text-sm truncate leading-tight">
          {wish.title}
        </p>

        {isPricing && (
          <p className="text-[11px] text-amber-500 font-body mt-0.5 animate-pulse">Pricing…</p>
        )}

        {!isPricing && wish.final_cost !== null && (
          <p className={`text-[11px] font-body mt-0.5 ${isAffordable ? "text-game-green font-semibold" : "text-slate-400"}`}>
            {isAffordable
              ? `${wish.final_cost.toLocaleString()} coins total · You have enough!`
              : `${wish.final_cost.toLocaleString()} coins total · ${wish.coins_needed.toLocaleString()} still needed`}
          </p>
        )}

        {redeemError && (
          <p className="text-[11px] text-coral font-body mt-0.5">{redeemError}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <StatusBadge status={status} />
        {canRedeem && (
          <button
            onClick={() => onRedeem(wish.id)}
            className="text-xs font-bold text-white bg-game-green hover:bg-green-500 active:scale-95 px-4 py-1.5 rounded-full transition-all shadow-sm"
          >
            Redeem
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Rejected section ─────────────────────────────────────────────────────────

function RejectedSection({ wishes }: { wishes: WishItem[] }) {
  const [open, setOpen] = useState(false);
  if (wishes.length === 0) return null;
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-slate-400 text-[11px] font-body hover:text-slate-600 transition-colors py-1"
      >
        <span
          className="inline-block text-[9px] transition-transform duration-200"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ▶
        </span>
        Not approved ({wishes.length})
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1.5">
          {wishes.map(w => (
            <div key={w.id} className="px-3.5 py-2.5 rounded-xl border border-slate-100 bg-slate-50/40">
              <p className="text-sm text-slate-400 line-through font-body leading-tight">{w.title}</p>
              {w.parent_note && (
                <p className="text-[11px] text-slate-400 font-body mt-1 italic">"{w.parent_note}"</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add wish form ────────────────────────────────────────────────────────────

function AddWishForm({ onAdd }: { onAdd: (title: string) => Promise<{ ok: boolean }> }) {
  const [value, setValue]       = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) { setError("Enter a wish first!"); return; }
    if (trimmed.length > 120) { setError("Max 120 characters."); return; }
    setError(null);
    setSubmitting(true);
    const { ok } = await onAdd(trimmed);
    setSubmitting(false);
    if (ok) setValue(""); // spec: do not clear form on failure
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-slate-100">
      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-body mb-2">
        ✨ Add a new wish
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={e => { setValue(e.target.value); setError(null); }}
          placeholder="e.g. Pizza night, new book…"
          maxLength={125}
          disabled={submitting}
          className="flex-1 min-w-0 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-violet/50 focus:ring-1 focus:ring-violet/20 transition-all font-body disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={submitting}
          className="flex-shrink-0 text-sm font-bold text-white bg-violet hover:bg-violet/80 active:scale-95 px-4 py-2 rounded-xl transition-all disabled:opacity-60"
        >
          {submitting ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="text-[11px] text-coral mt-1.5 font-body">{error}</p>}
      <p className="text-[10px] text-slate-300 mt-1 font-body text-right tabular-nums">
        {value.length}/120
      </p>
    </form>
  );
}

// ─── Wishlist header ──────────────────────────────────────────────────────────

function WishlistHeader({ coins }: { coins: number }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <p className="text-slate-600 text-sm font-display font-bold">Save up &amp; spend your coins</p>
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1.5 bg-gold/10 border border-gold/25 rounded-full px-3 py-1.5">
          <span className="text-base leading-none">💰</span>
          <span className="font-display font-black text-gold text-sm tabular-nums">
            {coins.toLocaleString()}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 font-body">coins to spend</p>
      </div>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export function WishlistCard() {
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState<string | null>(null);
  const [coins, setCoins]               = useState(0);
  const [wishes, setWishes]             = useState<WishItem[]>([]);
  const [toast, setToast]               = useState<string | null>(null);
  const [redeemErrors, setRedeemErrors] = useState<Record<string, string>>({});
  const [glowingIds, setGlowingIds]     = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<"all" | WishStatus>("all");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  // ── Stop polling ─────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ── Start polling (GET /child/wishes every 5s for AI pricing) ────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current !== null) return; // already running
    pollRef.current = setInterval(async () => {
      const result = await fetchChildWishes();
      if (result.error) return; // transient error — keep polling
      setWishes(result.data!.wishes);
      setCoins(result.data!.coins);
      const anyStillPricing = result.data!.wishes.some(
        w => w.status === "pending_approval" && w.ai_suggested_cost === null
      );
      if (!anyStillPricing) stopPolling();
    }, 5_000);
  }, [stopPolling]);

  // Stop polling on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Initial load ──────────────────────────────────────────────────────────────
  const loadWishes = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await fetchChildWishes();
    setLoading(false);
    if (result.error) {
      setLoadError(result.error);
      return;
    }
    setCoins(result.data!.coins);
    setWishes(result.data!.wishes);
    // Resume polling if any wishes are still awaiting AI pricing
    if (result.data!.wishes.some(w => w.status === "pending_approval" && w.ai_suggested_cost === null)) {
      startPolling();
    }
  }, [startPolling]);

  useEffect(() => { loadWishes(); }, [loadWishes]);

  // ── Approval celebration ──────────────────────────────────────────────────────
  // Fires on every wishes update; compares to sessionStorage to detect newly approved
  useEffect(() => {
    if (loading || wishes.length === 0) return;
    const key = "mq:wish:statuses";
    const raw = sessionStorage.getItem(key);
    const prev: Record<string, string> = raw ? JSON.parse(raw) : {};

    const newlyApproved = wishes
      .filter(w => w.status === "approved" && prev[w.id] === "pending_approval")
      .map(w => w.id);

    if (newlyApproved.length > 0) {
      setGlowingIds(new Set(newlyApproved));
      const t = setTimeout(() => setGlowingIds(new Set()), 3_000);
      const current: Record<string, string> = {};
      wishes.forEach(w => { current[w.id] = w.status; });
      sessionStorage.setItem(key, JSON.stringify(current));
      return () => clearTimeout(t);
    }

    // Save current statuses for next comparison
    const current: Record<string, string> = {};
    wishes.forEach(w => { current[w.id] = w.status; });
    sessionStorage.setItem(key, JSON.stringify(current));
  }, [loading, wishes]);

  // ── Redeem ────────────────────────────────────────────────────────────────────
  const handleRedeem = useCallback(async (id: string) => {
    setRedeemErrors(prev => { const n = { ...prev }; delete n[id]; return n; });

    const result = await redeemWish(id);

    if (result.notEnoughCoins) {
      setRedeemErrors(prev => ({ ...prev, [id]: "Not enough coins" }));
      return;
    }
    if (result.error) {
      setToast(result.error);
      return;
    }

    // Update coins + wish status from API response
    setCoins(result.data!.new_balance);
    setWishes(prev =>
      prev.map(w =>
        w.id === id ? { ...w, status: result.data!.wish.status } : w
      )
    );
  }, []);

  // ── Add wish ──────────────────────────────────────────────────────────────────
  const handleAddWish = useCallback(async (title: string): Promise<{ ok: boolean }> => {
    // Optimistic insert with a temp ID so we can roll back on failure
    const tempId = `temp-${Date.now()}`;
    const optimistic: WishItem = {
      id: tempId,
      title,
      status: "pending_approval",
      ai_suggested_cost: null,
      final_cost: null,
      ai_category: null,
      ai_reasoning: null,
      parent_note: null,
      coins_needed: 0,
      created_at: new Date().toISOString(),
      redeemed_at: null,
      delivered_at: null,
    };
    setWishes(prev => [optimistic, ...prev]);

    const result = await submitWish(title);

    if (result.error) {
      // Rollback optimistic item; spec says keep form filled so return { ok: false }
      setWishes(prev => prev.filter(w => w.id !== tempId));
      setToast("Something went wrong. Try again.");
      return { ok: false };
    }

    // Replace temp item with real API response
    setWishes(prev =>
      prev.map(w =>
        w.id === tempId
          ? { ...optimistic, id: result.data!.id, status: result.data!.status, ai_suggested_cost: result.data!.ai_suggested_cost }
          : w
      )
    );

    // Poll until AI pricing resolves
    startPolling();
    return { ok: true };
  }, [startPolling]);

  // ── Derived lists ─────────────────────────────────────────────────────────────
  const visibleWishes  = wishes.filter(w => w.status !== "rejected");
  const rejectedWishes = wishes.filter(w => w.status === "rejected");

  // ── Filter ────────────────────────────────────────────────────────────────────
  const presentStatuses = Array.from(new Set(visibleWishes.map(w => w.status))) as WishStatus[];

  const FILTER_LABEL: Record<WishStatus | "all", string> = {
    all:              "All",
    pending_approval: "Waiting",
    approved:         "Approved",
    redeemed:         "Pending delivery",
    delivered:        "Done",
    rejected:         "Not approved",
  };

  const filteredWishes = filterStatus === "all"
    ? visibleWishes
    : visibleWishes.filter(w => w.status === filterStatus);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {toast && <Toast message={toast} onClose={dismissToast} />}

      <div
        className="relative bg-white/80 backdrop-blur-sm border border-violet/25 rounded-2xl
                   shadow-[0_0_0_1px_rgba(124,58,237,0.10),0_0_28px_rgba(124,58,237,0.18),0_8px_40px_rgba(99,102,241,0.18)]
                   animate-fade-slide-up opacity-0 [animation-fill-mode:forwards] [animation-delay:0.9s]
                   overflow-hidden"
        role="region"
        aria-label="Wishlist"
      >
        {/* Ambient blobs */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-gold/[0.06] blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-violet/[0.05] blur-3xl" />
        </div>

        {/* Purple header banner */}
        <div className="relative z-10 bg-gradient-to-r from-violet via-purple-600 to-indigo-500 px-5 py-4 text-center">
          <h2 className="font-display font-black text-white text-base uppercase tracking-widest drop-shadow-sm">
            🎁 Wishlist
          </h2>
        </div>

        <div className="relative p-5 flex flex-col gap-2">
          <WishlistHeader coins={coins} />

          {/* Load error with retry */}
          {loadError && (
            <div className="flex flex-col items-center gap-2 py-6">
              <p className="text-sm text-slate-400 font-body">{loadError}</p>
              <button
                onClick={loadWishes}
                className="text-xs font-bold text-violet hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Wishes list */}
          {!loadError && (
            <>
              {loading ? (
                <div className="flex flex-col gap-2">
                  <WishSkeleton />
                  <WishSkeleton />
                  <WishSkeleton />
                </div>
              ) : (
                <>
                  {/* Filter chips — only shown when there are wishes */}
                  {visibleWishes.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap pt-1">
                      {(["all", ...presentStatuses] as const).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFilterStatus(s)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                            filterStatus === s
                              ? "bg-violet text-white border-violet"
                              : "bg-white text-slate-400 border-slate-200 hover:border-violet/40 hover:text-violet"
                          }`}
                        >
                          {FILTER_LABEL[s]}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Scrollable list — capped at ~4 rows */}
                  <div className={`flex flex-col gap-2 ${visibleWishes.length > 4 ? "max-h-[272px] overflow-y-auto pr-0.5" : ""}`}>
                    {filteredWishes.length === 0 ? (
                      <p className="text-center text-slate-300 text-sm font-body py-6">
                        {visibleWishes.length === 0
                          ? "No wishes yet — add one below!"
                          : "No wishes match this filter."}
                      </p>
                    ) : (
                      filteredWishes.map(w => (
                        <WishRow
                          key={w.id}
                          wish={w}
                          isNewlyApproved={glowingIds.has(w.id)}
                          onRedeem={handleRedeem}
                          redeemError={redeemErrors[w.id] ?? null}
                        />
                      ))
                    )}
                  </div>

                  <RejectedSection wishes={rejectedWishes} />
                </>
              )}
            </>
          )}

          <AddWishForm onAdd={handleAddWish} />
        </div>
      </div>
    </>
  );
}
