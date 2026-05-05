import Phaser from 'phaser'

// ─── Audio File Registry ──────────────────────────────────────────────────────
//
// SFX  → /public/audio/sfx/<key>.wav
// Music → /public/audio/music/<key>.mp3
//
// Placeholder files (0-byte) are committed so the directory structure exists.
// Replace them with real audio to enable sound. Keys that fail to decode are
// silently skipped — no errors, no crashes.

export type SfxKey =
  | 'jump'          // soft whoosh — player leaves ground
  | 'land'          // subtle thud — player lands on ground or platform
  | 'collision'     // soft bump — obstacle blocks player path
  | 'correct'       // bright chime — correct answer given
  | 'wrong'         // soft error tone — wrong answer given
  | 'collect'       // sparkle ding — star collected
  | 'streak'        // rising combo tone — streak counter increases
  | 'boss_appear'   // deep whoosh + rumble — boss phase 1 starts
  | 'boss_phase'    // impact pulse — boss phase 2 or 3 begins
  | 'zone_complete' // short victory fanfare — zone fully cleared

export type MusicKey =
  | 'bg_main'    // calm ocean adventure loop — normal gameplay
  | 'bg_boss'    // intense rhythmic loop — boss fight
  | 'bg_victory' // short uplifting loop — victory screen

// Phaser asset keys map to public paths. Do not change keys — they're used throughout the scene.

const SFX_FILES: Record<SfxKey, string> = {
  jump:          '/audio/sfx/jump.wav',
  land:          '/audio/sfx/land.wav',
  collision:     '/audio/sfx/collision.wav',
  correct:       '/audio/sfx/correct.wav',
  wrong:         '/audio/sfx/wrong.wav',
  collect:       '/audio/sfx/collect.wav',
  streak:        '/audio/sfx/streak.wav',
  boss_appear:   '/audio/sfx/boss_appear.wav',
  boss_phase:    '/audio/sfx/boss_phase.wav',
  zone_complete: '/audio/sfx/zone_complete.wav',
}

const MUSIC_FILES: Record<MusicKey, string> = {
  bg_main:    '/audio/music/bg_main.mp3',
  bg_boss:    '/audio/music/bg_boss.mp3',
  bg_victory: '/audio/music/bg_victory.mp3',
}

export class AudioManager {
  // Phaser scene reference for sound playback and cache access.
  private scene: Phaser.Scene
  private currentMusic: Phaser.Sound.BaseSound | null = null

  // currentMusicKey tracks the INTENDED track so we can resume after unmuting,
  // even if currentMusic is null because the file was unavailable or music was paused.
  private currentMusicKey: MusicKey | null = null

  // Default volumes — balanced for non-intrusive ocean/adventure feel.
  private sfxVolume   = 0.65
  private musicVolume = 0.20

  // Separate mute flags so SFX and music can be toggled independently.
  private _sfxMuted   = false
  private _musicMuted = false

  // Note: This class does not persist settings to localStorage or sync with React state.
  // The AudioControlModal component manages that separately and calls the appropriate setters on this class.
  // This class focuses solely on managing Phaser audio playback based on the current settings.
  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // ── Preload (static) ──────────────────────────────────────────────────────
  //
  // Call AudioManager.preload(this) inside the Phaser scene's preload() method.
  // Registers all SFX and music keys. Files that fail to decode (e.g., placeholders)
  // are not added to the audio cache and will be silently skipped when played.
  static preload(scene: Phaser.Scene): void {
    for (const [key, path] of Object.entries(SFX_FILES)) {
      scene.load.audio(key, path)
    }
    for (const [key, path] of Object.entries(MUSIC_FILES)) {
      scene.load.audio(key, path)
    }
  }

  // ── Play SFX ──────────────────────────────────────────────────────────────
  //
  // Usage:  this.audio.playSfx('jump')
  //         this.audio.playSfx('land', 0.5)   // 50% of sfxVolume
  //
  // Silent no-op when SFX muted, key not in cache, or AudioContext not unlocked.
  playSfx(key: SfxKey, volumeMultiplier = 1.0): void {
    if (this._sfxMuted || !this.scene.sound) return
    if (!this.scene.cache.audio.exists(key)) return
    try {
      this.scene.sound.play(key, { volume: this.sfxVolume * volumeMultiplier })
    } catch {
      // Unexpected sound error — skip silently
      
    }
  }

  // ── Play Music (looped) ───────────────────────────────────────────────────
  //
  // Usage:  this.audio.playMusic('bg_main')
  //
  // No-op if the same track is already the intended track.
  // Stops the current track and starts the new one (if music is unmuted).
  playMusic(key: MusicKey): void {
    if (this.currentMusicKey === key) return
    this._pauseActive()
    // Remember intent even when muted — so unmuting resumes the right track
    this.currentMusicKey = key
    if (!this._musicMuted) this._startActive()
  }

  // ── Stop Music ────────────────────────────────────────────────────────────
  // Stops playback and clears the intended track key.
  stopMusic(): void {
    this._pauseActive()
    this.currentMusicKey = null
  }

  // ── Mute controls ─────────────────────────────────────────────────────────

  // Mute/unmute SFX only.
  setSfxMuted(muted: boolean): void {
    this._sfxMuted = muted
  }

  // Mute/unmute background music only.
  // Pauses playback immediately when muting; resumes the intended track when unmuting.
  setMusicMuted(muted: boolean): void {
    if (this._musicMuted === muted) return
    this._musicMuted = muted
    if (muted) {
      this._pauseActive()
    } else if (this.currentMusicKey) {
      this._startActive()
    }
  }

  // Shortcut to mute/unmute both at once.
  setMuted(muted: boolean): void {
    this.setSfxMuted(muted)
    this.setMusicMuted(muted)
  }

  // ── Volume controls ───────────────────────────────────────────────────────

  // Set background music volume (0.0 – 1.0). Applies immediately to playing track.
  setMusicVolume(vol: number): void {
    this.musicVolume = Math.max(0, Math.min(1, vol))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = this.currentMusic as any
    if (m && typeof m.setVolume === 'function') m.setVolume(this.musicVolume)
  }

  // Set SFX volume (0.0 – 1.0). Applied on each playSfx call.
  setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol))
  }

  // ── Getters ───────────────────────────────────────────────────────────────
  get isSfxMuted():   boolean          { return this._sfxMuted        }
  get isMusicMuted(): boolean          { return this._musicMuted      }
  get currentTrack(): MusicKey | null  { return this.currentMusicKey  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  // Call in Phaser's shutdown() to release audio resources.
  destroy(): void {
    this._pauseActive()
    this.currentMusicKey = null
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  // Stop and destroy the active Phaser sound instance (preserves currentMusicKey).
  private _pauseActive(): void {
    if (this.currentMusic) {
      try { this.currentMusic.stop()    } catch { /* already stopped   */ }
      try { this.currentMusic.destroy() } catch { /* already destroyed */ }
      this.currentMusic = null
    }
  }

  // Start playing currentMusicKey. Called on playMusic() and on music-unmute.
  private _startActive(): void {
    const key = this.currentMusicKey
    if (!key || !this.scene.sound) return
    if (!this.scene.cache.audio.exists(key)) return
    try {
      this.currentMusic = this.scene.sound.add(key, { loop: true, volume: this.musicVolume })
      this.currentMusic.play()
    } catch {
      this.currentMusic = null
    }
  }
}
