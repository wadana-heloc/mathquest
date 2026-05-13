"use client";

import { useEffect, useState } from "react";
import { fetchLatestStory, type LatestStory } from "@/lib/child/actions";

// ── "New story" tracking via localStorage ────────────────────────────────────

const STORAGE_KEY = "mq_last_read_story";

export function getLastReadStoryId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

function markStoryAsRead(storyId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, storyId);
}

// ── No story — looks like a closed book cover ─────────────────────────────────

function NoStoryState({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="no-story-title"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-xs animate-fade-slide-up">
        {/* closed book */}
        <div className="flex rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* spine */}
          <div className="w-5 flex-shrink-0 bg-gradient-to-r from-[#0f0600] via-[#2c1408] to-[#0f0600]" />
          {/* cover */}
          <div className="flex-1 bg-gradient-to-br from-[#7a3a10] via-[#5c2a08] to-[#3d1a04] px-6 py-8 text-center space-y-4">
            <div className="relative inline-block">
              <span className="text-6xl animate-float-logo inline-block">📚</span>
              <span className="absolute -bottom-1 -right-2 text-xl">🔒</span>
            </div>
            <div>
              <h2
                id="no-story-title"
                className="font-display font-black text-amber-100 text-lg leading-tight mb-2"
              >
                No Story Yet!
              </h2>
              <p className="text-amber-200/75 text-sm leading-relaxed">
                Ask your{" "}
                <span className="text-yellow-300 font-bold">parents</span> to
                write one for you, then keep playing to unlock it!&nbsp;🌟
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-10 rounded-xl bg-amber-400 text-amber-950 font-display font-black text-sm hover:brightness-110 active:scale-95 transition-all shadow-md"
            >
              Keep Playing! 🚀
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Open book reader ──────────────────────────────────────────────────────────

export function StoryModal({
  onClose,
  story,
}: {
  onClose: () => void;
  story: LatestStory | null;
}) {
  const [chapter, setChapter] = useState(0);

  // Mark story as read as soon as the modal opens
  useEffect(() => {
    if (story) markStoryAsRead(story.id);
  }, [story?.id]);

  if (!story) return <NoStoryState onClose={onClose} />;

  const total = story.chapters.length;
  const text = story.chapters[chapter] ?? "";
  const isFirst = chapter === 0;
  const isLast = chapter === total - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Open book ── */}
      <div className="relative z-10 w-full max-w-3xl max-h-[88vh] animate-fade-slide-up flex shadow-[0_32px_80px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden">

        {/* ── LEFT PAGE (table of contents, desktop only) ── */}
        <div className="hidden sm:flex w-48 flex-shrink-0 bg-[#f5eed9] flex-col border-r border-[#c9b07a]/40">
          {/* header */}
          <div className="px-6 pt-6 pb-4 border-b border-[#d8c48a]/60">
            <p className="text-[#9a7020] text-[10px] font-bold uppercase tracking-widest mb-0.5">
              MathQuest
            </p>
            <h2
              id="story-title"
              className="font-display font-black text-[#2c1a0e] text-lg leading-tight"
            >
              Your Adventure
            </h2>
            <p className="text-[#a08040] text-xs mt-1">{story.word_count} words</p>
          </div>

          {/* chapter list */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
            <p className="text-[#9a7020] text-[10px] font-bold uppercase tracking-widest mb-3">
              Contents
            </p>
            {story.chapters.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setChapter(i)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-3 ${
                  i === chapter
                    ? "bg-amber-700 text-white shadow-sm"
                    : "text-[#5c3a1e] hover:bg-amber-100/80"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${
                    i === chapter
                      ? "bg-white/20 text-white"
                      : "bg-amber-200/80 text-amber-800"
                  }`}
                >
                  {i + 1}
                </span>
                Chapter {i + 1}
                {i < chapter && (
                  <span className="ml-auto text-[10px] text-amber-600/60">✓</span>
                )}
              </button>
            ))}
          </div>

          {/* page number */}
          <div className="px-6 py-3 border-t border-[#d8c48a]/60">
            <p className="text-[#c4a050]/60 text-[10px] text-center font-medium tracking-wider">
              — {chapter + 1} —
            </p>
          </div>
        </div>

        {/* ── SPINE ── */}
        <div className="hidden sm:block w-5 flex-shrink-0 bg-gradient-to-r from-[#0f0600] via-[#3d1f08] to-[#0f0600]">
          <div className="h-full w-px mx-auto bg-[#6a3010]/20" />
        </div>

        {/* ── RIGHT PAGE (chapter content) ── */}
        <div className="flex-1 bg-[#faf7ee] flex flex-col min-w-0 max-h-[88vh]">

          {/* page header */}
          <div className="px-6 pt-5 pb-4 border-b border-[#d8c48a]/60 flex items-start justify-between flex-shrink-0">
            <div>
              {/* mobile-only title */}
              <p className="sm:hidden text-[#9a7020] text-[10px] font-bold uppercase tracking-widest mb-0.5">
                Your Adventure
              </p>
              <p className="text-[#9a7020] text-[10px] font-bold uppercase tracking-widest">
                Chapter {chapter + 1} of {total}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 rounded-full bg-[#e8dcc4] hover:bg-[#d8c8a8] text-[#6b4020] text-xs font-black flex items-center justify-center transition-all hover:scale-110 active:scale-90 flex-shrink-0 ml-3"
            >
              ✕
            </button>
          </div>

          {/* segmented progress bar */}
          <div className="flex gap-px flex-shrink-0 h-1 bg-[#e8dcc4]">
            {story.chapters.map((_, i) => (
              <div
                key={i}
                className={`flex-1 transition-colors duration-300 ${
                  i <= chapter ? "bg-amber-600" : "bg-transparent"
                }`}
              />
            ))}
          </div>

          {/* chapter text — scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* decorative chapter opener */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#c9a850]/40" />
              <span className="text-[#c9a850]/70 text-xs font-bold uppercase tracking-widest">
                Chapter {chapter + 1}
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#c9a850]/40" />
            </div>

            <p className="text-[#1e1008] leading-[2] text-[15px] whitespace-pre-line font-body">
              {text}
            </p>

            {/* decorative chapter closer */}
            <div className="flex justify-center mt-8">
              <span className="text-[#c9a850]/40 text-lg">✦</span>
            </div>
          </div>

          {/* navigation footer */}
          <div className="px-6 pb-5 pt-4 border-t border-[#d8c48a]/60 flex-shrink-0 space-y-3">
            {/* mobile chapter dots */}
            <div className="flex sm:hidden justify-center gap-1.5">
              {story.chapters.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setChapter(i)}
                  aria-label={`Chapter ${i + 1}`}
                  className={`rounded-full transition-all ${
                    i === chapter
                      ? "w-6 h-2 bg-amber-700"
                      : "w-2 h-2 bg-[#d8c48a] hover:bg-amber-400"
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setChapter((c) => c - 1)}
                disabled={isFirst}
                className="flex-1 h-9 rounded-xl border border-[#c4a050]/50 bg-[#f0e8cc] text-[#5c3a1e] text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e8d8a8] active:scale-95 transition-all"
              >
                ← Prev
              </button>

              {isLast ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-[1.6] h-9 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-display font-black active:scale-95 transition-all shadow-sm"
                >
                  Finish 🌟
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setChapter((c) => c + 1)}
                  className="flex-[1.6] h-9 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-display font-black active:scale-95 transition-all shadow-sm"
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Self-contained button for the game hub toolbar ────────────────────────────

export function StoryButton() {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [story, setStory]     = useState<LatestStory | null | undefined>(undefined);
  const [isNew, setIsNew]     = useState(false);

  // Background check on mount — show badge if story hasn't been read yet
  useEffect(() => {
    fetchLatestStory().catch(() => null).then(s => {
      if (s && s.id !== getLastReadStoryId()) setIsNew(true);
    });
  }, []);

  async function handleOpen() {
    setIsNew(false);
    setOpen(true);
    if (story === undefined) {
      setLoading(true);
      const s = await fetchLatestStory().catch(() => null);
      setStory(s);
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Open story"
        className="relative flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 font-display font-bold text-sm px-3 py-2 rounded-full border-2 border-amber-200 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
      >
        <span className="text-base leading-none animate-float-logo inline-block">📖</span>
        <span className="hidden sm:inline text-xs">Story</span>
        {isNew && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
        )}
      </button>

      {open && loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <span className="text-5xl animate-float-logo inline-block">📖</span>
            <span className="text-white/80 font-display font-bold text-sm animate-pulse">
              Loading your story…
            </span>
          </div>
        </div>
      )}

      {open && !loading && (
        <StoryModal story={story ?? null} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
