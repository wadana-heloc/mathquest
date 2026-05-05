'use client'

import { useState, useEffect } from 'react'

// ─── Shared constants ─────────────────────────────────────────────────────────
// Used by: AudioControls (writes), game/page.tsx (reads), Zone1Scene (reads)

export const AUDIO_EVENT   = 'mq:audioSettings'   // CustomEvent dispatched on every change
export const AUDIO_STORAGE = 'mq_audio_settings'  // localStorage key

export interface AudioSettings {
  musicMuted: boolean
  sfxMuted:   boolean
}

export function loadAudioSettings(): AudioSettings {
  if (typeof window === 'undefined') return { musicMuted: false, sfxMuted: false }
  try {
    const raw = localStorage.getItem(AUDIO_STORAGE)
    if (raw) return JSON.parse(raw) as AudioSettings
  } catch { /* ignore */ }
  return { musicMuted: false, sfxMuted: false }
}

function saveAndBroadcast(s: AudioSettings) {
  try { localStorage.setItem(AUDIO_STORAGE, JSON.stringify(s)) } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(AUDIO_EVENT, { detail: s }))
}

// ─── Modal content ────────────────────────────────────────────────────────────

function AudioModal({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<AudioSettings>(loadAudioSettings)

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (patch: Partial<AudioSettings>) => {
    setS(prev => {
      const next = { ...prev, ...patch }
      saveAndBroadcast(next)
      return next
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card — same structure as SettingsModal */}
      <div className="relative z-10 bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border-4 border-teal-100 animate-fade-slide-up">

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 font-bold flex items-center justify-center transition-all duration-200 hover:scale-110 text-sm"
          aria-label="Close audio settings"
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-4xl text-center mb-1 animate-float-logo inline-block w-full">
          {s.musicMuted && s.sfxMuted ? '🔇' : '🎵'}
        </div>
        <h2
          id="audio-modal-title"
          className="font-display font-black text-xl text-gray-800 text-center mb-6"
        >
          Audio Settings
        </h2>

        {/* Two toggle buttons side by side */}
        <div className="grid grid-cols-2 gap-4">

          {/* Music toggle */}
          <button
          
            type="button"
            onClick={() => toggle({ musicMuted: !s.musicMuted })}
            aria-pressed={!s.musicMuted ? 'true' : 'false'}
            aria-label={s.musicMuted ? 'Unmute background music' : 'Mute background music'}
            className={[
              'flex flex-col items-center gap-3 rounded-2xl border-2 py-6 px-4',
              'font-display font-bold transition-all duration-200',
              'hover:scale-[1.03] active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-1',
              !s.musicMuted
                ? 'bg-teal-50 border-teal-300 text-teal-700 shadow-md shadow-teal-100 focus:ring-teal-400'
                : 'bg-gray-100 border-gray-300 text-gray-600 focus:ring-gray-300',
            ].join(' ')}
          >
            <span className={`text-4xl leading-none transition-opacity duration-200 ${s.musicMuted ? 'opacity-30' : ''}`}>
              🎵
            </span>
            <div className="text-center">
              <p className="text-sm leading-tight">Music</p>
              <p className={`text-xs font-body mt-0.5 ${!s.musicMuted ? 'text-teal-500' : 'text-gray-500'}`}>
                {s.musicMuted ? 'Off' : 'On'}
              </p>
            </div>
            {/* State dot */}
            <span className={`w-2 h-2 rounded-full transition-colors duration-200 ${!s.musicMuted ? 'bg-teal-400' : 'bg-gray-300'}`} />
          </button>

          {/* SFX toggle */}
          <button
            type="button"
            onClick={() => toggle({ sfxMuted: !s.sfxMuted })}
            aria-pressed={!s.sfxMuted ? 'true' : 'false'}
            aria-label={s.sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
            className={[
              'flex flex-col items-center gap-3 rounded-2xl border-2 py-6 px-4',
              'font-display font-bold transition-all duration-200',
              'hover:scale-[1.03] active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-1',
              !s.sfxMuted
                ? 'bg-teal-50 border-teal-300 text-teal-700 shadow-md shadow-teal-100 focus:ring-teal-400'
                : 'bg-gray-100 border-gray-300 text-gray-600 focus:ring-gray-300',
            ].join(' ')}
          >
            <span className={`text-4xl leading-none transition-opacity duration-200 ${s.sfxMuted ? 'opacity-30' : ''}`}>
              {s.sfxMuted ? '🔇' : '🔊'}
            </span>
            <div className="text-center">
              <p className="text-sm leading-tight">SFX</p>
              <p className={`text-xs font-body mt-0.5 ${!s.sfxMuted ? 'text-teal-500' : 'text-gray-500'}`}>
                {s.sfxMuted ? 'Off' : 'On'}
              </p>
            </div>
            {/* State dot */}
            <span className={`w-2 h-2 rounded-full transition-colors duration-200 ${!s.sfxMuted ? 'bg-teal-400' : 'bg-gray-300'}`} />
          </button>

        </div>

        <p className="text-center text-gray-300 text-[10px] font-body mt-5">
          Settings are saved automatically
        </p>
      </div>
    </div>
  )
}

// ─── Public trigger button ─────────────────────────────────────────────────────
// A single pill button that opens the AudioModal.
// Styled to match SettingsButton / StoryButton in the lobby toolbar.
//
// Usage:
//   <AudioControls />

export function AudioControls() {
  const [open, setOpen] = useState(false)
  const [s, setS] = useState<AudioSettings>({ musicMuted: false, sfxMuted: false })

  // Keep button icon in sync with live setting changes
  useEffect(() => {
    setS(loadAudioSettings())
    const handler = (e: Event) => setS((e as CustomEvent<AudioSettings>).detail)
    window.addEventListener(AUDIO_EVENT, handler)
    return () => window.removeEventListener(AUDIO_EVENT, handler)
  }, [])

  const bothMuted = s.musicMuted && s.sfxMuted

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 text-teal-600 font-display font-bold text-sm px-3 py-2 rounded-full border-2 border-teal-200 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
        aria-label="Open audio settings"
      >
        <span className="text-base leading-none">{bothMuted ? '🔇' : '🎵'}</span>
        <span className="text-xs">Audio</span>
      </button>

      {open && <AudioModal onClose={() => setOpen(false)} />}
    </>
  )
}
