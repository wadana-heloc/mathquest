// ─────────────────────────────────────────────────────────────
//  MathQuest · src/lib/phaser/Zone2Scene.ts  — Zone 2 "Echo Caves"
//
//  A dark, magical cave adventure with glowing crystals, stalactites,
//  and Echo the Crystal Bat as your companion.
//
//  Architecture mirrors Zone1Scene exactly so the React layer
//  (Zone2Game.tsx) can follow the same event-bridge pattern.
//
//  Key design principles:
//    • Stars → Cave Crystals 💎 (collectible, earned = solvedCount)
//    • Companion: Echo the Crystal Bat — flies above the player
//    • Boss: The Stone Warden — a crystal golem with shard attacks
//    • Environment: dark cave, stalactites, glowing crystals, mushrooms
//    • Wrong-answer: neutral flash, never shame
// ─────────────────────────────────────────────────────────────

import Phaser from 'phaser'
import { AudioManager } from './AudioManager'

export const ZONE2_EVENTS = {
  SHOW_PROBLEM:    'zone2:showProblem',
  ANSWER_RESULT:   'zone2:answerResult',
  ZONE_COMPLETE:   'zone2:zoneComplete',
  BOSS_PHASE:      'zone2:bossPhase',
  PROGRESS:        'zone2:progress',
  STREAK_INCREASE: 'zone2:streakIncrease',
}

function dispatchToReact(name: string, detail: object) {
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

interface ObstacleConfig {
  id: string
  problemId: string
  x: number
  label: string
  emoji: string
  color: number
  width: number
  height: number
}

const OBSTACLES: ObstacleConfig[] = [
  { id: 'obj1', problemId: 'Z2-OBJ-01', x: 600,  label: 'Bat Colony',  emoji: '🦇', color: 0x7C3AED, width: 70,  height: 60  },
  { id: 'obj2', problemId: 'Z2-OBJ-02', x: 1000, label: 'Crystal',     emoji: '💎', color: 0x06B6D4, width: 60,  height: 80  },
  { id: 'obj3', problemId: 'Z2-OBJ-03', x: 1420, label: 'Spider Web',  emoji: '🕸️', color: 0x6B21A8, width: 90,  height: 70  },
  { id: 'obj4', problemId: 'Z2-OBJ-04', x: 1850, label: 'Boulder',     emoji: '🪨', color: 0x78716C, width: 80,  height: 70  },
  { id: 'obj5', problemId: 'Z2-OBJ-05', x: 2280, label: 'Mushroom',    emoji: '🍄', color: 0xEF4444, width: 70,  height: 80  },
  { id: 'obj6', problemId: 'Z2-OBJ-06', x: 2720, label: 'Ice Crystal', emoji: '🧊', color: 0x38BDF8, width: 80,  height: 70  },
  { id: 'obj7', problemId: 'Z2-OBJ-07', x: 3160, label: 'Cave Lizard', emoji: '🦎', color: 0x22C55E, width: 70,  height: 60  },
  { id: 'obj8', problemId: 'Z2-OBJ-08', x: 3600, label: 'Crystal Orb', emoji: '🔮', color: 0x8B5CF6, width: 60,  height: 80  },
]

const BOSS_X         = 4200
const WORLD_WIDTH    = 4800
const GROUND_Y_RATIO = 0.80

interface PlatformConfig {
  x: number
  yRatio: number
  width: number
  bob?: number
  emoji?: string
}

// Crystal ledge platforms placed between obstacles
const PLATFORMS: PlatformConfig[] = [
  { x: 320,  yRatio: 0.68, width: 120, bob: 3,  emoji: '💜' },
  { x: 780,  yRatio: 0.65, width: 130, bob: 3,  emoji: '✨' },
  { x: 1210, yRatio: 0.66, width: 120, bob: 4,  emoji: '💎' },
  { x: 1630, yRatio: 0.64, width: 130, bob: 3              },
  { x: 2060, yRatio: 0.67, width: 120, bob: 4,  emoji: '🌟' },
  { x: 2490, yRatio: 0.65, width: 140, bob: 3              },
  { x: 2930, yRatio: 0.63, width: 130, bob: 4,  emoji: '💜' },
  { x: 3370, yRatio: 0.66, width: 120, bob: 3,  emoji: '✨' },
  { x: 3810, yRatio: 0.64, width: 130, bob: 3              },
  { x: 4010, yRatio: 0.68, width: 110, bob: 4,  emoji: '💎' },
]

// Cave crystals (replacing stars) — collectible by jumping
const CRYSTAL_POSITIONS: { x: number; yRatio: number }[] = [
  { x: 320,  yRatio: 0.61 },
  { x: 780,  yRatio: 0.58 },
  { x: 1210, yRatio: 0.59 },
  { x: 1630, yRatio: 0.57 },
  { x: 2060, yRatio: 0.60 },
  { x: 2490, yRatio: 0.58 },
  { x: 2930, yRatio: 0.56 },
  { x: 3370, yRatio: 0.59 },
  { x: 3810, yRatio: 0.57 },
  { x: 4010, yRatio: 0.61 },
  { x: 450,  yRatio: 0.70 },
  { x: 900,  yRatio: 0.72 },
]

// Companion messages — Echo the Crystal Bat
const COMPANION_MESSAGES = {
  start:         ["I'm Echo! 🦇", "Let's explore! ✨", "The caves await! 💫"],
  approach:      ["A puzzle! 🧩", "Think carefully! 🧠", "You've got this! ⚡"],
  correct:       ["BRILLIANT! 🎉", "Echoes of genius! 🌟", "Crystal clear! 💎", "Magnificent! ✨"],
  wrong:         ["Try again! 💪", "So close! 🦇", "Keep going! 💫"],
  jump:          ["Wheee! 🦇", "High flyer! ✨", "Like a bat! 🦇"],
  bossNear:      ["The Warden! 👀", "Stay strong! ⚔️", "I believe in you! 💖"],
  crystalCollect:["A crystal! 💎", "It glows! ✨", "So beautiful! 🌟"],
  idle:          ["*echo*... 🦇", "Hear that drip? 💧", "The cave breathes..."],
}

export class Zone2Scene extends Phaser.Scene {
  // ── Dimensions ─────────────────────────────────────────────
  private worldWidth!: number
  private groundY!:    number
  private screenW!:    number
  private screenH!:    number

  // ── Player ─────────────────────────────────────────────────
  private player!:         Phaser.GameObjects.Container
  private playerVelX     = 0
  private playerVelY     = 0
  private playerOnGround = true
  private playerX        = 120
  private playerY        = 0
  private facingRight    = true
  private isRunning      = false
  private legL!:           Phaser.GameObjects.Rectangle
  private legR!:           Phaser.GameObjects.Rectangle
  private legTimer       = 0

  // ── Blocking flags ─────────────────────────────────────────
  private obstacleBlocked = false
  private bossBlocked     = false
  private get isBlocked() { return this.obstacleBlocked || this.bossBlocked }

  // ── Cooldown flags ─────────────────────────────────────────
  private obsCooldown        = false
  private interPhaseCooldown = false

  // ── Input ──────────────────────────────────────────────────
  private cursors!:  Phaser.Types.Input.Keyboard.CursorKeys
  private keyA!:     Phaser.Input.Keyboard.Key
  private keyD!:     Phaser.Input.Keyboard.Key
  private keyW!:     Phaser.Input.Keyboard.Key
  private keySpace!: Phaser.Input.Keyboard.Key

  // ── Touch ─────────────────────────────────────────────────
  public touchLeft  = false
  public touchRight = false
  public touchJump  = false

  // ── Obstacle state ─────────────────────────────────────────
  private obstacleObjects: Map<string, {
    container: Phaser.GameObjects.Container
    config:    ObstacleConfig
    solved:    boolean
  }> = new Map()
  private solvedCount  = 0
  private activeObsId: string | null = null

  // ── Boss state ─────────────────────────────────────────────
  private bossContainer!:  Phaser.GameObjects.Container
  private bossPhase        = 0
  private activeBossPhase  = 0
  private bossHP:            Phaser.GameObjects.Rectangle[] = []
  private bossEyeL!:         Phaser.GameObjects.Arc
  private bossEyeR!:         Phaser.GameObjects.Arc
  private bossPupilL!:       Phaser.GameObjects.Arc
  private bossPupilR!:       Phaser.GameObjects.Arc

  // ── Boss shard attacks ─────────────────────────────────────
  private bossProjectiles: {
    obj:     Phaser.GameObjects.Text
    velX:    number
    velY:    number
    bounces: number
  }[] = []
  private bossAttackTimer    = 0
  private bossAttackInterval = 2600

  // ── Companion — Echo the Crystal Bat ──────────────────────
  private companion!:            Phaser.GameObjects.Container
  private companionX             = 80
  private companionTargetX       = 80
  private companionY             = 0
  private companionTime          = 0
  private companionEmoteTween:   Phaser.Tweens.Tween | null = null
  private companionSpeechBubble!: Phaser.GameObjects.Container
  private companionSpeechText!:   Phaser.GameObjects.Text
  private companionIdleTimer     = 0
  private companionWingL!:        Phaser.GameObjects.Triangle
  private companionWingR!:        Phaser.GameObjects.Triangle

  // ── Platforms ─────────────────────────────────────────────
  private platformObjects: {
    container: Phaser.GameObjects.Container
    worldX:    number
    baseY:     number
    width:     number
    bob:       number
    bobTime:   number
  }[] = []

  // ── Cave Crystals (collectible) ────────────────────────────
  private crystalObjects: {
    obj:       Phaser.GameObjects.Text
    x:         number
    y:         number
    collected: boolean
    glowRing?: Phaser.GameObjects.Arc
  }[] = []
  private crystalsCollected = 0
  private crystalHUD!:      Phaser.GameObjects.Container
  private crystalCountText!: Phaser.GameObjects.Text

  // ── Environment ────────────────────────────────────────────
  // Drip timer for animated cave drips
  private dripTimer = 0
  private activeDrips: {
    obj: Phaser.GameObjects.Arc
    velY: number
    x: number
  }[] = []

  // ── Instructions ──────────────────────────────────────────
  private instructionsShown = false

  // ── Cleanup ────────────────────────────────────────────────
  private answerListener!:        (e: Event) => void
  private streakListener!:        (e: Event) => void
  private audioSettingsListener!: (e: Event) => void

  // ── Audio ──────────────────────────────────────────────────
  private audio!: AudioManager

  constructor() { super({ key: 'Zone2Scene' }) }

  preload() {
    AudioManager.preload(this)
  }

  // ═══════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════

  create() {
    this.screenW    = this.scale.width
    this.screenH    = this.scale.height
    this.worldWidth = WORLD_WIDTH
    this.groundY    = this.screenH * GROUND_Y_RATIO
    this.playerY    = this.groundY - 40
    this.companionY = this.playerY - 80
    ;(window as any).__zone2Scene = this

    this.createCaveBackground()
    this.createCaveCeiling()
    this.createStalactites()
    this.createCaveGlow()
    this.createGround()
    this.createZoneSign()
    this.createPlatforms()
    this.createCrystals()
    this.createObstacles()
    this.createBoss()
    this.createBats()
    this.createPlayer()
    this.createCompanion()
    this.createCrystalHUD()

    this.cursors  = this.input.keyboard!.createCursorKeys()
    this.keyA     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.keyD     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    this.keyW     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W)
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    this.answerListener = (e: Event) => {
      const { correct, obstacleId } = (e as CustomEvent).detail
      this.handleAnswerResult(correct, obstacleId)
    }
    window.addEventListener(ZONE2_EVENTS.ANSWER_RESULT, this.answerListener)

    this.cameras.main.setBounds(0, 0, this.worldWidth, this.screenH)
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08)

    this.time.delayedCall(800, () => this.showInstructions())
    this.time.delayedCall(200, () =>
      dispatchToReact(ZONE2_EVENTS.PROGRESS, { solved: 0, total: 8 })
    )
    this.time.delayedCall(5000, () => this.startCompanionIdleChatter())

    this.audio = new AudioManager(this)

    const MQ_AUDIO_STORAGE = 'mq_audio_settings'
    try {
      const raw = localStorage.getItem(MQ_AUDIO_STORAGE)
      if (raw) {
        const { sfxMuted, musicMuted } = JSON.parse(raw)
        this.audio.setSfxMuted(!!sfxMuted)
        this.audio.setMusicMuted(!!musicMuted)
      }
    } catch { /* ignore */ }

    this.audio.playMusic('bg_main')

    this.audioSettingsListener = (e: Event) => {
      const { sfxMuted, musicMuted } = (e as CustomEvent<{ sfxMuted: boolean; musicMuted: boolean }>).detail
      this.audio.setSfxMuted(sfxMuted)
      this.audio.setMusicMuted(musicMuted)
    }
    window.addEventListener('mq:audioSettings', this.audioSettingsListener)

    this.streakListener = () => this.audio.playSfx('streak')
    window.addEventListener(ZONE2_EVENTS.STREAK_INCREASE, this.streakListener)
  }

  // ═══════════════════════════════════════════════════════════
  // SHUTDOWN
  // ═══════════════════════════════════════════════════════════

  shutdown() {
    window.removeEventListener(ZONE2_EVENTS.ANSWER_RESULT, this.answerListener)
    window.removeEventListener(ZONE2_EVENTS.STREAK_INCREASE, this.streakListener)
    window.removeEventListener('mq:audioSettings', this.audioSettingsListener)
    this.audio?.destroy()
    ;(window as any).__zone2Scene = null
    const el = document.getElementById('mq-instructions')
    if (el && el.parentNode) el.parentNode.removeChild(el)
  }

  static safeDestroy(game: Phaser.Game | null) {
    if (!game || !game.renderer) return
    try { game.destroy(true, false) } catch (_) { /* already destroyed */ }
  }

  // ═══════════════════════════════════════════════════════════
  // INSTRUCTIONS PANEL
  // ═══════════════════════════════════════════════════════════

  private showInstructions() {
    if (this.instructionsShown) return
    this.instructionsShown = true

    const overlay = document.createElement('div')
    overlay.id = 'mq-instructions'
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(4,2,26,0.92);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Nunito', 'Segoe UI', sans-serif;
    `

    overlay.innerHTML = `
      <div style="
        background: #0a0530;
        border: 3px solid #8b5cf6;
        border-radius: 20px;
        padding: 28px 32px;
        max-width: 560px; width: 92vw;
        box-shadow: 0 0 40px rgba(139,92,246,0.35), 0 0 80px rgba(6,182,212,0.15);
        position: relative;
      ">
        <div style="
          position: absolute; top: 0; left: 0; right: 0; height: 60px;
          background: linear-gradient(90deg,#1e0a5e,#0d1f6b);
          border-radius: 17px 17px 0 0;
        "></div>

        <h2 style="
          position: relative; text-align: center; margin: 0 0 22px 0;
          font-size: 22px; font-weight: 900; color: #c4b5fd;
          text-shadow: 0 0 18px rgba(167,139,250,0.8);
        ">🦇 ECHO CAVES 🦇</h2>

        <table style="width:100%; border-collapse: collapse; position: relative;">
          ${[
            ['⬅️ ➡️',  'Arrow keys or A / D',  'to walk through the cave'],
            ['⬆️',      'Up arrow or Space',     'to jump onto crystal ledges'],
            ['🧩',      'Walk into obstacles',   'to get a math puzzle'],
            ['✅',      'Solve the puzzle',      'earn a coin &amp; walk on'],
            ['💎',      'Collect crystals',      'by jumping to ledges'],
            ['🦇',      'Echo the Bat',          'cheers you on!'],
            ['👑',      'Defeat the Warden',     'to complete the zone!'],
          ].map(([icon, bold, rest], i, arr) => `
            <tr style="border-bottom: ${i < arr.length - 1 ? '1px solid rgba(139,92,246,0.15)' : 'none'}">
              <td style="padding: 9px 10px 9px 0; font-size: 20px; width: 42px;">${icon}</td>
              <td style="padding: 9px 8px; font-size: 14px; font-weight: 800; color: #c4b5fd; white-space: nowrap;">${bold}</td>
              <td style="padding: 9px 0; font-size: 14px; color: #e0d7ff;">${rest}</td>
            </tr>
          `).join('')}
        </table>

        <p style="
          text-align: center; margin: 18px 0 6px 0;
          font-size: 14px; font-weight: 800; color: #c4b5fd;
        ">💡 Every math coin you earn = 1 💎 Crystal at the end!</p>

        <p id="mq-tap-hint" style="
          text-align: center; margin: 0;
          font-size: 13px; color: #e0d7ff; opacity: 0.9;
        ">— Tap anywhere to begin! —</p>
      </div>
    `

    document.body.appendChild(overlay)

    let pulse = true
    const hint = overlay.querySelector('#mq-tap-hint') as HTMLElement
    const pulseInterval = setInterval(() => {
      if (!hint) return
      pulse = !pulse
      hint.style.opacity = pulse ? '0.9' : '0.3'
    }, 600)

    const close = () => {
      clearInterval(pulseInterval)
      overlay.style.transition = 'opacity 0.25s'
      overlay.style.opacity = '0'
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
      }, 260)
      this.time.delayedCall(350, () => this.companionSay(this.pick(COMPANION_MESSAGES.start), 2400))
    }

    overlay.addEventListener('click', close)
    setTimeout(() => { if (overlay.parentNode) close() }, 14000)
  }

  // ═══════════════════════════════════════════════════════════
  // ENVIRONMENT — Cave-specific
  // ═══════════════════════════════════════════════════════════

  private createCaveBackground() {
    // Deep cave gradient — very dark purple-blue at top, slightly lighter at ground
    const rt = this.make.renderTexture({ width: this.screenW, height: this.screenH }, true)
    const gfx = this.make.graphics({ x: 0, y: 0 })
    const steps = 60
    const topColor    = new Phaser.Display.Color(4, 2, 26)    // near-black purple
    const bottomColor = new Phaser.Display.Color(15, 8, 55)   // deep cave blue-purple
    for (let i = 0; i < steps; i++) {
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(topColor, bottomColor, steps, i)
      gfx.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1)
      gfx.fillRect(0, (i / steps) * this.screenH, this.screenW, this.screenH / steps + 2)
    }
    rt.draw(gfx)
    gfx.destroy()
    rt.setPosition(0, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(0)

    // Subtle distant cave wall texture — rows of muted purple rectangles
    for (let i = 0; i < 12; i++) {
      const wx = Math.random() * this.worldWidth
      const wy = 20 + Math.random() * (this.groundY * 0.6)
      const ww = 40 + Math.random() * 120
      const wh = 80 + Math.random() * 180
      this.add.rectangle(wx, wy, ww, wh, 0x1a0850, 0.25).setDepth(0.5)
    }
  }

  private createCaveCeiling() {
    // Solid ceiling strip with jagged lower edge feel
    const ceilH = this.screenH * 0.06
    this.add.rectangle(this.worldWidth / 2, ceilH / 2, this.worldWidth, ceilH, 0x06021A).setDepth(2)

    // Jagged ceiling bumps
    for (let i = 0; i < 60; i++) {
      const bx = (i / 60) * this.worldWidth + Math.random() * (this.worldWidth / 60)
      const bh = 10 + Math.random() * 24
      this.add.triangle(bx, ceilH, bx - 18, ceilH, bx + 18, ceilH, bx, ceilH + bh, 0x06021A).setDepth(2)
    }
  }

  private createStalactites() {
    // Hanging stalactites from the ceiling — varied sizes and positions
    const stalCount = 28
    const ceilH = this.screenH * 0.06

    for (let i = 0; i < stalCount; i++) {
      const sx  = 100 + Math.random() * (this.worldWidth - 200)
      const sh  = 30 + Math.random() * 90
      const sw  = 8  + Math.random() * 18
      const scrollX = 0.05 + Math.random() * 0.12

      // Stalactite body (triangle pointing down)
      const stal = this.add.triangle(
        sx, ceilH,
        -sw / 2, 0, sw / 2, 0, 0, sh,
        0x1a0850, 1
      ).setScrollFactor(scrollX).setDepth(1)

      // Subtle highlight on one side
      this.add.triangle(
        sx - sw * 0.1, ceilH,
        -sw * 0.15, 0, 0, 0, -sw * 0.05, sh * 0.7,
        0x2d1b69, 0.5
      ).setScrollFactor(scrollX).setDepth(1.1)

      // Drip glow at tip — some stalactites glow with crystal
      if (Math.random() > 0.6) {
        const tipX = sx
        const tipY = ceilH + sh
        const glowColor = Math.random() > 0.5 ? 0x8b5cf6 : 0x06b6d4
        const glow = this.add.circle(tipX, tipY, 3 + Math.random() * 4, glowColor, 0.7)
          .setScrollFactor(scrollX).setDepth(1.2)
        this.tweens.add({
          targets: glow,
          alpha: { from: 0.7, to: 0.15 },
          scaleX: 1.5, scaleY: 1.5,
          duration: 1200 + Math.random() * 800,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })

        stal.setFillStyle(Math.random() > 0.5 ? 0x2d1b69 : 0x1e0a5e)
      }
    }
  }

  private createCaveGlow() {
    // Glowing crystal clusters on the cave walls — parallax
    const clusters = [
      { x: 80,  y: this.screenH * 0.3, sx: 0.04, color: 0x8b5cf6 },
      { x: 300, y: this.screenH * 0.5, sx: 0.06, color: 0x06b6d4 },
      { x: 520, y: this.screenH * 0.2, sx: 0.04, color: 0xa78bfa },
      { x: 750, y: this.screenH * 0.4, sx: 0.05, color: 0x38bdf8 },
    ]
    clusters.forEach(({ x, y, sx, color }) => {
      const glow = this.add.circle(x, y, 40, color, 0.08).setScrollFactor(sx).setDepth(1)
      const core = this.add.circle(x, y, 16, color, 0.25).setScrollFactor(sx).setDepth(1)
      this.tweens.add({ targets: [glow, core], alpha: { from: 0.08, to: 0.25 }, scaleX: 1.3, scaleY: 1.3, duration: 2000 + Math.random() * 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    })

    // Small floating light motes (cave atmosphere)
    for (let m = 0; m < 8; m++) {
      const mx = 100 + Math.random() * (this.screenW - 200)
      const my = 60 + Math.random() * (this.groundY * 0.7)
      const mote = this.add.circle(mx, my, 2 + Math.random() * 3, 0xa78bfa, 0.4)
        .setScrollFactor(0.03).setDepth(1.5)
      this.tweens.add({
        targets: mote, y: my - 15 - Math.random() * 20,
        alpha: { from: 0.4, to: 0.05 },
        duration: 2500 + Math.random() * 2000,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
    }
  }

  private createGround() {
    const groundStartY = this.groundY
    const groundH      = this.screenH - groundStartY

    // Main cave floor — dark stone
    this.add.rectangle(this.worldWidth / 2, groundStartY + groundH / 2, this.worldWidth, groundH, 0x0f0730).setDepth(2)

    // Top edge — slightly lighter rock strip
    this.add.rectangle(this.worldWidth / 2, groundStartY + 8, this.worldWidth, 16, 0x1a0d50).setDepth(2)

    // Rock texture — random dark stones
    const rockColors = [0x1e1148, 0x150d3a, 0x241560, 0x120a30]
    for (let i = 0; i < 200; i++) {
      const rx = Math.random() * this.worldWidth
      const ry = groundStartY + 12 + Math.random() * 70
      const rs = 2 + Math.random() * 8
      this.add.ellipse(rx, ry, rs * 1.6, rs, rockColors[Math.floor(Math.random() * rockColors.length)], 0.9).setDepth(2)
    }

    // Glowing crystal formations on the ground
    const crystalGroundData = [
      { count: 60, colors: [0x7c3aed, 0x8b5cf6, 0x06b6d4, 0xa78bfa], glowColor: 0x8b5cf6 },
    ]
    crystalGroundData.forEach(({ count, colors, glowColor }) => {
      for (let i = 0; i < count; i++) {
        const cx  = Math.random() * this.worldWidth
        const cy  = groundStartY + 5 + Math.random() * 30
        const ch  = 8 + Math.random() * 22
        const cw  = 4 + Math.random() * 8
        const col = colors[Math.floor(Math.random() * colors.length)]

        // Crystal shard (triangle pointing up)
        this.add.triangle(cx, cy, -cw / 2, 0, cw / 2, 0, 0, -ch, col, 0.8).setDepth(2)

        // Small glow at tip
        if (Math.random() > 0.5) {
          const tip = this.add.circle(cx, cy - ch, 3, glowColor, 0.4).setDepth(2)
          this.tweens.add({ targets: tip, alpha: { from: 0.4, to: 0.05 }, duration: 1500 + Math.random() * 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        }
      }
    })

    // Bioluminescent mushrooms
    const mushColors = [0xec4899, 0x8b5cf6, 0x06b6d4, 0x84cc16]
    for (let i = 0; i < 25; i++) {
      const mx = 80 + Math.random() * (this.worldWidth - 160)
      const my = groundStartY + 8
      const mh = 10 + Math.random() * 16
      const mw = 7  + Math.random() * 12
      const mc = mushColors[Math.floor(Math.random() * mushColors.length)]

      // Stem
      this.add.rectangle(mx, my + mh * 0.3, mw * 0.35, mh * 0.8, 0xd1d5db, 0.5).setDepth(2)
      // Cap
      this.add.ellipse(mx, my, mw, mh * 0.6, mc, 0.85).setDepth(2)
      // Glow
      const mglow = this.add.circle(mx, my, mw * 0.9, mc, 0.12).setDepth(2)
      this.tweens.add({ targets: mglow, alpha: { from: 0.12, to: 0.35 }, scaleX: 1.4, scaleY: 1.4, duration: 1400 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }

    // Sparkling mineral deposits scattered on ground
    for (let i = 0; i < 18; i++) {
      const sx = 200 + Math.random() * (this.worldWidth - 400)
      const sy = groundStartY + 8 + Math.random() * 32
      const spark = this.add.text(sx, sy, '💎', { fontSize: `${10 + Math.random() * 8}px` })
        .setDepth(2).setOrigin(0.5).setAlpha(0.4)
      this.tweens.add({ targets: spark, alpha: 0.8, scaleX: 1.2, scaleY: 1.2, duration: 1800 + Math.random() * 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
  }

  private createZoneSign() {
    const signX = 260
    const signY = this.groundY - 80
    const sign  = this.add.container(signX, signY).setDepth(4)

    const post  = this.add.rectangle(0, 60, 10, 120, 0x4c1d95)
    const board = this.add.rectangle(0, 0, 175, 72, 0x0d0536).setStrokeStyle(4, 0x8b5cf6)
    const glow  = this.add.rectangle(0, 0, 175, 72, 0x8b5cf6, 0.06)

    const title = this.add.text(0, -14, '🦇 ECHO CAVES', {
      fontSize: '13px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold', color: '#c4b5fd',
    }).setOrigin(0.5)
    const sub = this.add.text(0, 10, 'Zone 2 · Solve to advance!', {
      fontSize: '10px', fontFamily: 'Nunito, sans-serif', color: '#a78bfa',
    }).setOrigin(0.5)

    sign.add([post, board, glow, title, sub])
    sign.setAlpha(0).setY(signY - 30)
    this.tweens.add({ targets: sign, alpha: 1, y: signY, duration: 700, delay: 300, ease: 'Back.easeOut' })
    this.tweens.add({ targets: sign, angle: 2, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  // ═══════════════════════════════════════════════════════════
  // PLATFORMS — Glowing Crystal Ledges
  // ═══════════════════════════════════════════════════════════

  private createPlatforms() {
    PLATFORMS.forEach((cfg, idx) => {
      const baseY   = this.screenH * cfg.yRatio
      const bobAmt  = cfg.bob ?? 0
      const container = this.add.container(cfg.x, baseY).setDepth(3)

      // Crystal platform layers
      const shadow    = this.add.ellipse(2, 12, cfg.width + 10, 16, 0x000000, 0.2)
      const base      = this.add.rectangle(0, 0, cfg.width, 20, 0x1e0a5e)
      const crystalTop= this.add.rectangle(0, -6, cfg.width, 12, 0x4c1d95)
      const glowTop   = this.add.rectangle(0, -10, cfg.width, 6, 0x8b5cf6, 0.5)

      // Crystal edges — small triangles along the top edge
      for (let e = 0; e < 5; e++) {
        const ex  = -cfg.width / 2 + (e + 0.5) * (cfg.width / 5)
        const eh  = 6 + Math.random() * 8
        const ew  = 4 + Math.random() * 4
        const col = Math.random() > 0.5 ? 0xa78bfa : 0x38bdf8
        container.add(
          this.add.triangle(ex, -12, -ew / 2, 0, ew / 2, 0, 0, -eh, col, 0.8)
        )
      }

      // Underside drip stalactites
      for (let d = 0; d < 3; d++) {
        const dripX = -cfg.width / 3 + d * (cfg.width / 3)
        const drip  = this.add.rectangle(dripX, 14, 5, 10 + Math.random() * 8, 0x1e0a5e)
        container.add(drip)
      }

      container.add([shadow, base, crystalTop, glowTop])

      // Pulsing edge glow
      const edgeGlow = this.add.rectangle(0, -8, cfg.width + 4, 16, 0x7c3aed, 0.18)
      this.tweens.add({
        targets: edgeGlow,
        alpha: { from: 0.18, to: 0.4 },
        scaleX: 1.02,
        duration: 1500 + idx * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      container.add(edgeGlow)

      // Emoji decoration
      if (cfg.emoji) {
        const deco = this.add.text(0, -22, cfg.emoji, { fontSize: '16px' }).setOrigin(0.5)
        this.tweens.add({ targets: deco, y: -28, duration: 1200 + idx * 80, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        container.add(deco)
      }

      if (bobAmt > 0) {
        this.tweens.add({
          targets: container, y: baseY + bobAmt,
          duration: 2000 + idx * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
      }

      this.platformObjects.push({ container, worldX: cfg.x, baseY, width: cfg.width, bob: bobAmt, bobTime: 0 })
    })
  }

  // ═══════════════════════════════════════════════════════════
  // CAVE CRYSTALS — Collectible (like stars in Zone 1)
  // ═══════════════════════════════════════════════════════════

  private createCrystals() {
    CRYSTAL_POSITIONS.forEach(({ x, yRatio }) => {
      const worldY = this.screenH * yRatio
      const glowRing = this.add.circle(x, worldY, 20, 0x8b5cf6, 0.15).setDepth(5)
      const crystal  = this.add.text(x, worldY, '💎', { fontSize: '24px' }).setOrigin(0.5).setDepth(6)

      this.tweens.add({ targets: crystal, y: worldY - 10, duration: 700 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.tweens.add({ targets: crystal, angle: 8, duration: 2000 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.tweens.add({ targets: glowRing, scaleX: 2, scaleY: 2, alpha: 0, duration: 1200 + Math.random() * 500, repeat: -1, ease: 'Quad.easeOut' })

      this.crystalObjects.push({ obj: crystal, x, y: worldY, collected: false, glowRing })
    })
  }

  private createCrystalHUD() {
    this.crystalHUD = this.add.container(this.screenW - 100, 18).setScrollFactor(0).setDepth(100)
    const bg = this.add.graphics()
    bg.fillStyle(0x04021A, 0.65)
    bg.fillRoundedRect(-50, -16, 100, 32, 10)
    bg.lineStyle(2, 0x8b5cf6, 0.7)
    bg.strokeRoundedRect(-50, -16, 100, 32, 10)
    const icon = this.add.text(-32, 0, '💎', { fontSize: '16px' }).setOrigin(0.5)
    this.crystalCountText = this.add.text(4, 0, `0 / ${CRYSTAL_POSITIONS.length}`, {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold', color: '#c4b5fd',
    }).setOrigin(0.5)
    this.crystalHUD.add([bg, icon, this.crystalCountText])
  }

  // ═══════════════════════════════════════════════════════════
  // PLAYER — Same as Zone 1 hero
  // ═══════════════════════════════════════════════════════════

  private createPlayer() {
    this.player = this.add.container(this.playerX, this.playerY).setDepth(10)

    const shadow  = this.add.ellipse(0, 34, 46, 12, 0x000000, 0.2)
    this.legL     = this.add.rectangle(-11, 26, 12, 20, 0x6d28d9)
    this.legR     = this.add.rectangle( 11, 26, 12, 20, 0x6d28d9)
    const shoeL   = this.add.ellipse(-13, 38, 20, 10, 0xfbbf24)
    const shoeR   = this.add.ellipse( 13, 38, 20, 10, 0xfbbf24)
    const shoeHL  = this.add.ellipse(-16, 35,  8,  5, 0xfde68a, 0.6)
    const shoeHR  = this.add.ellipse( 10, 35,  8,  5, 0xfde68a, 0.6)
    const body    = this.add.rectangle(0, 4, 40, 46, 0x7c3aed)
    const bodyHL  = this.add.rectangle(-8, -2, 12, 36, 0x8b5cf6, 0.5)
    const belt    = this.add.rectangle(0, 16, 40, 6, 0x1e1b4b)
    const buckle  = this.add.rectangle(0, 16, 10, 5, 0xfbbf24)
    const cape    = this.add.triangle(-4, -14, -18, 0, 4, -30, 10, 10, 0xa78bfa, 0.85)
    const armL    = this.add.rectangle(-24,  6, 10, 24, 0x7c3aed)
    const armR    = this.add.rectangle( 24,  6, 10, 24, 0x7c3aed)
    const gloveL  = this.add.circle(-24, 20, 7, 0xfbbf24)
    const gloveR  = this.add.circle( 24, 20, 7, 0xfbbf24)
    const neck    = this.add.rectangle(0, -16, 16, 10, 0xc4b5fd)
    const head    = this.add.circle(0, -32, 22, 0xc4b5fd)
    const headHL  = this.add.ellipse(-6, -40, 12, 8, 0xddd6fe, 0.5)
    const eyeLW   = this.add.ellipse(-8, -35, 13, 15, 0xffffff)
    const eyeRW   = this.add.ellipse( 8, -35, 13, 15, 0xffffff)
    const eyeLP   = this.add.circle(-8, -34, 5, 0x1e1b4b)
    const eyeRP   = this.add.circle( 8, -34, 5, 0x1e1b4b)
    const eyeLG   = this.add.circle(-6, -37, 2, 0xffffff)
    const eyeRG   = this.add.circle(10, -37, 2, 0xffffff)
    const browL   = this.add.rectangle(-9, -46, 12, 3, 0x4c1d95).setAngle(-8)
    const browR   = this.add.rectangle( 9, -46, 12, 3, 0x4c1d95).setAngle(8)
    const nose    = this.add.circle(0, -29, 3, 0xa78bfa)
    const smile   = this.add.arc(0, -23, 9, 0, 180, false, 0x4c1d95)
    const antSt   = this.add.rectangle(8, -53, 3, 12, 0x7c3aed)
    const antBall = this.add.circle(8, -60, 5, 0xfbbf24)

    // Headlamp glow — cave explorer has a light!
    const lamp    = this.add.circle(0, -52, 7, 0xfef3c7)
    const lampGlow= this.add.circle(0, -52, 14, 0xfef3c7, 0.25)
    this.tweens.add({ targets: lampGlow, alpha: { from: 0.25, to: 0.08 }, scaleX: 1.3, scaleY: 1.3, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    this.player.add([
      shadow,
      this.legL, this.legR, shoeL, shoeR, shoeHL, shoeHR,
      body, bodyHL, belt, buckle,
      cape, armL, armR, gloveL, gloveR,
      neck, head, headHL,
      eyeLW, eyeRW, eyeLP, eyeRP, eyeLG, eyeRG,
      browL, browR, nose, smile,
      antSt, antBall, lamp, lampGlow,
    ])

    this.tweens.add({ targets: this.player, y: this.playerY - 5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  // ═══════════════════════════════════════════════════════════
  // COMPANION — Echo the Crystal Bat 🦇
  // ═══════════════════════════════════════════════════════════

  private createCompanion() {
    this.companion = this.add.container(this.companionX, this.companionY).setDepth(9)

    // Body — small rounded bat body
    const bodyGlow = this.add.circle(0, 0, 18, 0x7c3aed, 0.25)
    const body     = this.add.ellipse(0, 2, 28, 22, 0x4c1d95)
    const bodyHL   = this.add.ellipse(-4, -2, 12, 8, 0x8b5cf6, 0.5)

    // Wings — large spread triangles
    this.companionWingL = this.add.triangle(-14, 0, -40, -12, -14, -8, -8, 12, 0x6d28d9, 0.85)
    this.companionWingR = this.add.triangle( 14, 0,  40, -12,  14, -8,  8, 12, 0x6d28d9, 0.85)

    // Wing membrane highlights
    const wHL = this.add.triangle(-14, 0, -32, -8, -18, -6, -12, 8, 0x8b5cf6, 0.3)
    const wHR = this.add.triangle( 14, 0,  32, -8,  18, -6,  12, 8, 0x8b5cf6, 0.3)

    // Ears (tiny triangles on top)
    const earL = this.add.triangle(-8, -10, -12, -10, -5, -10, -8, -22, 0x4c1d95)
    const earR = this.add.triangle( 8, -10,  12, -10,  5, -10,  8, -22, 0x4c1d95)

    // Eyes — glowing cyan
    const eyeL  = this.add.circle(-6, -1, 5, 0x06b6d4)
    const eyeR  = this.add.circle( 6, -1, 5, 0x06b6d4)
    const pupilL= this.add.circle(-6, -1, 2, 0x001f3f)
    const pupilR= this.add.circle( 6, -1, 2, 0x001f3f)
    const glintL= this.add.circle(-5, -3, 1, 0xffffff)
    const glintR= this.add.circle( 7, -3, 1, 0xffffff)

    // Eye glow
    const eyeGlowL = this.add.circle(-6, -1, 8, 0x06b6d4, 0.25)
    const eyeGlowR = this.add.circle( 6, -1, 8, 0x06b6d4, 0.25)
    this.tweens.add({ targets: [eyeGlowL, eyeGlowR], alpha: { from: 0.25, to: 0.05 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    // Tiny fangs
    const fangL = this.add.triangle(-3, 6, -5, 4, -1, 4, -3, 10, 0xffffff, 0.9)
    const fangR = this.add.triangle( 3, 6,  1, 4,  5, 4,  3, 10, 0xffffff, 0.9)

    this.companion.add([
      bodyGlow,
      this.companionWingL, this.companionWingR, wHL, wHR,
      body, bodyHL,
      earL, earR,
      eyeGlowL, eyeGlowR,
      eyeL, eyeR, pupilL, pupilR, glintL, glintR,
      fangL, fangR,
    ])

    // Wing flap animation
    this.tweens.add({ targets: this.companionWingL, angle: -15, scaleX: 0.7, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: this.companionWingR, angle: 15,  scaleX: 0.7, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    // Body glow pulse
    this.tweens.add({ targets: bodyGlow, alpha: { from: 0.25, to: 0.55 }, scaleX: 1.4, scaleY: 1.4, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    // Speech bubble — separate container so it doesn't flip with the bat
    this.companionSpeechBubble = this.add.container(0, 0).setDepth(11).setAlpha(0)

    const bubbleBg = this.add.graphics()
    bubbleBg.fillStyle(0x0d0536, 0.95)
    bubbleBg.fillRoundedRect(0, -28, 120, 28, 8)
    bubbleBg.lineStyle(2, 0x8b5cf6, 0.9)
    bubbleBg.strokeRoundedRect(0, -28, 120, 28, 8)
    bubbleBg.fillStyle(0x0d0536, 0.95)
    bubbleBg.fillTriangle(8, 0, 0, 10, 20, 0)

    this.companionSpeechText = this.add.text(60, -14, '', {
      fontSize: '11px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold', color: '#c4b5fd',
    }).setOrigin(0.5)

    this.companionSpeechBubble.add([bubbleBg, this.companionSpeechText])

    this.companionX       = this.playerX - 55
    this.companionTargetX = this.companionX
  }

  private companionSay(msg: string, durationMs = 2000) {
    if (!this.companionSpeechText) return
    this.companionSpeechText.setText(msg)
    if (this.companionEmoteTween) { this.companionEmoteTween.stop(); this.companionEmoteTween = null }
    this.companionSpeechBubble.setAlpha(1)
    this.companionEmoteTween = this.tweens.add({
      targets: this.companionSpeechBubble, alpha: 0, duration: 350, delay: durationMs, ease: 'Quad.easeIn',
    })
  }

  private companionReactCorrect() {
    const currentY = this.companion.y
    this.tweens.add({ targets: this.companion, y: currentY - 50, duration: 200, yoyo: true, ease: 'Quad.easeOut' })
    this.tweens.add({ targets: this.companion, scaleX: this.companion.scaleX * 1.4, scaleY: 1.4, duration: 120, yoyo: true, ease: 'Back.easeOut' })
    this.companionSay(this.pick(COMPANION_MESSAGES.correct), 2200)
    this.spawnCompanionBurst(0x8b5cf6)
  }

  private companionReactWrong() {
    const cx = this.companion.x
    this.tweens.add({ targets: this.companion, x: cx + 12, duration: 60, yoyo: true, repeat: 3, ease: 'Linear', onComplete: () => this.companion.setX(cx) })
    this.companionSay(this.pick(COMPANION_MESSAGES.wrong), 2000)
  }

  private spawnCompanionBurst(color: number) {
    const cam = this.cameras.main
    const sx  = this.companionX - cam.scrollX
    const sy  = (this.companion.y - cam.scrollY) - 10
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const dot   = this.add.circle(sx, sy, 4, color).setScrollFactor(0).setDepth(60)
      this.tweens.add({
        targets: dot, x: sx + Math.cos(angle) * 50, y: sy + Math.sin(angle) * 50,
        alpha: 0, scaleX: 0, scaleY: 0, duration: 500, ease: 'Quad.easeOut',
        onComplete: () => dot.destroy(),
      })
    }
  }

  private startCompanionIdleChatter() {
    const chatLoop = () => {
      if (!this.isBlocked) {
        if (this.companionSpeechBubble.alpha < 0.1) {
          this.companionSay(this.pick(COMPANION_MESSAGES.idle), 2500)
        }
      }
      this.time.delayedCall(8000 + Math.random() * 6000, chatLoop)
    }
    this.time.delayedCall(8000, chatLoop)
  }

  // ═══════════════════════════════════════════════════════════
  // OBSTACLES — Cave guardians
  // ═══════════════════════════════════════════════════════════

  private createObstacles() {
    OBSTACLES.forEach(cfg => {
      const container = this.add.container(cfg.x, this.groundY - cfg.height / 2).setDepth(5)
      const icon      = this.add.text(0, 0, cfg.emoji, { fontSize: '96px' }).setOrigin(0.5)

      // Crystal warning ring — purple/cyan themed
      const warnRing = this.add.circle(0, 0, 70, 0x8b5cf6, 0).setStrokeStyle(3, 0x8b5cf6, 0)

      this.tweens.add({ targets: icon, y: -14, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      container.add([warnRing, icon])
      ;(container as any)._warnRing = warnRing
      this.obstacleObjects.set(cfg.id, { container, config: cfg, solved: false })
    })
  }

  // ═══════════════════════════════════════════════════════════
  // BOSS — The Stone Warden (Crystal Golem)
  // ═══════════════════════════════════════════════════════════

  private createBoss() {
    this.bossContainer = this.add.container(BOSS_X, this.groundY - 100).setDepth(8)

    // Outer aura — pulsing crystal glow
    const aura  = this.add.ellipse(0, 0, 220, 250, 0x7c3aed, 0.2)
    const aura2 = this.add.ellipse(0, 0, 170, 200, 0x4c1d95, 0.35)

    // Stone body — massive layered ellipses
    const body  = this.add.ellipse(0, 10, 160, 190, 0x1c1340)
    const bodyHL= this.add.ellipse(-30, -20, 60, 100, 0x2d1b69, 0.5)

    // Crystal shoulder armour
    for (let s = 0; s < 4; s++) {
      const sx   = (s < 2 ? -1 : 1) * (60 + (s % 2) * 18)
      const sy   = -30 + (s % 2) * 20
      const sh   = 40 + Math.random() * 20
      const sw   = 14 + Math.random() * 8
      const scol = [0x7c3aed, 0x8b5cf6, 0x06b6d4, 0xa78bfa][s]
      this.bossContainer.add(
        this.add.triangle(sx, sy, -sw / 2, sh / 2, sw / 2, sh / 2, 0, -sh / 2, scol, 0.9)
      )
    }

    // Glowing crystal eyes
    this.bossEyeL  = this.add.circle(-32, -30, 18, 0x8b5cf6)
    this.bossEyeR  = this.add.circle( 32, -30, 18, 0x8b5cf6)
    this.bossPupilL= this.add.circle(-32, -30, 8, 0x06b6d4)
    this.bossPupilR= this.add.circle( 32, -30, 8, 0x06b6d4)

    // Eye glow rings
    const eyeGL = this.add.circle(-32, -30, 26, 0x8b5cf6, 0.3)
    const eyeGR = this.add.circle( 32, -30, 26, 0x8b5cf6, 0.3)
    this.tweens.add({ targets: [eyeGL, eyeGR], alpha: { from: 0.3, to: 0.7 }, scaleX: 1.3, scaleY: 1.3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    // Crown of crystals
    for (let c = 0; c < 5; c++) {
      const cx2  = (c - 2) * 28
      const ch   = 24 + (c === 2 ? 16 : 0)
      const cw   = 10
      const ccol = [0x8b5cf6, 0x06b6d4, 0xa78bfa, 0x38bdf8, 0x7c3aed][c]
      this.bossContainer.add(
        this.add.triangle(cx2, -100, -cw / 2, 0, cw / 2, 0, 0, -ch, ccol, 0.95)
      )
    }

    // HP bars — crystal shards
    for (let h = 0; h < 3; h++) {
      const bg   = this.add.rectangle(-30 + h * 30, -145, 24, 14, 0x0d0536).setStrokeStyle(1, 0x4c1d95)
      const fill = this.add.rectangle(-30 + h * 30, -145, 22, 12, 0x8b5cf6)
      this.bossHP.push(fill)
      this.bossContainer.add([bg, fill])
    }

    const nameTxt  = this.add.text(0, -170, 'STONE WARDEN', {
      fontSize: '13px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold', color: '#c4b5fd', stroke: '#04021a', strokeThickness: 3,
    }).setOrigin(0.5)
    const badgeBg  = this.add.rectangle(0, -188, 70, 20, 0x7c3aed)
    const badgeTxt = this.add.text(0, -188, '⚠ BOSS', {
      fontSize: '11px', fontStyle: 'bold', fontFamily: 'Nunito, sans-serif', color: '#ffffff',
    }).setOrigin(0.5)

    this.bossContainer.add([aura, aura2, body, bodyHL, this.bossEyeL, this.bossEyeR, eyeGL, eyeGR, this.bossPupilL, this.bossPupilR, nameTxt, badgeBg, badgeTxt])

    // Float + aura pulse
    this.tweens.add({ targets: this.bossContainer, y: this.groundY - 112, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: aura,  alpha: { from: 0.2, to: 0.5 }, scaleX: 1.1, scaleY: 1.1, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: aura2, alpha: { from: 0.35, to: 0.65 }, scaleX: 1.06, scaleY: 1.06, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    ;[this.bossEyeL, this.bossEyeR].forEach(e => this.tweens.add({ targets: e, alpha: { from: 1, to: 0.3 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }))
  }

  private createBats() {
    // Ambient bats flying through the cave — background atmosphere
    ['🦇', '🦇', '🦇', '🦇', '🦇', '🦇'].forEach((emoji, i) => {
      const bat = this.add.text(-80 - i * 200, 40 + i * 20, emoji, { fontSize: '18px' })
        .setScrollFactor(0.08).setDepth(1).setAlpha(0.6)
      this.tweens.add({ targets: bat, x: this.screenW + 100, duration: 10000 + i * 2500, repeat: -1, ease: 'Linear', onRepeat: () => { bat.x = -80; bat.y = 30 + Math.random() * (this.groundY * 0.5) } })
      this.tweens.add({ targets: bat, y: bat.y - 10, duration: 600 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      // Occasional flip to simulate real bat flight
      this.time.delayedCall(1000 + i * 700, () => {
        this.tweens.add({ targets: bat, scaleX: -1, duration: 150, yoyo: true, repeat: -1, repeatDelay: 2000 + Math.random() * 1500 })
      })
    })
  }

  // ═══════════════════════════════════════════════════════════
  // UPDATE LOOP
  // ═══════════════════════════════════════════════════════════

  update(_time: number, delta: number) {
    const wasOnGround = this.playerOnGround

    this.updatePlayer(delta)
    this.updateCompanion(delta)
    this.updateBossEyes()
    this.updateBossProjectiles(delta)
    this.updatePlatformCollisions()
    this.updateCaveDrips(delta)

    if (!wasOnGround && this.playerOnGround) this.audio.playSfx('land', 0.55)

    if (!this.isBlocked) {
      this.checkObstacleCollisions()
      this.checkBossProximity()
      this.checkCrystalCollection()
    }
    this.updateObstacleWarnings()
  }

  private updatePlayer(delta: number) {
    if (this.isBlocked) return

    const dt       = delta / 16.67
    const goLeft   = this.cursors.left.isDown  || this.keyA.isDown || this.touchLeft
    const goRight  = this.cursors.right.isDown || this.keyD.isDown || this.touchRight
    const jump     = Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
                     Phaser.Input.Keyboard.JustDown(this.keyW)       ||
                     Phaser.Input.Keyboard.JustDown(this.keySpace)   ||
                     this.touchJump
    this.touchJump = false
    this.isRunning = goLeft || goRight

    if (goLeft)       { this.playerVelX = -4.5; this.facingRight = false }
    else if (goRight) { this.playerVelX =  4.5; this.facingRight = true  }
    else              { this.playerVelX *= 0.75 }

    if (jump && this.playerOnGround) {
      this.playerVelY     = -14
      this.playerOnGround = false
      this.audio.playSfx('jump')
      this.companionSay(this.pick(COMPANION_MESSAGES.jump), 900)
    }

    this.playerVelY += 0.55 * dt
    this.playerY    += this.playerVelY * dt

    const floorY = this.groundY - 24
    if (this.playerY >= floorY) {
      this.playerY        = floorY
      this.playerVelY     = 0
      this.playerOnGround = true
    }

    this.playerX = Math.max(40, this.playerX + this.playerVelX * dt)
    this.playerX = Math.min(this.getRightLimit(), this.playerX)
    this.player.setScale(this.facingRight ? 1 : -1, 1)
    this.player.setPosition(this.playerX, this.playerY)

    if (this.isRunning && this.playerOnGround) {
      this.legTimer += delta
      const legAngle = Math.sin(this.legTimer * 0.015) * 14
      this.legL.setAngle(legAngle)
      this.legR.setAngle(-legAngle)
    } else {
      this.legL.setAngle(0)
      this.legR.setAngle(0)
    }
  }

  private updatePlatformCollisions() {
    if (this.isBlocked) return
    for (const plat of this.platformObjects) {
      const platY   = plat.container.y
      const platTop = platY - 7
      const dx      = Math.abs(this.playerX - plat.worldX)
      const halfW   = plat.width / 2 + 10
      if (dx < halfW && this.playerVelY >= 0 && this.playerY <= platTop + 8 && this.playerY >= platTop - 16) {
        this.playerY        = platTop - 16
        this.playerVelY     = 0
        this.playerOnGround = true
        break
      }
    }
  }

  private updateCompanion(delta: number) {
    const dt = delta / 16.67
    this.companionTime += delta

    // Echo flies ABOVE the player with a figure-8 motion
    this.companionTargetX = this.playerX + (this.facingRight ? -60 : 60)
    const dx = this.companionTargetX - this.companionX
    this.companionX += dx * 0.07 * dt

    // Figure-8 flight path above the player
    const figureEightY = Math.sin(this.companionTime * 0.004) * 18
    const figureEightX = Math.sin(this.companionTime * 0.002) * 12
    const flyHeight = this.playerY - 75 + figureEightY

    this.companion.setPosition(this.companionX + figureEightX, flyHeight)

    // Echo faces the direction she's moving
    this.companion.setScale(dx < 0 ? 1 : -1, 1)

    // Speech bubble stays upright above Echo
    const bubbleX = this.companionX + figureEightX + (dx < 0 ? 35 : -155)
    const bubbleY = flyHeight - 45
    this.companionSpeechBubble.setPosition(bubbleX, bubbleY)
    this.companionSpeechBubble.setScale(1, 1)
  }

  private updateBossEyes() {
    if (this.bossPhase === 0 || this.bossPhase >= 4) return
    const dx        = (this.playerX - BOSS_X) / 400
    const clampedDx = Math.max(-7, Math.min(7, dx * 7))
    this.bossPupilL.setPosition(-32 + clampedDx, -30)
    this.bossPupilR.setPosition( 32 + clampedDx, -30)
  }

  private updateBossProjectiles(delta: number) {
    if (this.bossBlocked && this.activeBossPhase > 0) {
      this.bossAttackTimer += delta
      if (this.bossAttackTimer >= this.bossAttackInterval) {
        this.bossAttackTimer = 0
        this.fireCrystalShards()
      }
    }

    const dt = delta / 16.67
    for (let i = this.bossProjectiles.length - 1; i >= 0; i--) {
      const p    = this.bossProjectiles[i]
      p.velY    += 0.55 * dt
      const newX = p.obj.x + p.velX * dt
      const newY = p.obj.y + p.velY * dt

      if (newY >= this.groundY - 20 && p.bounces < 2) {
        p.velY    = -(Math.abs(p.velY) * 0.5)
        p.bounces++
      }

      p.obj.setPosition(newX, newY)

      if (newX < -100 || (p.bounces >= 2 && newY > this.groundY)) {
        p.obj.destroy()
        this.bossProjectiles.splice(i, 1)
      }
    }
  }

  private fireCrystalShards() {
    // Boss roar — shake and eye flash
    this.tweens.add({ targets: this.bossContainer, x: BOSS_X + 12, duration: 70, yoyo: true, repeat: 4, ease: 'Linear' })
    ;[this.bossEyeL, this.bossEyeR].forEach(e => {
      e.setFillStyle(0xff0066)
      this.time.delayedCall(220, () => e.setFillStyle(0x8b5cf6))
    })

    // Fire 2–4 crystal shards toward the player
    const count = 2 + this.activeBossPhase
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * 220, () => {
        const shard = this.add.text(BOSS_X - 50, this.groundY - 140, '💠', { fontSize: '24px' }).setOrigin(0.5).setDepth(7)
        const velX  = -(3.5 + Math.random() * 1.5)
        const velY  = -(5 + Math.random() * 3)
        const spread = (i - count / 2) * 0.2
        this.tweens.add({ targets: shard, angle: 360, duration: 600, repeat: -1, ease: 'Linear' })
        this.bossProjectiles.push({ obj: shard, velX, velY: velY + spread * 3, bounces: 0 })
      })
    }
  }

  private clearBossProjectiles() {
    this.bossProjectiles.forEach(p => {
      this.tweens.add({ targets: p.obj, alpha: 0, scaleX: 2, scaleY: 2, duration: 200, ease: 'Quad.easeOut', onComplete: () => p.obj.destroy() })
    })
    this.bossProjectiles = []
    this.bossAttackTimer = 0
  }

  // Animated cave drips from stalactite tips
  private updateCaveDrips(delta: number) {
    this.dripTimer += delta
    if (this.dripTimer > 800 + Math.random() * 1200) {
      this.dripTimer = 0
      const cam   = this.cameras.main
      const drip  = this.add.circle(
        cam.scrollX + Math.random() * this.screenW,
        this.screenH * 0.06 + 20 + Math.random() * (this.screenH * 0.15),
        2, 0x06b6d4, 0.7
      ).setDepth(1.5)
      this.activeDrips.push({ obj: drip, velY: 2 + Math.random() * 3, x: drip.x })
    }

    for (let i = this.activeDrips.length - 1; i >= 0; i--) {
      const d = this.activeDrips[i]
      d.obj.y += d.velY
      if (d.obj.y > this.groundY) {
        d.obj.destroy()
        this.activeDrips.splice(i, 1)
      }
    }
  }

  // ── Obstacle proximity warnings ──────────────────────────
  private updateObstacleWarnings() {
    this.obstacleObjects.forEach(({ container, config, solved }) => {
      if (solved) return
      const warnRing = (container as any)._warnRing as Phaser.GameObjects.Arc | undefined
      if (!warnRing) return
      const dist = Math.abs(this.playerX - config.x)
      if (dist < 220 && dist > 40) {
        warnRing.setStrokeStyle(3, 0x8b5cf6, (1 - dist / 220) * 0.9)
      } else {
        warnRing.setStrokeStyle(3, 0x8b5cf6, 0)
      }
    })
  }

  // ── Crystal collection ────────────────────────────────────
  private checkCrystalCollection() {
    this.crystalObjects.forEach(c => {
      if (c.collected) return
      const dx = Math.abs(this.playerX - c.x)
      const dy = Math.abs(this.playerY - c.y)
      if (dx < 38 && dy < 44) this.collectCrystal(c)
    })
  }

  private collectCrystal(c: typeof this.crystalObjects[0]) {
    c.collected = true
    this.crystalsCollected++
    this.crystalCountText.setText(`${this.crystalsCollected} / ${CRYSTAL_POSITIONS.length}`)

    if (c.glowRing) {
      this.tweens.add({ targets: c.glowRing, scaleX: 4, scaleY: 4, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => c.glowRing!.destroy() })
    }

    const cam = this.cameras.main
    const sx  = c.x - cam.scrollX
    const sy  = c.y - cam.scrollY
    const fly = this.add.text(sx, sy, '💎', { fontSize: '24px' }).setOrigin(0.5).setScrollFactor(0).setDepth(80)
    this.tweens.add({
      targets: fly, x: this.screenW - 100, y: 18, scaleX: 0.3, scaleY: 0.3, alpha: 0,
      duration: 550, ease: 'Quad.easeIn', onComplete: () => fly.destroy(),
    })

    this.tweens.add({ targets: this.crystalHUD, scaleX: 1.3, scaleY: 1.3, duration: 100, yoyo: true, ease: 'Back.easeOut' })

    this.audio.playSfx('collect')
    c.obj.destroy()
    this.companionSay(this.pick(COMPANION_MESSAGES.crystalCollect), 1400)
  }

  // ═══════════════════════════════════════════════════════════
  // NAVIGATION GATES
  // ═══════════════════════════════════════════════════════════

  private getRightLimit(): number {
    for (const cfg of OBSTACLES) {
      const obs = this.obstacleObjects.get(cfg.id)
      if (obs && !obs.solved) return cfg.x - 30
    }
    if (this.bossPhase < 4) return BOSS_X - 80
    return this.worldWidth - 60
  }

  private checkObstacleCollisions() {
    if (this.obsCooldown || this.activeObsId) return
    for (const cfg of OBSTACLES) {
      const obs = this.obstacleObjects.get(cfg.id)
      if (!obs || obs.solved) continue
      if (Math.abs(this.playerX - cfg.x) < cfg.width / 2 + 40) {
        this.triggerObstacle(cfg.id)
        return
      }
    }
  }

  private checkBossProximity() {
    if (this.solvedCount < 8)     return
    if (this.bossPhase >= 4)      return
    if (this.activeBossPhase > 0) return
    if (this.interPhaseCooldown)  return
    if (Math.abs(this.playerX - BOSS_X) >= 110) return
    this.triggerBoss()
  }

  private triggerObstacle(id: string) {
    this.activeObsId     = id
    this.obstacleBlocked = true
    this.audio.playSfx('collision')
    const cfg = OBSTACLES.find(o => o.id === id)!
    const obs = this.obstacleObjects.get(id)
    if (obs) this.tweens.add({ targets: obs.container, x: cfg.x + 8, duration: 60, yoyo: true, repeat: 3, ease: 'Linear' })
    this.companionSay(this.pick(COMPANION_MESSAGES.approach), 2500)
    dispatchToReact(ZONE2_EVENTS.SHOW_PROBLEM, { type: 'obstacle', obstacleId: id, problemId: cfg.problemId, label: cfg.label })
  }

  private triggerBoss() {
    const nextPhase = this.bossPhase + 1
    if (nextPhase > 3) return
    this.bossPhase       = nextPhase
    this.activeBossPhase = nextPhase
    this.bossBlocked     = true
    this.bossAttackTimer = this.bossAttackInterval * 0.6

    if (nextPhase === 1) {
      this.audio.playSfx('boss_appear')
      this.audio.playMusic('bg_boss')
    } else {
      this.audio.playSfx('boss_phase')
    }

    const problemIds = ['Z2-BOSS-01', 'Z2-BOSS-02', 'Z2-BOSS-03']
    dispatchToReact(ZONE2_EVENTS.SHOW_PROBLEM, {
      type: 'boss', obstacleId: `boss-phase-${nextPhase}`,
      problemId: problemIds[nextPhase - 1], bossPhase: nextPhase,
      label: `Stone Warden — Phase ${nextPhase}`,
    })
    dispatchToReact(ZONE2_EVENTS.BOSS_PHASE, { phase: nextPhase })
    this.tweens.add({ targets: this.bossContainer, x: BOSS_X + 14, duration: 80, yoyo: true, repeat: 5, ease: 'Linear' })
    this.companionSay(this.pick(COMPANION_MESSAGES.bossNear), 3000)
  }

  // ═══════════════════════════════════════════════════════════
  // ANSWER HANDLING
  // ═══════════════════════════════════════════════════════════

  private handleAnswerResult(correct: boolean, obstacleId: string) {
    if (!this.obstacleBlocked && !this.bossBlocked) return
    this.clearBossProjectiles()
    if (correct) {
      this.audio.playSfx('correct')
      this.companionReactCorrect()
      if (obstacleId.startsWith('boss-phase')) this.onBossPhaseCleared()
      else this.onObstacleCleared(obstacleId)
    } else {
      this.audio.playSfx('wrong')
      this.companionReactWrong()
      this.onWrongAnswer()
    }
  }

  private onWrongAnswer() {
    this.flashPlayer()
    this.time.delayedCall(800, () => {
      this.obstacleBlocked = false
      this.bossBlocked     = false
      this.activeObsId     = null
      if (this.activeBossPhase > 0) {
        this.bossPhase--
        this.interPhaseCooldown = true
        this.time.delayedCall(1000, () => { this.interPhaseCooldown = false })
      }
      this.activeBossPhase = 0
      this.obsCooldown     = true
      this.time.delayedCall(600, () => { this.obsCooldown = false })
    })
  }

  private onObstacleCleared(obstacleId: string) {
    const obs = this.obstacleObjects.get(obstacleId)
    if (!obs) return
    obs.solved           = true
    this.solvedCount++
    this.activeObsId     = null
    this.obstacleBlocked = false

    const cx = obs.config.x
    const cy = this.groundY - obs.config.height / 2

    // Screen flash — purple cave tint
    const flash = this.add.rectangle(this.screenW / 2, this.screenH / 2, this.screenW, this.screenH, 0x7c3aed, 0.4)
      .setScrollFactor(0).setDepth(50)
    this.tweens.add({ targets: flash, alpha: 0, duration: 350, ease: 'Quad.easeOut', onComplete: () => flash.destroy() })

    // Emoji rockets upward
    const ghost = this.add.text(cx, cy, obs.config.emoji, { fontSize: '96px' }).setOrigin(0.5).setDepth(30)
    this.tweens.add({ targets: ghost, y: cy - 220, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => ghost.destroy() })

    // Crystal shockwave rings
    for (let r = 0; r < 3; r++) {
      const ringColor = [0x8b5cf6, 0x06b6d4, 0xa78bfa][r]
      const ring = this.add.circle(cx, cy, 10, ringColor, 0).setStrokeStyle(4 - r, ringColor).setDepth(25)
      this.tweens.add({ targets: ring, scaleX: 6 + r * 2, scaleY: 6 + r * 2, alpha: 0, duration: 500 + r * 120, delay: r * 80, ease: 'Quad.easeOut', onComplete: () => ring.destroy() })
    }

    // Crystal earn notification
    const cam      = this.cameras.main
    const screenCX = cx - cam.scrollX
    const screenCY = cy - cam.scrollY

    const coinPop = this.add.text(screenCX, screenCY - 30, '💎 +1 Crystal!', {
      fontSize: '22px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#c4b5fd', stroke: '#4c1d95', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(65).setAlpha(0).setScale(0.5)
    this.tweens.add({
      targets: coinPop, y: screenCY - 90, alpha: 1, scaleX: 1.1, scaleY: 1.1, duration: 500, ease: 'Back.easeOut',
      onComplete: () => { this.tweens.add({ targets: coinPop, alpha: 0, y: screenCY - 120, duration: 350, delay: 600, ease: 'Quad.easeIn', onComplete: () => coinPop.destroy() }) },
    })

    // Crystal particle burst
    const burstColors = [0x8b5cf6, 0x06b6d4, 0xa78bfa, 0x38bdf8, 0xffd700, 0xec4899, 0x7c3aed, 0xffffff]
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.3
      const dist  = 70 + Math.random() * 100
      const dot   = this.add.circle(screenCX, screenCY, 6 + Math.random() * 8, burstColors[i % burstColors.length]).setScrollFactor(0).setDepth(60)
      this.tweens.add({
        targets: dot, x: screenCX + Math.cos(angle) * dist, y: screenCY + Math.sin(angle) * dist - 40,
        duration: 800 + Math.random() * 400, ease: 'Cubic.easeOut',
        onComplete: () => { this.tweens.add({ targets: dot, scaleX: 0, scaleY: 0, alpha: 0, duration: 600, ease: 'Quad.easeIn', onComplete: () => dot.destroy() }) },
      })
    }

    // SOLVED! text
    const solvedTxt = this.add.text(cx, cy - 40, '✅ SOLVED!', {
      fontSize: '28px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#ffffff', stroke: '#7c3aed', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(35).setAlpha(0).setScale(0.4)
    this.tweens.add({
      targets: solvedTxt, y: cy - 110, alpha: 1, scaleX: 1, scaleY: 1, duration: 400, ease: 'Back.easeOut',
      onComplete: () => { this.tweens.add({ targets: solvedTxt, alpha: 0, y: cy - 150, duration: 400, delay: 500, ease: 'Quad.easeIn', onComplete: () => solvedTxt.destroy() }) },
    })

    // Container pop and vanish
    this.tweens.add({
      targets: obs.container, scaleX: 1.4, scaleY: 1.4, duration: 120, ease: 'Quad.easeOut',
      onComplete: () => { this.tweens.add({ targets: obs.container, scaleX: 0, scaleY: 0, alpha: 0, y: obs.container.y - 80, duration: 400, ease: 'Back.easeIn', onComplete: () => obs.container.destroy() }) },
    })

    this.spawnSparkles(cx, cy, 20)
    dispatchToReact(ZONE2_EVENTS.PROGRESS, { solved: this.solvedCount, total: 8 })
    this.obsCooldown = true
    this.time.delayedCall(700, () => { this.obsCooldown = false })
  }

  private onBossPhaseCleared() {
    const hpIdx = this.bossPhase - 1
    if (this.bossHP[hpIdx]) {
      this.tweens.add({
        targets: this.bossHP[hpIdx], scaleX: 0, duration: 400, ease: 'Back.easeIn',
        onComplete: () => { if (this.bossHP[hpIdx]) this.bossHP[hpIdx].setFillStyle(0x1e0a5e) },
      })
    }
    this.tweens.add({ targets: this.bossContainer, alpha: 0.2, duration: 100, yoyo: true, repeat: 5, ease: 'Linear' })

    if (this.bossPhase >= 3) {
      this.time.delayedCall(900, () => this.defeatBoss())
    } else {
      this.audio.playSfx('boss_phase')
      this.activeBossPhase    = 0
      this.bossBlocked        = false
      this.interPhaseCooldown = true
      this.time.delayedCall(1500, () => { this.interPhaseCooldown = false })
    }
  }

  private defeatBoss() {
    this.cameras.main.shake(600, 0.022)
    this.spawnSparkles(BOSS_X, this.groundY - 100, 40)
    this.spawnSparkles(BOSS_X - 70, this.groundY - 70, 25)
    this.spawnSparkles(BOSS_X + 70, this.groundY - 70, 25)
    this.tweens.add({
      targets: this.bossContainer, scaleX: 0, scaleY: 0, alpha: 0, y: this.groundY + 100, duration: 700, ease: 'Back.easeIn',
      onComplete: () => {
        this.bossContainer.destroy()
        this.bossPhase   = 4
        this.bossBlocked = false
        this.time.delayedCall(600, () => this.launchCelebration())
      },
    })
  }

  // ═══════════════════════════════════════════════════════════
  // CELEBRATION — Zone Complete
  // ═══════════════════════════════════════════════════════════

  private launchCelebration() {
    this.audio.playSfx('zone_complete')
    this.audio.playMusic('bg_victory')

    const cx = this.screenW / 2
    const cy = this.screenH / 2

    // Screen flash — crystal purple
    const flash = this.add.rectangle(cx, cy, this.screenW, this.screenH, 0x8b5cf6, 0.75)
      .setScrollFactor(0).setDepth(70)
    this.tweens.add({ targets: flash, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => flash.destroy() })

    // Dark overlay
    const overlay = this.add.rectangle(cx, cy, this.screenW, this.screenH, 0x000000, 0.55)
      .setScrollFactor(0).setDepth(68)

    // Trophy
    const trophy = this.add.text(cx, cy - 150, '🏆', { fontSize: '90px' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(75).setAlpha(0).setScale(0.1)
    this.tweens.add({
      targets: trophy, alpha: 1, scaleX: 1.2, scaleY: 1.2, duration: 600, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: trophy, scaleX: 1, scaleY: 1, duration: 250, ease: 'Sine.easeOut' })
        this.tweens.add({ targets: trophy, y: cy - 165, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      },
    })

    // BOSS DEFEATED headline
    const headline = this.add.text(cx, cy - 50, 'BOSS DEFEATED!', {
      fontSize: '58px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#c4b5fd', stroke: '#4c1d95', strokeThickness: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(75).setAlpha(0).setScale(0.3)
    this.tweens.add({
      targets: headline, alpha: 1, scaleX: 1, scaleY: 1, duration: 500, delay: 150, ease: 'Back.easeOut',
      onComplete: () => { this.tweens.add({ targets: headline, scaleX: 1.06, scaleY: 1.06, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) },
    })

    // Sub-line
    const sub = this.add.text(cx, cy + 20, 'Stone Warden Vanquished! 🦇', {
      fontSize: '26px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#e0d7ff', stroke: '#1e0a5e', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(75).setAlpha(0)
    this.tweens.add({ targets: sub, alpha: 1, y: cy + 12, duration: 400, delay: 350, ease: 'Quad.easeOut' })

    // Crystal burst from center
    this.time.delayedCall(200, () => {
      for (let i = 0; i < 14; i++) {
        const angle   = (i / 14) * Math.PI * 2
        const crystal = this.add.text(cx, cy, '💎', { fontSize: '20px' })
          .setOrigin(0.5).setScrollFactor(0).setDepth(73)
        this.tweens.add({
          targets: crystal,
          x: cx + Math.cos(angle) * 220, y: cy + Math.sin(angle) * 170,
          alpha: 0, scaleX: 0, scaleY: 0, duration: 900, ease: 'Quad.easeOut',
          onComplete: () => crystal.destroy(),
        })
      }
    })

    // Firework volleys
    const fwPoints = [
      { x: cx - 210, y: cy - 110 }, { x: cx + 210, y: cy - 90 },
      { x: cx - 100, y: cy - 180 }, { x: cx + 110, y: cy - 170 },
      { x: cx,       y: cy - 220 }, { x: cx - 270, y: cy + 10  },
      { x: cx + 270, y: cy - 10  },
    ]
    fwPoints.forEach(({ x, y }, i) => this.time.delayedCall(i * 180, () => this.spawnFirework(x, y)))
    this.time.delayedCall(1400, () => {
      if (!this.scene.isActive()) return
      fwPoints.forEach(({ x, y }, i) => {
        this.time.delayedCall(i * 140, () => this.spawnFirework(x + (Math.random() - 0.5) * 100, y + (Math.random() - 0.5) * 80))
      })
    })

    // Bat confetti rain 🦇
    for (let i = 0; i < 60; i++) {
      this.time.delayedCall(Math.random() * 2200, () => {
        if (!this.scene.isActive()) return
        const caveColors = [0x8b5cf6, 0x06b6d4, 0xa78bfa, 0x38bdf8, 0xec4899, 0xffffff, 0x7c3aed, 0xffd700]
        const c = this.add.rectangle(
          Math.random() * this.screenW, -12,
          5 + Math.random() * 7, 10 + Math.random() * 10,
          caveColors[Math.floor(Math.random() * caveColors.length)]
        ).setScrollFactor(0).setDepth(72).setRotation(Math.random() * Math.PI)
        this.tweens.add({
          targets: c, y: this.screenH + 20, rotation: c.rotation + (Math.random() - 0.5) * 8,
          duration: 1600 + Math.random() * 1000, ease: 'Linear',
          onComplete: () => { if (c.active) c.destroy() },
        })
      })
    }

    // Fade out and dispatch ZONE_COMPLETE
    this.time.delayedCall(3000, () => {
      if (!this.scene.isActive()) return
      this.tweens.add({ targets: [overlay, headline, sub], alpha: 0, duration: 700, ease: 'Quad.easeIn' })
      this.tweens.add({
        targets: trophy, alpha: 0, duration: 700, ease: 'Quad.easeIn',
        onComplete: () => {
          if (overlay.active)  overlay.destroy()
          if (headline.active) headline.destroy()
          if (sub.active)      sub.destroy()
          if (trophy.active)   trophy.destroy()

          this.game.destroy(true, false)
          dispatchToReact(ZONE2_EVENTS.ZONE_COMPLETE, {})
        },
      })
    })
  }

  // ═══════════════════════════════════════════════════════════
  // FX HELPERS
  // ═══════════════════════════════════════════════════════════

  private spawnFirework(x: number, y: number) {
    const colors = [0x8b5cf6, 0x06b6d4, 0xa78bfa, 0x38bdf8, 0xec4899, 0xffffff, 0x7c3aed, 0xffd700]
    const count  = 18
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3
      const dist  = 55 + Math.random() * 110
      const dot   = this.add.circle(x, y, 3 + Math.random() * 6, colors[Math.floor(Math.random() * colors.length)]).setScrollFactor(0).setDepth(71)
      this.tweens.add({
        targets: dot, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, duration: 450 + Math.random() * 300, ease: 'Cubic.easeOut',
        onComplete: () => { this.tweens.add({ targets: dot, alpha: 0, scaleX: 0, scaleY: 0, duration: 350, ease: 'Quad.easeIn', onComplete: () => dot.destroy() }) },
      })
    }
    const burst = this.add.circle(x, y, 20, 0xffffff).setScrollFactor(0).setDepth(71)
    this.tweens.add({ targets: burst, scaleX: 3.5, scaleY: 3.5, alpha: 0, duration: 280, ease: 'Quad.easeOut', onComplete: () => burst.destroy() })
  }

  private spawnSparkles(x: number, y: number, count = 12) {
    const colors = [0x8b5cf6, 0x06b6d4, 0xa78bfa, 0x38bdf8, 0xec4899]
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
      const d     = 80 + Math.random() * 120
      const dot   = this.add.circle(x, y, 4 + Math.random() * 4, colors[Math.floor(Math.random() * colors.length)]).setDepth(20)
      this.tweens.add({ targets: dot, x: x + Math.cos(angle) * d, y: y + Math.sin(angle) * d, alpha: 0, scaleX: 0, scaleY: 0, duration: 600 + Math.random() * 400, ease: 'Quad.easeOut', onComplete: () => dot.destroy() })
    }
  }

  private flashPlayer() {
    this.tweens.add({ targets: this.player, alpha: 0.3, duration: 100, yoyo: true, repeat: 4, ease: 'Linear', onComplete: () => this.player.setAlpha(1) })
  }

  private pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
  }
}
