"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";

interface SettingsButtonProps {
  initialName?: string;
  onSaved?: (name: string) => void;
}

export function SettingsButton({ initialName, onSaved }: SettingsButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-violet-100 hover:bg-violet-200 text-violet-600 font-display font-bold text-sm px-3 py-2 rounded-full border-2 border-violet-200 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
        aria-label="Open settings"
      >
        <span className="text-base leading-none">⚙️</span>
        <span className="hidden sm:inline text-xs">Settings</span>
      </button>

      {open && (
        <SettingsModal
          initialName={initialName}
          onClose={() => setOpen(false)}
          onSaved={(name) => {
            onSaved?.(name);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

export function SettingsModal({
  initialName = "",
  onClose,
  onSaved,
}: {
  initialName?: string;
  onClose: () => void;
  onSaved?: (name: string) => void;
}) {
  const { user } = useUser();
  const [name, setName] = useState(initialName);
  const [dob, setDob] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("users")
        .update({ display_name: name.trim() })
        .eq("id", user.id);
      if (updateError) throw updateError;
      setSaved(true);
      setTimeout(() => onSaved?.(name.trim()), 700);
    } catch {
      setError("Oops! Couldn't save. Try again 😅");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative z-10 bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border-4 border-violet-100 animate-fade-slide-up">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 font-bold flex items-center justify-center transition-all duration-200 hover:scale-110 text-sm"
          aria-label="Close settings"
        >
          ✕
        </button>

        <div className="text-4xl text-center mb-1 animate-float-logo inline-block w-full">⚙️</div>
        <h2
          id="settings-title"
          className="font-display font-black text-xl text-gray-800 text-center mb-6"
        >
          My Settings
        </h2>

        <div className="flex flex-col gap-5">
          {/* Name field */}
          <div>
            <label
              htmlFor="settings-name"
              className="block text-xs font-bold text-violet-500 uppercase tracking-wider mb-1.5"
            >
              Your Name ✏️
            </label>
            <input
              id="settings-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setSaved(false); }}
              placeholder="Enter your name…"
              className="w-full bg-violet-50 border-2 border-violet-200 focus:border-violet-400 rounded-2xl px-4 py-3 text-gray-700 font-display font-semibold text-base outline-none transition-colors placeholder:text-gray-300"
            />
          </div>

          {/* DOB field */}
          <div>
            <label
              htmlFor="settings-dob"
              className="block text-xs font-bold text-violet-500 uppercase tracking-wider mb-1.5"
            >
              Birthday 🎂
            </label>
            <input
              id="settings-dob"
              type="date"
              value={dob}
              onChange={(e) => { setDob(e.target.value); setSaved(false); }}
              className="w-full bg-violet-50 border-2 border-violet-200 focus:border-violet-400 rounded-2xl px-4 py-3 text-gray-700 font-display font-semibold text-base outline-none transition-colors"
            />
          </div>

          {error && (
            <p className="text-rose-500 text-sm text-center font-body">{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className={[
              "w-full font-display font-bold py-3.5 rounded-2xl text-base",
              "transition-all duration-200 hover:scale-[1.02] active:scale-95",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              saved
                ? "bg-game-green text-white shadow-lg"
                : "bg-violet text-white hover:opacity-90 shadow-lg shadow-violet/20",
            ].join(" ")}
          >
            {saving ? "Saving…" : saved ? "Saved! ✓" : "Save Changes 💾"}
          </button>
        </div>
      </div>
    </div>
  );
}
