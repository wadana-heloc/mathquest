// ─────────────────────────────────────────────────────────────
//  MathQuest · src/lib/phaser/Zone3Scene.ts  — Zone 3 "Iron Summit"
//
//  A blazing forge on a mountain summit. Glowing embers, iron platforms,
//  and Ignis the Phoenix as your companion.
//
//  Architecture mirrors Zone2Scene exactly so the React layer
//  (Zone3Game.tsx) can follow the same event-bridge pattern.
//
//  Key design principles:
//    • Crystals → Forge Embers 🔥 (collectible)
//    • Companion: Ignis the Phoenix — soars above the player
//    • Boss: The Iron Titan — a massive forge golem with molten eyes
//    • Environment: dark rocky mountain, ember cracks, iron platforms
//    • Wrong-answer: neutral flash, never shame
// ─────────────────────────────────────────────────────────────

import Phaser from 'phaser'
import { AudioManager } from './AudioManager'

export const ZONE3_EVENTS = {
  SHOW_PROBLEM:    'zone3:showProblem',
  ANSWER_RESULT:   'zone3:answerResult',
  ZONE_COMPLETE:   'zone3:zoneComplete',
  BOSS_PHASE:      'zone3:bossPhase',
  PROGRESS:        'zone3:progress',
  STREAK_INCREASE: 'zone3:streakIncrease',
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
  { id: 'obj1', problemId: 'Z3-OBJ-01', x: 600,  label: 'Cogwheel',      emoji: '⚙️', color: 0x78716c, width: 70,  height: 60 },
  { id: 'obj2', problemId: 'Z3-OBJ-02', x: 1000, label: 'Forge Hammer',  emoji: '🔨', color: 0xf97316, width: 60,  height: 80 },
  { id: 'obj3', problemId: 'Z3-OBJ-03', x: 1420, label: 'Iron Chain',    emoji: '🔗', color: 0x6b7280, width: 90,  height: 70 },
  { id: 'obj4', problemId: 'Z3-OBJ-04', x: 1850, label: 'Iron Boulder',  emoji: '🪨', color: 0x57534e, width: 80,  height: 70 },
  { id: 'obj5', problemId: 'Z3-OBJ-05', x: 2280, label: 'Blast Furnace', emoji: '🔥', color: 0xef4444, width: 70,  height: 80 },
  { id: 'obj6', problemId: 'Z3-OBJ-06', x: 2720, label: 'Pickaxe',       emoji: '⛏️', color: 0x94a3b8, width: 80,  height: 70 },
  { id: 'obj7', problemId: 'Z3-OBJ-07', x: 3160, label: 'Iron Shield',   emoji: '🛡️', color: 0x475569, width: 70,  height: 60 },
  { id: 'obj8', problemId: 'Z3-OBJ-08', x: 3600, label: 'Forge Anvil',   emoji: '⚒️', color: 0x292524, width: 60,  height: 80 },
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

const PLATFORMS: PlatformConfig[] = [
  { x: 320,  yRatio: 0.68, width: 120               },
  { x: 780,  yRatio: 0.65, width: 130, bob: 2, emoji: '⚙️' },
  { x: 1210, yRatio: 0.66, width: 120               },
  { x: 1630, yRatio: 0.64, width: 130, bob: 2       },
  { x: 2060, yRatio: 0.67, width: 120,        emoji: '🔥' },
  { x: 2490, yRatio: 0.65, width: 140, bob: 2       },
  { x: 2930, yRatio: 0.63, width: 130,        emoji: '⚙️' },
  { x: 3370, yRatio: 0.66, width: 120, bob: 2       },
  { x: 3810, yRatio: 0.64, width: 130               },
  { x: 4010, yRatio: 0.68, width: 110, bob: 2, emoji: '🔥' },
]

const EMBER_POSITIONS: { x: number; yRatio: number }[] = [
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

const COMPANION_MESSAGES = {
  start:        ["I'm Ignis! 🔥", "Forge ahead! ⚙️", "The summit awaits! ⛰️"],
  approach:     ["A puzzle! 🧩", "Think carefully! 🧠", "You've got this! ⚡"],
  correct:      ["BLAZING! 🔥", "Red hot answer! 🌟", "Forged in fire! ⚙️", "Brilliant! ✨"],
  wrong:        ["Try again! 💪", "So close! 🔥", "Keep pushing! ⛰️"],
  jump:         ["Soaring! 🔥", "High flyer! ✨", "Like a phoenix! 🐦‍🔥"],
  bossNear:     ["The Titan! 👀", "Stay strong! ⚔️", "I believe in you! 💖"],
  emberCollect: ["An ember! 🔥", "Still burning! ✨", "Forge power! ⚙️"],
  idle:         ["*crackle* 🔥", "Feel the heat? 🌡️", "The forge sings..."],
}

export class Zone3Scene extends Phaser.Scene {
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

  // ── Touch ──────────────────────────────────────────────────
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

  // ── Boss molten rock projectiles ───────────────────────────
  private bossProjectiles: {
    obj:     Phaser.GameObjects.Arc
    velX:    number
    velY:    number
    bounces: number
  }[] = []
  private bossAttackTimer    = 0
  private bossAttackInterval = 2600

  // ── Companion — Ignis the Phoenix ─────────────────────────
  private companion!:            Phaser.GameObjects.Container
  private companionX             = 80
  private companionTargetX       = 80
  private companionY             = 0
  private companionTime          = 0
  private companionEmoteTween:   Phaser.Tweens.Tween | null = null
  private companionSpeechBubble!: Phaser.GameObjects.Container
  private companionSpeechText!:   Phaser.GameObjects.Text
  private companionWingL!:        Phaser.GameObjects.Triangle
  private companionWingR!:        Phaser.GameObjects.Triangle

  // ── Platforms ──────────────────────────────────────────────
  private platformObjects: {
    container: Phaser.GameObjects.Container
    worldX:    number
    baseY:     number
    width:     number
    bob:       number
    bobTime:   number
  }[] = []

  // ── Forge Embers (collectible) ─────────────────────────────
  private emberObjects: {
    obj:       Phaser.GameObjects.Text
    x:         number
    y:         number
    collected: boolean
    glowRing?: Phaser.GameObjects.Arc
  }[] = []
  private embersCollected = 0
  private emberHUD!:       Phaser.GameObjects.Container
  private emberCountText!: Phaser.GameObjects.Text

  // ── Rising sparks (ambient) ────────────────────────────────
  private sparkTimer = 0
  private activeSparks: {
    obj:  Phaser.GameObjects.Arc
    velY: number
    velX: number
  }[] = []

  // ── Instructions ───────────────────────────────────────────
  private instructionsShown = false

  // ── Cleanup ────────────────────────────────────────────────
  private answerListener!:        (e: Event) => void
  private streakListener!:        (e: Event) => void
  private audioSettingsListener!: (e: Event) => void

  // ── Audio ──────────────────────────────────────────────────
  private audio!: AudioManager

  constructor() { super({ key: 'Zone3Scene' }) }

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
    ;(window as any).__zone3Scene = this

    this.createMountainBackground()
    this.createMountainPeaks()
    this.createForgeGlow()
    this.createGround()
    this.createZoneSign()
    this.createPlatforms()
    this.createEmbers()
    this.createObstacles()
    this.createBoss()
    this.createAmbientForge()
    this.createPlayer()
    this.createCompanion()
    this.createEmberHUD()

    this.cursors  = this.input.keyboard!.createCursorKeys()
    this.keyA     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.keyD     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    this.keyW     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W)
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    this.answerListener = (e: Event) => {
      const { correct, obstacleId } = (e as CustomEvent).detail
      this.handleAnswerResult(correct, obstacleId)
    }
    window.addEventListener(ZONE3_EVENTS.ANSWER_RESULT, this.answerListener)

    this.cameras.main.setBounds(0, 0, this.worldWidth, this.screenH)
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08)

    this.time.delayedCall(800,  () => this.showInstructions())
    this.time.delayedCall(200,  () => dispatchToReact(ZONE3_EVENTS.PROGRESS, { solved: 0, total: 8 }))
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
    window.addEventListener(ZONE3_EVENTS.STREAK_INCREASE, this.streakListener)
  }

  // ═══════════════════════════════════════════════════════════
  // SHUTDOWN
  // ═══════════════════════════════════════════════════════════

  shutdown() {
    window.removeEventListener(ZONE3_EVENTS.ANSWER_RESULT, this.answerListener)
    window.removeEventListener(ZONE3_EVENTS.STREAK_INCREASE, this.streakListener)
    window.removeEventListener('mq:audioSettings', this.audioSettingsListener)
    this.audio?.destroy()
    ;(window as any).__zone3Scene = null
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
      background: rgba(10,8,6,0.92);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Nunito', 'Segoe UI', sans-serif;
    `

    overlay.innerHTML = `
      <div style="
        background: #120e08;
        border: 3px solid #f97316;
        border-radius: 20px;
        padding: 28px 32px;
        max-width: 560px; width: 92vw;
        box-shadow: 0 0 40px rgba(249,115,22,0.35), 0 0 80px rgba(239,68,68,0.15);
        position: relative;
      ">
        <div style="
          position: absolute; top: 0; left: 0; right: 0; height: 60px;
          background: linear-gradient(90deg,#7c2d12,#1c0a00);
          border-radius: 17px 17px 0 0;
        "></div>

        <h2 style="
          position: relative; text-align: center; margin: 0 0 22px 0;
          font-size: 22px; font-weight: 900; color: #fed7aa;
          text-shadow: 0 0 18px rgba(249,115,22,0.8);
        ">⚙️ IRON SUMMIT ⚙️</h2>

        <table style="width:100%; border-collapse: collapse; position: relative;">
          ${[
            ['⬅️ ➡️',  'Arrow keys or A / D',  'to walk the iron path'],
            ['⬆️',      'Up arrow or Space',     'to jump onto iron platforms'],
            ['🧩',      'Walk into obstacles',   'to get a math puzzle'],
            ['✅',      'Solve the puzzle',      'earn a coin &amp; forge on'],
            ['🔥',      'Collect embers',        'by jumping to ledges'],
            ['🐦‍🔥',     'Ignis the Phoenix',     'cheers you on!'],
            ['👑',      'Defeat the Iron Titan', 'to complete the zone!'],
          ].map(([icon, bold, rest], i, arr) => `
            <tr style="border-bottom: ${i < arr.length - 1 ? '1px solid rgba(249,115,22,0.15)' : 'none'}">
              <td style="padding: 9px 10px 9px 0; font-size: 20px; width: 42px;">${icon}</td>
              <td style="padding: 9px 8px; font-size: 14px; font-weight: 800; color: #fed7aa; white-space: nowrap;">${bold}</td>
              <td style="padding: 9px 0; font-size: 14px; color: #fde8d0;">${rest}</td>
            </tr>
          `).join('')}
        </table>

        <p style="
          text-align: center; margin: 18px 0 6px 0;
          font-size: 14px; font-weight: 800; color: #fed7aa;
        ">💡 Every math coin you earn = 1 🔥 Ember at the end!</p>

        <p id="mq-tap-hint" style="
          text-align: center; margin: 0;
          font-size: 13px; color: #fde8d0; opacity: 0.9;
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
  // ENVIRONMENT — Iron Summit
  // ═══════════════════════════════════════════════════════════

  private createMountainBackground() {
    const rt  = this.make.renderTexture({ width: this.screenW, height: this.screenH }, true)
    const gfx = this.make.graphics({ x: 0, y: 0 })
    const steps      = 60
    const topColor   = new Phaser.Display.Color(12, 4, 22)   // deep volcanic purple
    const bottomColor= new Phaser.Display.Color(68, 18, 2)   // rich molten amber-red
    for (let i = 0; i < steps; i++) {
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(topColor, bottomColor, steps, i)
      gfx.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1)
      gfx.fillRect(0, (i / steps) * this.screenH, this.screenW, this.screenH / steps + 2)
    }
    rt.draw(gfx)
    gfx.destroy()
    rt.setPosition(0, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(0)

    // Distant rock formations on world canvas
    for (let i = 0; i < 14; i++) {
      const wx = Math.random() * this.worldWidth
      const wy = 20 + Math.random() * (this.groundY * 0.55)
      const ww = 50 + Math.random() * 130
      const wh = 90 + Math.random() * 200
      this.add.rectangle(wx, wy, ww, wh, 0x2d0d00, 0.55).setDepth(0.5)
    }
  }

  private createMountainPeaks() {
    // Far distant mountains (very slow parallax)
    const farPeaks = [
      { x: 80,  h: 200, w: 220, sx: 0.03 },
      { x: 280, h: 160, w: 180, sx: 0.04 },
      { x: 450, h: 240, w: 260, sx: 0.03 },
      { x: 650, h: 180, w: 200, sx: 0.04 },
      { x: 820, h: 220, w: 240, sx: 0.03 },
    ]
    farPeaks.forEach(({ x, h, w, sx }) => {
      this.add.triangle(x, this.screenH * 0.56, -w/2, 0, w/2, 0, 0, -h, 0x3d1200, 0.75)
        .setScrollFactor(sx).setDepth(0.5)
    })

    // Mid-distance mountains
    const midPeaks = [
      { x: 150, h: 160, w: 170, sx: 0.07 },
      { x: 350, h: 200, w: 200, sx: 0.08 },
      { x: 520, h: 140, w: 150, sx: 0.07 },
      { x: 700, h: 180, w: 180, sx: 0.08 },
    ]
    midPeaks.forEach(({ x, h, w, sx }) => {
      this.add.triangle(x, this.screenH * 0.63, -w/2, 0, w/2, 0, 0, -h, 0x5c2000, 0.85)
        .setScrollFactor(sx).setDepth(0.6)
      // Ember glow on peak tips — vivid
      this.add.triangle(x, this.screenH * 0.63 - h + 10, -18, 0, 18, 0, 0, -22, 0xf97316, 0.50)
        .setScrollFactor(sx).setDepth(0.7)
    })

    // Floating ember motes (parallax atmosphere)
    for (let m = 0; m < 22; m++) {
      const mx  = 100 + Math.random() * (this.screenW - 200)
      const my  = 60  + Math.random() * (this.groundY * 0.65)
      const col = [0xf97316, 0xfbbf24, 0xef4444, 0xfde68a][Math.floor(Math.random() * 4)]
      const mote = this.add.circle(mx, my, 1.5 + Math.random() * 3, col, 0.85)
        .setScrollFactor(0.04).setDepth(1)
      this.tweens.add({
        targets: mote,
        y: my - 30 - Math.random() * 40,
        alpha: { from: 0.85, to: 0 },
        duration: 1800 + Math.random() * 2000,
        yoyo: false, repeat: -1, ease: 'Sine.easeOut',
        onRepeat: () => { mote.y = my + Math.random() * 15 },
      })
    }
  }

  private createForgeGlow() {
    // Warm glow near the ground — forge below leaks upward
    for (let g = 0; g < 6; g++) {
      const gx = (g + 0.5) * (this.screenW / 6)
      const glow = this.add.ellipse(gx, this.groundY + 10, 340 + g * 50, 90, 0xf97316, 0.15)
        .setScrollFactor(0).setDepth(1)
      this.tweens.add({
        targets: glow, alpha: { from: 0.15, to: 0.35 }, scaleX: 1.2,
        duration: 1800 + g * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
    }

    // Wide horizon ember bloom — dramatic forge sky
    const bloom = this.add.ellipse(this.screenW / 2, this.groundY - 40, this.screenW * 1.4, 180, 0xef4444, 0.10)
      .setScrollFactor(0).setDepth(1)
    this.tweens.add({ targets: bloom, alpha: { from: 0.10, to: 0.22 }, duration: 2800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    // Glow clusters on world (static parallax)
    const clusters = [
      { x: 100, y: this.screenH * 0.4,  sx: 0.05, col: 0xf97316, r: 70 },
      { x: 320, y: this.screenH * 0.55, sx: 0.06, col: 0xef4444, r: 80 },
      { x: 540, y: this.screenH * 0.35, sx: 0.04, col: 0xfbbf24, r: 65 },
      { x: 740, y: this.screenH * 0.45, sx: 0.05, col: 0xf97316, r: 75 },
    ]
    clusters.forEach(({ x, y, sx, col, r }) => {
      const glow = this.add.circle(x, y, r, col, 0.15).setScrollFactor(sx).setDepth(1)
      this.tweens.add({
        targets: glow, alpha: { from: 0.15, to: 0.38 }, scaleX: 1.4, scaleY: 1.4,
        duration: 2200 + Math.random() * 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
    })
  }

  private createGround() {
    const groundStartY = this.groundY
    const groundH      = this.screenH - groundStartY

    // Main ground — warm copper-rock
    this.add.rectangle(this.worldWidth / 2, groundStartY + groundH / 2, this.worldWidth, groundH, 0x2d1200).setDepth(2)

    // Top edge — bright copper glow strip
    this.add.rectangle(this.worldWidth / 2, groundStartY + 8, this.worldWidth, 16, 0x7c3200).setDepth(2)

    // Rock texture — warm rust tones
    const rockColors = [0x3d1800, 0x2a1200, 0x4a2000, 0x1a0a00]
    for (let i = 0; i < 200; i++) {
      const rx = Math.random() * this.worldWidth
      const ry = groundStartY + 12 + Math.random() * 70
      const rs = 2 + Math.random() * 8
      this.add.ellipse(rx, ry, rs * 1.6, rs, rockColors[Math.floor(Math.random() * rockColors.length)], 0.9).setDepth(2)
    }

    // Glowing ember cracks — vivid forge heat
    for (let i = 0; i < 50; i++) {
      const cx = Math.random() * this.worldWidth
      const cy = groundStartY + 4 + Math.random() * 18
      const cw = 10 + Math.random() * 55
      const col = Math.random() > 0.4 ? 0xf97316 : 0xfbbf24
      const crack = this.add.rectangle(cx, cy, cw, 2 + Math.random() * 3, col, 0.88)
        .setDepth(2).setAngle(Math.random() * 30 - 15)
      this.tweens.add({
        targets: crack, alpha: { from: 0.88, to: 0.22 },
        duration: 1000 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
    }

    // Forge fire clusters along the ground
    const forgeColors = [0xf97316, 0xef4444, 0xfbbf24]
    for (let i = 0; i < 50; i++) {
      const fx = 100 + Math.random() * (this.worldWidth - 200)
      const fy = groundStartY + 5 + Math.random() * 22
      const fh = 8 + Math.random() * 20
      const fw = 4 + Math.random() * 7
      const fc = forgeColors[Math.floor(Math.random() * forgeColors.length)]
      this.add.triangle(fx, fy, -fw/2, 0, fw/2, 0, 0, -fh, fc, 0.85).setDepth(2)
      const glow = this.add.circle(fx, fy - fh/2, 5, fc, 0.45).setDepth(2)
      this.tweens.add({
        targets: glow, alpha: { from: 0.45, to: 0.08 },
        duration: 800 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
    }

    // Iron ore / rock decorations
    for (let i = 0; i < 20; i++) {
      const ox = 200 + Math.random() * (this.worldWidth - 400)
      const oy = groundStartY + 8 + Math.random() * 30
      const ore = this.add.text(ox, oy, '🪨', { fontSize: `${8 + Math.random() * 10}px` })
        .setDepth(2).setOrigin(0.5).setAlpha(0.45)
      this.tweens.add({
        targets: ore, alpha: 0.65,
        duration: 2000 + Math.random() * 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
    }
  }

  private createZoneSign() {
    const signX = 260
    const signY = this.groundY - 80
    const sign  = this.add.container(signX, signY).setDepth(4)

    const post  = this.add.rectangle(0, 60, 10, 120, 0x44403c)
    const board = this.add.rectangle(0, 0, 180, 72, 0x120e08).setStrokeStyle(4, 0xf97316)
    const glow  = this.add.rectangle(0, 0, 180, 72, 0xf97316, 0.05)

    const title = this.add.text(0, -14, '⚙️ IRON SUMMIT', {
      fontSize: '13px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold', color: '#fed7aa',
    }).setOrigin(0.5)
    const sub = this.add.text(0, 10, 'Zone 3 · Solve to advance!', {
      fontSize: '10px', fontFamily: 'Nunito, sans-serif', color: '#fb923c',
    }).setOrigin(0.5)

    sign.add([post, board, glow, title, sub])
    sign.setAlpha(0).setY(signY - 30)
    this.tweens.add({ targets: sign, alpha: 1, y: signY, duration: 700, delay: 300, ease: 'Back.easeOut' })
    this.tweens.add({ targets: sign, angle: 2, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  // ═══════════════════════════════════════════════════════════
  // PLATFORMS — Iron/Steel Ledges
  // ═══════════════════════════════════════════════════════════

  private createPlatforms() {
    PLATFORMS.forEach((cfg, idx) => {
      const baseY  = this.screenH * cfg.yRatio
      const bobAmt = cfg.bob ?? 0
      const container = this.add.container(cfg.x, baseY).setDepth(3)

      const shadow   = this.add.ellipse(2, 12, cfg.width + 10, 16, 0x000000, 0.3)
      const base     = this.add.rectangle(0, 0, cfg.width, 22, 0x3d1800)
      const platTop  = this.add.rectangle(0, -6, cfg.width, 12, 0x7c3200)
      const glowTop  = this.add.rectangle(0, -10, cfg.width, 5, 0xfbbf24, 0.7)

      // Iron spike decorations along the top edge
      for (let e = 0; e < 5; e++) {
        const ex  = -cfg.width / 2 + (e + 0.5) * (cfg.width / 5)
        const eh  = 5 + Math.random() * 6
        const ew  = 3 + Math.random() * 3
        const col = Math.random() > 0.5 ? 0xf97316 : 0xfbbf24
        container.add(this.add.triangle(ex, -12, -ew/2, 0, ew/2, 0, 0, -eh, col, 0.7))
      }

      // Chain supports underneath
      for (let d = 0; d < 3; d++) {
        const dripX = -cfg.width / 3 + d * (cfg.width / 3)
        container.add(this.add.rectangle(dripX, 14, 3, 10 + Math.random() * 6, 0x44403c))
      }

      container.add([shadow, base, platTop, glowTop])

      // Pulsing ember edge glow — vivid
      const edgeGlow = this.add.rectangle(0, -8, cfg.width + 4, 16, 0xf97316, 0.35)
      this.tweens.add({
        targets: edgeGlow, alpha: { from: 0.35, to: 0.70 }, scaleX: 1.03,
        duration: 1500 + idx * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })
      container.add(edgeGlow)

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
  // FORGE EMBERS — Collectibles
  // ═══════════════════════════════════════════════════════════

  private createEmbers() {
    EMBER_POSITIONS.forEach(({ x, yRatio }) => {
      const worldY   = this.screenH * yRatio
      const glowRing = this.add.circle(x, worldY, 20, 0xf97316, 0.18).setDepth(5)
      const ember    = this.add.text(x, worldY, '🔥', { fontSize: '22px' }).setOrigin(0.5).setDepth(6)

      this.tweens.add({ targets: ember, y: worldY - 10, duration: 700 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.tweens.add({ targets: ember, angle: 6, duration: 1800 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.tweens.add({ targets: glowRing, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 1400 + Math.random() * 500, repeat: -1, ease: 'Quad.easeOut' })

      this.emberObjects.push({ obj: ember, x, y: worldY, collected: false, glowRing })
    })
  }

  private createEmberHUD() {
    this.emberHUD = this.add.container(this.screenW - 100, 18).setScrollFactor(0).setDepth(100)
    const bg = this.add.graphics()
    bg.fillStyle(0x0a0806, 0.65)
    bg.fillRoundedRect(-50, -16, 100, 32, 10)
    bg.lineStyle(2, 0xf97316, 0.7)
    bg.strokeRoundedRect(-50, -16, 100, 32, 10)
    const icon = this.add.text(-32, 0, '🔥', { fontSize: '16px' }).setOrigin(0.5)
    this.emberCountText = this.add.text(4, 0, `0 / ${EMBER_POSITIONS.length}`, {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold', color: '#fed7aa',
    }).setOrigin(0.5)
    this.emberHUD.add([bg, icon, this.emberCountText])
  }

  // ═══════════════════════════════════════════════════════════
  // PLAYER — Iron Summit Warrior
  // ═══════════════════════════════════════════════════════════

  private createPlayer() {
    this.player = this.add.container(this.playerX, this.playerY).setDepth(10)

    const shadow  = this.add.ellipse(0, 34, 46, 12, 0x000000, 0.2)
    this.legL     = this.add.rectangle(-11, 26, 12, 20, 0x1e293b)
    this.legR     = this.add.rectangle( 11, 26, 12, 20, 0x1e293b)
    const shoeL   = this.add.ellipse(-13, 38, 20, 10, 0x44403c)
    const shoeR   = this.add.ellipse( 13, 38, 20, 10, 0x44403c)
    const shoeHL  = this.add.ellipse(-16, 35,  8,  5, 0x78716c, 0.6)
    const shoeHR  = this.add.ellipse( 10, 35,  8,  5, 0x78716c, 0.6)
    const body    = this.add.rectangle(0, 4, 40, 46, 0x334155)
    const bodyHL  = this.add.rectangle(-8, -2, 12, 36, 0x475569, 0.5)
    const belt    = this.add.rectangle(0, 16, 40, 6, 0x1c1614)
    const buckle  = this.add.rectangle(0, 16, 10, 5, 0xf97316)
    const armL    = this.add.rectangle(-24,  6, 10, 24, 0x334155)
    const armR    = this.add.rectangle( 24,  6, 10, 24, 0x334155)
    const gloveL  = this.add.circle(-24, 20, 7, 0x78716c)
    const gloveR  = this.add.circle( 24, 20, 7, 0x78716c)
    const neck    = this.add.rectangle(0, -16, 16, 10, 0xfbbf24)
    const head    = this.add.circle(0, -32, 22, 0xfbbf24)
    const headHL  = this.add.ellipse(-6, -40, 12, 8, 0xfde68a, 0.5)
    const eyeLW   = this.add.ellipse(-8, -35, 13, 15, 0xffffff)
    const eyeRW   = this.add.ellipse( 8, -35, 13, 15, 0xffffff)
    const eyeLP   = this.add.circle(-8, -34, 5, 0x1c1614)
    const eyeRP   = this.add.circle( 8, -34, 5, 0x1c1614)
    const eyeLG   = this.add.circle(-6, -37, 2, 0xffffff)
    const eyeRG   = this.add.circle(10, -37, 2, 0xffffff)
    const browL   = this.add.rectangle(-9, -46, 12, 3, 0x292524).setAngle(-8)
    const browR   = this.add.rectangle( 9, -46, 12, 3, 0x292524).setAngle(8)
    const nose    = this.add.circle(0, -29, 3, 0xfb923c)
    const smile   = this.add.arc(0, -23, 9, 0, 180, false, 0x292524)
    // Iron helmet accent
    const helmetBand = this.add.rectangle(0, -50, 24, 4, 0x44403c)
    const helmetGlow = this.add.rectangle(0, -52, 20, 3, 0xf97316, 0.6)
    this.tweens.add({ targets: helmetGlow, alpha: { from: 0.6, to: 0.15 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    this.player.add([
      shadow,
      this.legL, this.legR, shoeL, shoeR, shoeHL, shoeHR,
      body, bodyHL, belt, buckle,
      armL, armR, gloveL, gloveR,
      neck, head, headHL,
      eyeLW, eyeRW, eyeLP, eyeRP, eyeLG, eyeRG,
      browL, browR, nose, smile,
      helmetBand, helmetGlow,
    ])

    this.tweens.add({ targets: this.player, y: this.playerY - 5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  // ═══════════════════════════════════════════════════════════
  // COMPANION — Ignis the Phoenix 🐦‍🔥
  // ═══════════════════════════════════════════════════════════

  private createCompanion() {
    this.companion = this.add.container(this.companionX, this.companionY).setDepth(9)

    // Body aura
    const bodyGlow = this.add.circle(0, 0, 20, 0xf97316, 0.22)

    // Body — rounded bird shape
    const body   = this.add.ellipse(0, 2, 26, 20, 0xef4444)
    const bodyHL = this.add.ellipse(-4, -2, 10, 7, 0xf97316, 0.6)

    // Wings — spread bird-style triangles
    this.companionWingL = this.add.triangle(-14, -2, -40, -18, -12, -6, -8, 10, 0xf97316, 0.9)
    this.companionWingR = this.add.triangle( 14, -2,  40, -18,  12, -6,  8, 10, 0xf97316, 0.9)

    // Wing tip yellow glow
    const wTipL = this.add.triangle(-22, -10, -38, -18, -26, -14, -24, -4, 0xfbbf24, 0.7)
    const wTipR = this.add.triangle( 22, -10,  38, -18,  26, -14,  24, -4, 0xfbbf24, 0.7)

    // Head
    const head   = this.add.circle(-2, -10, 9, 0xef4444)
    const headHL = this.add.ellipse(-4, -14, 6, 4, 0xf97316, 0.5)

    // Crest feathers
    const crest1 = this.add.triangle(-2, -18, -4, -18, 0, -18, -2, -32, 0xfbbf24, 0.9)
    const crest2 = this.add.triangle( 2, -16,  0, -16, 4, -16,  2, -26, 0xf97316, 0.9)

    // Beak
    const beak = this.add.triangle(8, -10, 4, -12, 4, -8, 14, -10, 0xfbbf24)

    // Eyes
    const eyeL   = this.add.circle(-4, -12, 4, 0xfef08a)
    const eyeR   = this.add.circle( 2, -12, 4, 0xfef08a)
    const pupilL = this.add.circle(-4, -12, 1.5, 0x1c1614)
    const pupilR = this.add.circle( 2, -12, 1.5, 0x1c1614)
    const glintL = this.add.circle(-3, -14, 1, 0xffffff)
    const glintR = this.add.circle( 3, -14, 1, 0xffffff)

    // Eye glow
    const eyeGlowL = this.add.circle(-4, -12, 7, 0xfbbf24, 0.2)
    const eyeGlowR = this.add.circle( 2, -12, 7, 0xfbbf24, 0.2)
    this.tweens.add({ targets: [eyeGlowL, eyeGlowR], alpha: { from: 0.2, to: 0.05 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    // Tail feathers — orange, yellow, red
    const tailL = this.add.triangle(-8, 8, -12, 4, -6, 4, -10, 18, 0xef4444, 0.85)
    const tailM = this.add.triangle( 0, 8,  -4, 4,  4, 4,   0, 22, 0xfbbf24, 0.85)
    const tailR = this.add.triangle( 8, 8,   6, 4, 12, 4,  10, 18, 0xf97316, 0.85)

    this.companion.add([
      bodyGlow,
      this.companionWingL, this.companionWingR, wTipL, wTipR,
      body, bodyHL,
      head, headHL,
      crest1, crest2,
      beak,
      eyeGlowL, eyeGlowR,
      eyeL, eyeR, pupilL, pupilR, glintL, glintR,
      tailL, tailM, tailR,
    ])

    // Wing flap animation
    this.tweens.add({ targets: this.companionWingL, angle: -18, scaleX: 0.7, duration: 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: this.companionWingR, angle:  18, scaleX: 0.7, duration: 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    // Body glow pulse
    this.tweens.add({ targets: bodyGlow, alpha: { from: 0.22, to: 0.52 }, scaleX: 1.4, scaleY: 1.4, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    // Speech bubble — separate so it doesn't flip with the phoenix
    this.companionSpeechBubble = this.add.container(0, 0).setDepth(11).setAlpha(0)

    const bubbleBg = this.add.graphics()
    bubbleBg.fillStyle(0x120e08, 0.95)
    bubbleBg.fillRoundedRect(0, -28, 120, 28, 8)
    bubbleBg.lineStyle(2, 0xf97316, 0.9)
    bubbleBg.strokeRoundedRect(0, -28, 120, 28, 8)
    bubbleBg.fillStyle(0x120e08, 0.95)
    bubbleBg.fillTriangle(8, 0, 0, 10, 20, 0)

    this.companionSpeechText = this.add.text(60, -14, '', {
      fontSize: '11px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold', color: '#fed7aa',
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
    this.spawnCompanionBurst(0xf97316)
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
      if (!this.isBlocked && this.companionSpeechBubble.alpha < 0.1) {
        this.companionSay(this.pick(COMPANION_MESSAGES.idle), 2500)
      }
      this.time.delayedCall(8000 + Math.random() * 6000, chatLoop)
    }
    this.time.delayedCall(8000, chatLoop)
  }

  // ═══════════════════════════════════════════════════════════
  // OBSTACLES — Forge guardians
  // ═══════════════════════════════════════════════════════════

  private createObstacles() {
    OBSTACLES.forEach(cfg => {
      const container = this.add.container(cfg.x, this.groundY - cfg.height / 2).setDepth(5)
      const icon      = this.add.text(0, 0, cfg.emoji, { fontSize: '96px' }).setOrigin(0.5)

      // Ember warning ring
      const warnRing = this.add.circle(0, 0, 70, 0xf97316, 0).setStrokeStyle(3, 0xf97316, 0)

      this.tweens.add({ targets: icon, y: -14, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      container.add([warnRing, icon])
      ;(container as any)._warnRing = warnRing
      this.obstacleObjects.set(cfg.id, { container, config: cfg, solved: false })
    })
  }

  // ═══════════════════════════════════════════════════════════
  // BOSS — The Iron Titan (Forge Golem)
  // ═══════════════════════════════════════════════════════════

  private createBoss() {
    this.bossContainer = this.add.container(BOSS_X, this.groundY - 100).setDepth(8)

    // Outer forge-heat aura
    const aura  = this.add.ellipse(0, 0, 230, 260, 0xf97316, 0.18)
    const aura2 = this.add.ellipse(0, 0, 170, 200, 0xef4444, 0.28)

    // Massive iron body
    const body     = this.add.ellipse(0, 10, 165, 200, 0x1c1614)
    const bodyHL   = this.add.ellipse(-35, -25, 55, 95, 0x292524, 0.5)
    const bodyShine= this.add.ellipse(20, 30, 30, 60, 0x44403c, 0.25)

    // Iron plate armour overlays
    const plateL  = this.add.rectangle(-35, 0, 28, 80, 0x1f1c1a)
    const plateR  = this.add.rectangle( 35, 0, 28, 80, 0x1f1c1a)
    const plateMid= this.add.rectangle( 0, 15, 40, 60, 0x292524)

    // Shoulder iron spikes
    for (let s = 0; s < 6; s++) {
      const sx  = (s < 3 ? -1 : 1) * (65 + (s % 3) * 14)
      const sy  = -25 + (s % 3) * 18
      const sh  = 30 + Math.random() * 20
      const sw  = 10 + Math.random() * 6
      const col = s % 2 === 0 ? 0x44403c : 0x57534e
      this.bossContainer.add(this.add.triangle(sx, sy, -sw/2, sh/2, sw/2, sh/2, 0, -sh/2, col, 0.95))
    }

    // Glowing molten eyes
    this.bossEyeL  = this.add.circle(-34, -28, 20, 0xf97316)
    this.bossEyeR  = this.add.circle( 34, -28, 20, 0xf97316)
    this.bossPupilL = this.add.circle(-34, -28, 9, 0xef4444)
    this.bossPupilR = this.add.circle( 34, -28, 9, 0xef4444)

    // Eye glow rings
    const eyeGL = this.add.circle(-34, -28, 28, 0xf97316, 0.3)
    const eyeGR = this.add.circle( 34, -28, 28, 0xf97316, 0.3)
    this.tweens.add({ targets: [eyeGL, eyeGR], alpha: { from: 0.3, to: 0.72 }, scaleX: 1.3, scaleY: 1.3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    // Iron spike crown
    for (let c = 0; c < 5; c++) {
      const cx2 = (c - 2) * 30
      const ch  = 28 + (c === 2 ? 18 : 0)
      const cw  = 10
      const col = c % 2 === 0 ? 0x57534e : 0x44403c
      this.bossContainer.add(this.add.triangle(cx2, -105, -cw/2, 0, cw/2, 0, 0, -ch, col, 0.95))
    }

    // HP bars — iron plates
    for (let h = 0; h < 3; h++) {
      const bg   = this.add.rectangle(-30 + h * 30, -150, 24, 14, 0x1c1614).setStrokeStyle(1, 0x44403c)
      const fill = this.add.rectangle(-30 + h * 30, -150, 22, 12, 0xf97316)
      this.bossHP.push(fill)
      this.bossContainer.add([bg, fill])
    }

    // Forge glow on chest — molten core
    const chestGlow = this.add.ellipse(0, 20, 60, 60, 0xf97316, 0.18)
    this.tweens.add({ targets: chestGlow, alpha: { from: 0.18, to: 0.48 }, scaleX: 1.2, scaleY: 1.2, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    const nameTxt  = this.add.text(0, -175, 'IRON TITAN', {
      fontSize: '13px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold', color: '#fed7aa', stroke: '#0a0806', strokeThickness: 3,
    }).setOrigin(0.5)
    const badgeBg  = this.add.rectangle(0, -192, 70, 20, 0xf97316)
    const badgeTxt = this.add.text(0, -192, '⚠ BOSS', {
      fontSize: '11px', fontStyle: 'bold', fontFamily: 'Nunito, sans-serif', color: '#ffffff',
    }).setOrigin(0.5)

    this.bossContainer.add([aura, aura2, body, bodyHL, bodyShine, plateL, plateR, plateMid, chestGlow, this.bossEyeL, this.bossEyeR, eyeGL, eyeGR, this.bossPupilL, this.bossPupilR, nameTxt, badgeBg, badgeTxt])

    this.tweens.add({ targets: this.bossContainer, y: this.groundY - 115, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: aura,  alpha: { from: 0.18, to: 0.48 }, scaleX: 1.1, scaleY: 1.1, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: aura2, alpha: { from: 0.28, to: 0.58 }, scaleX: 1.06, scaleY: 1.06, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    ;[this.bossEyeL, this.bossEyeR].forEach(e => this.tweens.add({ targets: e, alpha: { from: 1, to: 0.4 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }))
  }

  // Ambient forge fires / gears on the world
  private createAmbientForge() {
    ['🔥', '⚙️', '🔥', '⚙️', '🔥', '⚙️'].forEach((emoji, i) => {
      const fx = 200 + i * 650 + Math.random() * 200
      const fy = this.groundY - 20
      const f  = this.add.text(fx, fy, emoji, { fontSize: `${14 + Math.random() * 10}px` })
        .setDepth(2).setOrigin(0.5).setAlpha(0.3)
      this.tweens.add({ targets: f, alpha: 0.7, scaleX: 1.2, scaleY: 1.2, duration: 900 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
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
    this.updateAmbientSparks(delta)

    if (!wasOnGround && this.playerOnGround) this.audio.playSfx('land', 0.55)

    if (!this.isBlocked) {
      this.checkObstacleCollisions()
      this.checkBossProximity()
      this.checkEmberCollection()
    }
    this.updateObstacleWarnings()
  }

  private updatePlayer(delta: number) {
    if (this.isBlocked) return

    const dt      = delta / 16.67
    const goLeft  = this.cursors.left.isDown  || this.keyA.isDown || this.touchLeft
    const goRight = this.cursors.right.isDown || this.keyD.isDown || this.touchRight
    const jump    = Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
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

    this.companionTargetX = this.playerX + (this.facingRight ? -60 : 60)
    const dx = this.companionTargetX - this.companionX
    this.companionX += dx * 0.07 * dt

    // Figure-8 flight path above the player
    const figureEightY = Math.sin(this.companionTime * 0.004) * 18
    const figureEightX = Math.sin(this.companionTime * 0.002) * 12
    const flyHeight = this.playerY - 75 + figureEightY

    this.companion.setPosition(this.companionX + figureEightX, flyHeight)
    this.companion.setScale(dx < 0 ? 1 : -1, 1)

    const bubbleX = this.companionX + figureEightX + (dx < 0 ? 35 : -155)
    const bubbleY = flyHeight - 45
    this.companionSpeechBubble.setPosition(bubbleX, bubbleY)
    this.companionSpeechBubble.setScale(1, 1)
  }

  private updateBossEyes() {
    if (this.bossPhase === 0 || this.bossPhase >= 4) return
    const dx        = (this.playerX - BOSS_X) / 400
    const clampedDx = Math.max(-7, Math.min(7, dx * 7))
    this.bossPupilL.setPosition(-34 + clampedDx, -28)
    this.bossPupilR.setPosition( 34 + clampedDx, -28)
  }

  private updateBossProjectiles(delta: number) {
    if (this.bossBlocked && this.activeBossPhase > 0) {
      this.bossAttackTimer += delta
      if (this.bossAttackTimer >= this.bossAttackInterval) {
        this.bossAttackTimer = 0
        this.fireMoltenRocks()
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

  private fireMoltenRocks() {
    // Boss roar — shake and eye flash
    this.tweens.add({ targets: this.bossContainer, x: BOSS_X + 12, duration: 70, yoyo: true, repeat: 4, ease: 'Linear' })
    ;[this.bossEyeL, this.bossEyeR].forEach(e => {
      e.setFillStyle(0xffffff)
      this.time.delayedCall(220, () => e.setFillStyle(0xf97316))
    })

    // Fire 2-4 molten rock balls toward the player
    const count = 2 + this.activeBossPhase
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * 220, () => {
        const rock   = this.add.circle(BOSS_X - 55, this.groundY - 150, 10 + Math.random() * 8, 0xf97316).setDepth(7)
        const velX   = -(3.5 + Math.random() * 1.5)
        const velY   = -(5 + Math.random() * 3)
        const spread = (i - count / 2) * 0.2
        this.bossProjectiles.push({ obj: rock, velX, velY: velY + spread * 3, bounces: 0 })
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

  // Rising ember sparks — ambient atmosphere (replacing cave drips)
  private updateAmbientSparks(delta: number) {
    this.sparkTimer += delta
    if (this.sparkTimer > 400 + Math.random() * 600) {
      this.sparkTimer = 0
      const cam   = this.cameras.main
      const spark = this.add.circle(
        cam.scrollX + 50 + Math.random() * (this.screenW - 100),
        this.groundY - 10 - Math.random() * 40,
        1.5 + Math.random() * 2.5,
        Math.random() > 0.5 ? 0xf97316 : 0xfbbf24,
        0.8
      ).setDepth(2.5)
      this.activeSparks.push({ obj: spark, velY: -(1 + Math.random() * 2.5), velX: (Math.random() - 0.5) * 0.8 })
    }

    for (let i = this.activeSparks.length - 1; i >= 0; i--) {
      const s = this.activeSparks[i]
      s.obj.y += s.velY
      s.obj.x += s.velX
      s.obj.alpha -= 0.008
      if (s.obj.alpha <= 0 || s.obj.y < this.screenH * 0.1) {
        s.obj.destroy()
        this.activeSparks.splice(i, 1)
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
        warnRing.setStrokeStyle(3, 0xf97316, (1 - dist / 220) * 0.9)
      } else {
        warnRing.setStrokeStyle(3, 0xf97316, 0)
      }
    })
  }

  // ── Ember collection ─────────────────────────────────────
  private checkEmberCollection() {
    this.emberObjects.forEach(c => {
      if (c.collected) return
      const dx = Math.abs(this.playerX - c.x)
      const dy = Math.abs(this.playerY - c.y)
      if (dx < 38 && dy < 44) this.collectEmber(c)
    })
  }

  private collectEmber(c: typeof this.emberObjects[0]) {
    c.collected = true
    this.embersCollected++
    this.emberCountText.setText(`${this.embersCollected} / ${EMBER_POSITIONS.length}`)

    if (c.glowRing) {
      this.tweens.add({ targets: c.glowRing, scaleX: 4, scaleY: 4, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => c.glowRing!.destroy() })
    }

    const cam = this.cameras.main
    const sx  = c.x - cam.scrollX
    const sy  = c.y - cam.scrollY
    const fly = this.add.text(sx, sy, '🔥', { fontSize: '22px' }).setOrigin(0.5).setScrollFactor(0).setDepth(80)
    this.tweens.add({
      targets: fly, x: this.screenW - 100, y: 18, scaleX: 0.3, scaleY: 0.3, alpha: 0,
      duration: 550, ease: 'Quad.easeIn', onComplete: () => fly.destroy(),
    })

    this.tweens.add({ targets: this.emberHUD, scaleX: 1.3, scaleY: 1.3, duration: 100, yoyo: true, ease: 'Back.easeOut' })
    this.audio.playSfx('collect')
    c.obj.destroy()
    this.companionSay(this.pick(COMPANION_MESSAGES.emberCollect), 1400)
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
    dispatchToReact(ZONE3_EVENTS.SHOW_PROBLEM, { type: 'obstacle', obstacleId: id, problemId: cfg.problemId, label: cfg.label })
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

    const problemIds = ['Z3-BOSS-01', 'Z3-BOSS-02', 'Z3-BOSS-03']
    dispatchToReact(ZONE3_EVENTS.SHOW_PROBLEM, {
      type: 'boss', obstacleId: `boss-phase-${nextPhase}`,
      problemId: problemIds[nextPhase - 1], bossPhase: nextPhase,
      label: `Iron Titan — Phase ${nextPhase}`,
    })
    dispatchToReact(ZONE3_EVENTS.BOSS_PHASE, { phase: nextPhase })
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

    // Screen flash — ember orange
    const flash = this.add.rectangle(this.screenW / 2, this.screenH / 2, this.screenW, this.screenH, 0xf97316, 0.35)
      .setScrollFactor(0).setDepth(50)
    this.tweens.add({ targets: flash, alpha: 0, duration: 350, ease: 'Quad.easeOut', onComplete: () => flash.destroy() })

    // Emoji rockets upward
    const ghost = this.add.text(cx, cy, obs.config.emoji, { fontSize: '96px' }).setOrigin(0.5).setDepth(30)
    this.tweens.add({ targets: ghost, y: cy - 220, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => ghost.destroy() })

    // Ember shockwave rings
    for (let r = 0; r < 3; r++) {
      const ringColor = [0xf97316, 0xfbbf24, 0xef4444][r]
      const ring = this.add.circle(cx, cy, 10, ringColor, 0).setStrokeStyle(4 - r, ringColor).setDepth(25)
      this.tweens.add({ targets: ring, scaleX: 6 + r * 2, scaleY: 6 + r * 2, alpha: 0, duration: 500 + r * 120, delay: r * 80, ease: 'Quad.easeOut', onComplete: () => ring.destroy() })
    }

    // Particle burst
    const cam      = this.cameras.main
    const screenCX = cx - cam.scrollX
    const screenCY = cy - cam.scrollY

    const burstColors = [0xf97316, 0xfbbf24, 0xef4444, 0xfed7aa, 0xfde68a, 0xffffff, 0xf59e0b, 0xdc2626]
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

    // FORGED! text
    const solvedTxt = this.add.text(cx, cy - 40, '✅ FORGED!', {
      fontSize: '28px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#ffffff', stroke: '#f97316', strokeThickness: 5,
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
    dispatchToReact(ZONE3_EVENTS.PROGRESS, { solved: this.solvedCount, total: 8 })
    this.obsCooldown = true
    this.time.delayedCall(700, () => { this.obsCooldown = false })
  }

  private onBossPhaseCleared() {
    const hpIdx = this.bossPhase - 1
    if (this.bossHP[hpIdx]) {
      this.tweens.add({
        targets: this.bossHP[hpIdx], scaleX: 0, duration: 400, ease: 'Back.easeIn',
        onComplete: () => { if (this.bossHP[hpIdx]) this.bossHP[hpIdx].setFillStyle(0x1c1614) },
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

    // Screen flash — forge orange
    const flash = this.add.rectangle(cx, cy, this.screenW, this.screenH, 0xf97316, 0.75)
      .setScrollFactor(0).setDepth(70)
    this.tweens.add({ targets: flash, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => flash.destroy() })

    const overlay = this.add.rectangle(cx, cy, this.screenW, this.screenH, 0x000000, 0.55)
      .setScrollFactor(0).setDepth(68)

    const trophy = this.add.text(cx, cy - 150, '🏆', { fontSize: '90px' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(75).setAlpha(0).setScale(0.1)
    this.tweens.add({
      targets: trophy, alpha: 1, scaleX: 1.2, scaleY: 1.2, duration: 600, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: trophy, scaleX: 1, scaleY: 1, duration: 250, ease: 'Sine.easeOut' })
        this.tweens.add({ targets: trophy, y: cy - 165, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      },
    })

    const headline = this.add.text(cx, cy - 50, 'BOSS DEFEATED!', {
      fontSize: '58px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#fed7aa', stroke: '#7c2d12', strokeThickness: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(75).setAlpha(0).setScale(0.3)
    this.tweens.add({
      targets: headline, alpha: 1, scaleX: 1, scaleY: 1, duration: 500, delay: 150, ease: 'Back.easeOut',
      onComplete: () => { this.tweens.add({ targets: headline, scaleX: 1.06, scaleY: 1.06, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) },
    })

    const sub = this.add.text(cx, cy + 20, 'Iron Titan Vanquished! 🔥', {
      fontSize: '26px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#fde8d0', stroke: '#7c2d12', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(75).setAlpha(0)
    this.tweens.add({ targets: sub, alpha: 1, y: cy + 12, duration: 400, delay: 350, ease: 'Quad.easeOut' })

    // Ember burst from center
    this.time.delayedCall(200, () => {
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2
        const ember = this.add.text(cx, cy, '🔥', { fontSize: '20px' })
          .setOrigin(0.5).setScrollFactor(0).setDepth(73)
        this.tweens.add({
          targets: ember,
          x: cx + Math.cos(angle) * 220, y: cy + Math.sin(angle) * 170,
          alpha: 0, scaleX: 0, scaleY: 0, duration: 900, ease: 'Quad.easeOut',
          onComplete: () => ember.destroy(),
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

    // Ember/gear confetti rain
    for (let i = 0; i < 60; i++) {
      this.time.delayedCall(Math.random() * 2200, () => {
        if (!this.scene.isActive()) return
        const forgeColors = [0xf97316, 0xef4444, 0xfbbf24, 0xfed7aa, 0xfb923c, 0xffffff, 0xf59e0b, 0xdc2626]
        const c = this.add.rectangle(
          Math.random() * this.screenW, -12,
          5 + Math.random() * 7, 10 + Math.random() * 10,
          forgeColors[Math.floor(Math.random() * forgeColors.length)]
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
          dispatchToReact(ZONE3_EVENTS.ZONE_COMPLETE, {})
        },
      })
    })
  }

  // ═══════════════════════════════════════════════════════════
  // FX HELPERS
  // ═══════════════════════════════════════════════════════════

  private spawnFirework(x: number, y: number) {
    const colors = [0xf97316, 0xfbbf24, 0xef4444, 0xfed7aa, 0xfb923c, 0xffffff, 0xf59e0b, 0xdc2626]
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
    const colors = [0xf97316, 0xfbbf24, 0xef4444, 0xfed7aa, 0xfb923c]
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
