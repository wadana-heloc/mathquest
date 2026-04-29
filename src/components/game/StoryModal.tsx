"use client";

import { useState } from "react";

const DEFAULT_STORY = `Once upon a time in the land of Numbers…

🌊 Zone 1: Pebble Shore

The brave young adventurer arrived at the misty shores of Pebble Shore. The waves carried numbers back and forth, and the legendary Tidal Sentinel guarded the ancient arithmetic scrolls.

"To pass," rumbled the Sentinel, "you must master the art of addition and subtraction through 20!"

Our hero picked up the first pebble — it glimmered with the number 7. Another pebble rolled over, showing 8. Together they made... 15! The Sentinel nodded with a smile. ✨

The adventure had only just begun. More zones awaited beyond the horizon, each hiding its own mystery and its own mathematical magic.

🔮 Echo Caves, ⛰️ Iron Summit, and many more secrets lie ahead…

Keep solving, brave adventurer. The Number Wilds are counting on you! 🌟`;

interface StoryButtonProps {
  story?: string;
}

export function StoryButton({ story }: StoryButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-600 font-display font-bold text-sm px-3 py-2 rounded-full border-2 border-amber-200 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
        aria-label="Open story"
      >
        <span className="text-base leading-none animate-float-logo inline-block">📖</span>
        <span className="hidden sm:inline text-xs">Story</span>
      </button>

      {open && <StoryModal onClose={() => setOpen(false)} story={story} />}
    </>
  );
}

export function StoryModal({
  onClose,
  story = DEFAULT_STORY,
}: {
  onClose: () => void;
  story?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Storybook card */}
      <div className="relative z-10 bg-amber-50 rounded-3xl max-w-md w-full shadow-2xl border-4 border-amber-300 animate-fade-slide-up overflow-hidden">
        {/* Book spine accent */}
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-400" />

        {/* Header */}
        <div className="bg-gradient-to-r from-amber-400 to-amber-300 pl-6 pr-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-float-logo inline-block">📖</span>
            <h2
              id="story-title"
              className="font-display font-black text-amber-900 text-lg"
            >
              MathQuest Story
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-amber-200 hover:bg-white text-amber-800 font-bold flex items-center justify-center transition-all duration-200 hover:scale-110 text-sm flex-shrink-0"
            aria-label="Close story"
          >
            ✕
          </button>
        </div>

        {/* Story text */}
        <div className="pl-8 pr-6 py-6 max-h-[55vh] overflow-y-auto scrollbar-thin">
          <p className="font-body text-gray-700 leading-relaxed whitespace-pre-line text-base">
            {story}
          </p>
        </div>

        {/* Footer page dots */}
        <div className="bg-amber-100 pl-8 pr-6 py-3 flex items-center justify-between border-t-2 border-amber-200">
          <span className="text-amber-400 text-xs font-body italic">Chapter 1</span>
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${i === 0 ? "bg-amber-500 scale-125" : "bg-amber-200"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
