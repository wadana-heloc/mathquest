"use client";

import { useState } from "react";

export function LogoutButton() {
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/signout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-rose-100 hover:bg-rose-200 text-rose-500 font-display font-bold text-sm px-3 py-2 rounded-full border-2 border-rose-200 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
        aria-label="Logout"
      >
        <span className="text-base leading-none">🚪</span>
        <span className="hidden sm:inline text-xs">Leave</span>
      </button>

      {open && (
        <LogoutConfirmModal onClose={() => setOpen(false)} onConfirm={handleLogout} />
      )}
    </>
  );
}

function LogoutConfirmModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative z-10 bg-white rounded-3xl p-8 max-w-xs w-full text-center shadow-2xl border-4 border-rose-100 animate-fade-slide-up">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 font-bold flex items-center justify-center transition-all duration-200 hover:scale-110 text-sm"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="text-5xl mb-3 animate-float-logo inline-block">🚪</div>

        <h2
          id="logout-title"
          className="font-display font-black text-xl text-gray-800 mb-2"
        >
          Going already?
        </h2>
        <p className="text-gray-400 text-sm mb-7 font-body">
          Are you sure you want to leave? 😊
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white font-display font-bold py-3.5 rounded-2xl text-base transition-all duration-200 hover:scale-[1.02] active:scale-95 shadow-lg shadow-rose-100"
          >
            Yes, Logout 👋
          </button>
          <button
            onClick={onClose}
            className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-display font-bold py-3.5 rounded-2xl border-2 border-emerald-200 text-base transition-all duration-200 hover:scale-[1.02] active:scale-95"
          >
            Stay and Play 🎮
          </button>
        </div>
      </div>
    </div>
  );
}
