// ─────────────────────────────────────────────────────────────
//  MathQuest · src/lib/phaser/Zone1Scene.ts  — Zone 1 "Pebble Shore"
//
//  FREEZE FIX (this version):
//  The previous `answerSent` flag in the Scene was meant to prevent
//  double-processing, but it created a timing hole:
//
//    1. Phase 1 correct answer arrives → answerSent = true
//    2. onBossPhaseCleared → interPhaseCooldown 1200ms timer starts
//       (which was supposed to reset answerSent after 1200ms)
//    3. triggerBoss() for phase 2 sets answerSent = false ✓
//    4. Player solves phase 2 → ANSWER_RESULT arrives
//    5. handleAnswerResult checks `if (answerSent) return` ← FREEZE
//       because triggerBoss set it false but some other code path
//       set it back true before step 4 arrived.
//
//  Root cause: answerSent was being managed in too many places
//  (triggerBoss, onObstacleCleared timer, interPhaseCooldown timer)
//  creating unpredictable state. The React side already has its own
//  dedup (answerDispatchedRef), so Scene-level dedup is unnecessary.
//
//  Fix: remove answerSent entirely from the Scene. One clear rule:
//  the Scene only processes ANSWER_RESULT when it's actually blocked.
//  If it's not blocked, the event is a harmless no-op.
// ─────────────────────────────────────────────────────────────

import Phaser from 'phaser'

export const ZONE1_EVENTS = {
  SHOW_PROBLEM:  'zone1:showProblem',
  ANSWER_RESULT: 'zone1:answerResult',
  ZONE_COMPLETE: 'zone1:zoneComplete',
  BOSS_PHASE:    'zone1:bossPhase',
  PROGRESS:      'zone1:progress',
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
  { id: 'obj1', problemId: 'Z1-OBJ-01', x: 600,  label: 'Chest',      emoji: '🪙', color: 0xd4a017, width: 64,  height: 56  },
  { id: 'obj2', problemId: 'Z1-OBJ-02', x: 1000, label: 'Turtle',     emoji: '🐢', color: 0x3d9e3d, width: 56,  height: 48  },
  { id: 'obj3', problemId: 'Z1-OBJ-03', x: 1420, label: 'Bridge',     emoji: '🌉', color: 0x8b5e3c, width: 100, height: 60  },
  { id: 'obj4', problemId: 'Z1-OBJ-04', x: 1850, label: 'Rock',       emoji: '🪨', color: 0x7a7a7a, width: 70,  height: 64  },
  { id: 'obj5', problemId: 'Z1-OBJ-05', x: 2280, label: 'Crabs',      emoji: '🦀', color: 0xe85c2a, width: 80,  height: 50  },
  { id: 'obj6', problemId: 'Z1-OBJ-06', x: 2720, label: 'Stones',     emoji: '🪸', color: 0x3b82f6, width: 90,  height: 40  },
  { id: 'obj7', problemId: 'Z1-OBJ-07', x: 3160, label: 'Pelican',    emoji: '🐦', color: 0xdeb887, width: 60,  height: 70  },
  { id: 'obj8', problemId: 'Z1-OBJ-08', x: 3600, label: 'Lighthouse', emoji: '🔦', color: 0xcccccc, width: 50,  height: 120 },
]

const BOSS_X         = 4200
const WORLD_WIDTH    = 4800
const GROUND_Y_RATIO = 0.78

export class Zone1Scene extends Phaser.Scene {
  // ── Dimensions ─────────────────────────────────────────────
  private worldWidth!: number
  private groundY!: number
  private screenW!: number
  private screenH!: number

  // ── Player ─────────────────────────────────────────────────
  private player!: Phaser.GameObjects.Container
  private playerVelX     = 0
  private playerVelY     = 0
  private playerOnGround = true
  private playerX        = 120
  private playerY        = 0
  private facingRight    = true

  // ── Blocking flags ─────────────────────────────────────────
  // Simple, clean: one flag per blocker type, no dedup logic here
  private obstacleBlocked = false   // true while an obstacle problem is open
  private bossBlocked     = false   // true while a boss problem is open
  private get isBlocked() { return this.obstacleBlocked || this.bossBlocked }

  // ── Cooldown flags ─────────────────────────────────────────
  private obsCooldown        = false  // brief cooldown after clearing/closing obstacle
  private interPhaseCooldown = false  // pause between boss phases for animation

  // ── Input ──────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keyA!: Phaser.Input.Keyboard.Key
  private keyD!: Phaser.Input.Keyboard.Key
  private keyW!: Phaser.Input.Keyboard.Key
  private keySpace!: Phaser.Input.Keyboard.Key

  // ── Touch (written by React on-screen buttons) ─────────────
  public touchLeft  = false
  public touchRight = false
  public touchJump  = false

  // ── Obstacle state ─────────────────────────────────────────
  private obstacleObjects: Map<string, {
    container: Phaser.GameObjects.Container
    config: ObstacleConfig
    solved: boolean
  }> = new Map()
  private solvedCount  = 0
  private activeObsId: string | null = null

  // ── Boss state ─────────────────────────────────────────────
  private bossContainer!: Phaser.GameObjects.Container
  private bossPhase       = 0  // 0=none, 1/2/3=phase in progress, 4=defeated
  private activeBossPhase = 0  // which phase problem is currently open (0=none)
  private bossHP: Phaser.GameObjects.Rectangle[] = []

  // ── Environment ────────────────────────────────────────────
  private waves: Phaser.GameObjects.Rectangle[] = []
  private waveTimer = 0

  // ── Cleanup ────────────────────────────────────────────────
  private answerListener!: (e: Event) => void

  constructor() { super({ key: 'Zone1Scene' }) }
  preload() {}

  create() {
    this.screenW    = this.scale.width
    this.screenH    = this.scale.height
    this.worldWidth = WORLD_WIDTH
    this.groundY    = this.screenH * GROUND_Y_RATIO
    this.playerY    = this.groundY - 40

    ;(window as any).__zone1Scene = this

    this.createSky()
    this.createSun()
    this.createClouds()
    this.createSea()
    this.createGround()
    this.createObstacles()
    this.createBoss()
    this.createBirds()
    this.createPlayer()

    this.cursors  = this.input.keyboard!.createCursorKeys()
    this.keyA     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.keyD     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    this.keyW     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W)
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    this.answerListener = (e: Event) => {
      const { correct, obstacleId } = (e as CustomEvent).detail
      this.handleAnswerResult(correct, obstacleId)
    }
    window.addEventListener(ZONE1_EVENTS.ANSWER_RESULT, this.answerListener)

    this.cameras.main.setBounds(0, 0, this.worldWidth, this.screenH)
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08)

    this.time.delayedCall(200, () =>
      dispatchToReact(ZONE1_EVENTS.PROGRESS, { solved: 0, total: 8 })
    )
  }

  shutdown() {
    window.removeEventListener(ZONE1_EVENTS.ANSWER_RESULT, this.answerListener)
    ;(window as any).__zone1Scene = null
  }

  // ── Environment ───────────────────────────────────────────

//   private createSky() {
//     const colors = [0x1a6ec7, 0x3a8fd6, 0x5aafe6, 0x7ecaf5, 0xaaddf8]
//     const h = this.groundY / colors.length
//     colors.forEach((c, i) =>
//       this.add.rectangle(this.screenW / 2, i * h + h / 2, this.screenW, h + 2, c)
//         .setScrollFactor(0).setDepth(0)
//     )
//   }


private createSky() {
  // Full-screen sky (NOT limited to groundY)
  const rt = this.make.renderTexture({
    width: this.screenW,
    height: this.screenH,
  }, true)

  const gfx = this.make.graphics({ x: 0, y: 0 })

  const steps = 60

  const topColor = new Phaser.Display.Color(11, 61, 145)     // deep blue
  const bottomColor = new Phaser.Display.Color(207, 239, 255) // light sky

  for (let i = 0; i < steps; i++) {
    const t = i / steps

    const color = Phaser.Display.Color.Interpolate.ColorWithColor(
      topColor,
      bottomColor,
      steps,
      i
    )

    gfx.fillStyle(
      Phaser.Display.Color.GetColor(color.r, color.g, color.b),
      1
    )

    gfx.fillRect(
      0,
      t * this.screenH,
      this.screenW,
      this.screenH / steps + 2
    )
  }

  rt.draw(gfx)
  gfx.destroy()

  rt.setPosition(0, 0)
  rt.setOrigin(0, 0)
  rt.setScrollFactor(0)
  rt.setDepth(0)
}

  private createSun() {
    const sx = this.screenW - 140
    const glow = this.add.circle(sx, 90, 58, 0xfff5a0, 0.3).setScrollFactor(0).setDepth(1)
    const sun  = this.add.circle(sx, 90, 40, 0xffe44a).setScrollFactor(0).setDepth(1)
    this.tweens.add({ targets: [glow, sun], scaleX: 1.06, scaleY: 1.06, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const ray = this.add.rectangle(sx + Math.cos(a) * 56, 90 + Math.sin(a) * 56, 22, 4, 0xffe44a, 0.5)
        .setScrollFactor(0).setDepth(1).setRotation(a)
      this.tweens.add({ targets: ray, alpha: { from: 0.5, to: 0.15 }, duration: 1800 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
  }

  private createClouds() {
    const pos = [
      { x: 120, y: 60, sx: 0.05 }, { x: 380, y: 40, sx: 0.07 },
      { x: 640, y: 80, sx: 0.04 }, { x: 900, y: 55, sx: 0.06 },
    ]
    pos.forEach(({ x, y, sx }) => {
      const c = this.add.container(x, y).setScrollFactor(sx).setDepth(1)
      const puffs: [number, number, number][] = [[0,0,38],[-30,8,28],[30,8,28],[-60,14,20],[60,14,20]]
      puffs.forEach(([cx, cy, r]) => c.add(this.add.circle(cx, cy, r, 0xffffff, 0.9)))
      this.tweens.add({ targets: c, y: y - 6, duration: 3000 + Math.random() * 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    })
  }

//   private createSea() {
//     const seaH = this.screenH - this.groundY
//     this.add.rectangle(this.screenW / 2, this.groundY + seaH / 2, this.screenW, seaH, 0x1a7bbf)
//       .setScrollFactor(0).setDepth(2)
//     const wc = [0x2196f3, 0x42a5f5, 0x64b5f6, 0x90caf9]
//     for (let w = 0; w < 4; w++) {
//       this.waves.push(
//         this.add.rectangle(this.screenW / 2, this.groundY + 8 + w * 14, this.screenW + 60, 10, wc[w], 0.7)
//           .setScrollFactor(0).setDepth(3)
//       )
//     }
//     for (let f = 0; f < 6; f++) {
//       const foam = this.add.ellipse(60 + f * (this.screenW / 5), this.groundY + 4, 40, 10, 0xffffff, 0.5)
//         .setScrollFactor(0).setDepth(3)
//       this.tweens.add({ targets: foam, scaleX: { from: 0.8, to: 1.3 }, alpha: { from: 0.5, to: 0.2 }, duration: 1200 + f * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
//     }
//   }
private createSea() {
  const seaHeight = 90;

  // 👇 IMPORTANT: sea sits BELOW where ground starts
  // const seaY = this.groundY + seaHeight / 2;
  // const seaY = this.groundY + seaHeight / 2 + 10; 
  const seaY = this.groundY + seaHeight / 2 - 40;

  this.add.rectangle(
    this.screenW / 2,
    seaY,
    this.screenW,
    seaHeight,
    0x1a7bbf
  )
    .setScrollFactor(0)
    .setDepth(1); // 👈 ALWAYS behind beach

  const waveColors = [0x42a5f5, 0x64b5f6, 0x90caf9];

  for (let i = 0; i < 3; i++) {
    const wave = this.add.rectangle(
      this.screenW / 2,
      // this.groundY + i * 4, // 👈 shoreline line
      this.groundY + 5 + i * 6,
      this.screenW + 120,
      10,
      waveColors[i],
      0.7
    )
      .setScrollFactor(0)
      .setDepth(2); // 👈 above sea, below ground

    this.waves.push(wave);

    this.tweens.add({
      targets: wave,
      x: this.screenW / 2 + 25,
      duration: 1200 + i * 200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
}

//   private createGround() {
//     const groundH = this.screenH - this.groundY
//     this.add.rectangle(this.worldWidth / 2, this.groundY + groundH / 2, this.worldWidth, groundH, 0xf5d78e).setDepth(2)
//     this.add.rectangle(this.worldWidth / 2, this.groundY + 8, this.worldWidth, 16, 0xe6c46a).setDepth(2)
//     const pc = [0xccbbaa, 0xaaa090, 0xdd8844, 0xcc99aa]
//     for (let i = 0; i < 80; i++) {
//       const px = 100 + Math.random() * (this.worldWidth - 200)
//       const py = this.groundY + 16 + Math.random() * 40
//       const s  = 3 + Math.random() * 8
//       this.add.ellipse(px, py, s * 1.4, s, pc[Math.floor(Math.random() * pc.length)], 0.8).setDepth(2)
//     }
//     for (let i = 0; i < 8; i++) {
//       const star = this.add.text(300 + i * 500, this.groundY + 22, '⭐', { fontSize: '18px' }).setDepth(2).setOrigin(0.5)
//       this.tweens.add({ targets: star, angle: 20, duration: 2000 + Math.random() * 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
//     }
//     for (let i = 0; i < 12; i++) {
//       this.add.text(200 + Math.random() * (this.worldWidth - 400), this.groundY + 18, '🐚', { fontSize: '14px' }).setDepth(2).setOrigin(0.5)
//     }
//   }
private createGround() {
  const seaHeight = 90
  // const groundStartY = this.groundY + seaHeight
  const groundStartY = this.groundY
  const groundH = this.screenH - groundStartY

  // ─────────────────────────────
  // Sand base
  // ─────────────────────────────
  this.add.rectangle(
    this.worldWidth / 2,
    groundStartY + groundH / 2,
    this.worldWidth,
    groundH,
    0xf5d78e
  ).setDepth(2)

  // Shore strip
  this.add.rectangle(
    this.worldWidth / 2,
    groundStartY + 8,
    this.worldWidth,
    16,
    0xe6c46a
  ).setDepth(2)

  // ─────────────────────────────
  // Pebbles (more + natural spread)
  // ─────────────────────────────
  const pebblesCount = 180
  const pc = [0xccbbaa, 0xaaa090, 0xdd8844, 0xcc99aa]

  for (let i = 0; i < pebblesCount; i++) {
    const px = Math.random() * this.worldWidth
    const py = groundStartY + 10 + Math.random() * 70
    const s = 2 + Math.random() * 9

    this.add.ellipse(
      px,
      py,
      s * 1.4,
      s,
      pc[Math.floor(Math.random() * pc.length)],
      0.8
    ).setDepth(2)
  }

  // ─────────────────────────────
  // Stars (more + shoreline bias)
  // ─────────────────────────────
  const starsCount = 28

  for (let i = 0; i < starsCount; i++) {
    const star = this.add.text(
      200 + Math.random() * (this.worldWidth - 400),
      groundStartY + 8 + Math.random() * 35,
      "⭐",
      {
        fontSize: `${14 + Math.random() * 8}px`
      }
    ).setDepth(2).setOrigin(0.5)

    this.tweens.add({
      targets: star,
      angle: 15,
      duration: 1800 + Math.random() * 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    })
  }

  // ─────────────────────────────
  // Shells (more scattered)
  // ─────────────────────────────
  const shellsCount = 35

  for (let i = 0; i < shellsCount; i++) {
    this.add.text(
      Math.random() * this.worldWidth,
      groundStartY + 15 + Math.random() * 60,
      "🐚",
      { fontSize: `${12 + Math.random() * 6}px` }
    )
      .setDepth(2)
      .setOrigin(0.5)
  }
}

  private createPlayer() {
    this.player = this.add.container(this.playerX, this.playerY).setDepth(10)
    const shadow = this.add.ellipse(0, 24, 40, 10, 0x000000, 0.18)
    const body   = this.add.rectangle(0, 0, 36, 48, 0xff7043)
    const pack   = this.add.rectangle(14, -4, 14, 24, 0xef9a9a)
    const head   = this.add.circle(0, -32, 18, 0xffccaa)
    const eyeL   = this.add.circle(-6, -35, 3, 0x333333)
    const eyeR   = this.add.circle(6, -35, 3, 0x333333)
    const smile  = this.add.arc(0, -28, 8, 0, 180, false, 0x333333)
    const hat    = this.add.rectangle(0, -50, 28, 8, 0x1565c0)
    const brim   = this.add.rectangle(0, -44, 36, 6, 0x1e88e5)
    this.player.add([shadow, body, pack, head, eyeL, eyeR, smile, hat, brim])
    this.tweens.add({ targets: this.player, y: this.playerY - 5, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  private createObstacles() {
    OBSTACLES.forEach(cfg => {
      const container = this.add.container(cfg.x, this.groundY - cfg.height / 2).setDepth(5)
      const body  = this.add.rectangle(0, 0, cfg.width, cfg.height, cfg.color, 0.9).setStrokeStyle(3, 0x000000, 0.3)
      const icon  = this.add.text(0, -cfg.height / 2 - 20, cfg.emoji, { fontSize: '36px' }).setOrigin(0.5)
      const lbl   = this.add.text(0, cfg.height / 2 + 14, cfg.label, {
        fontSize: '13px', fontFamily: 'Nunito, sans-serif',
        color: '#ffffff', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
      }).setOrigin(0.5)
      const badge = this.add.circle(cfg.width / 2 + 8, -cfg.height / 2 - 8, 14, 0xff5722)
      const qmark = this.add.text(cfg.width / 2 + 8, -cfg.height / 2 - 8, '?', {
        fontSize: '16px', fontStyle: 'bold', color: '#ffffff',
      }).setOrigin(0.5)
      this.tweens.add({ targets: icon,  y: -cfg.height / 2 - 26, duration: 1000 + Math.random() * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.tweens.add({ targets: badge, scaleX: 1.2, scaleY: 1.2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      container.add([body, icon, lbl, badge, qmark])
      this.obstacleObjects.set(cfg.id, { container, config: cfg, solved: false })
    })
  }

  private createBoss() {
    this.bossContainer = this.add.container(BOSS_X, this.groundY - 90).setDepth(8)
    const glow   = this.add.ellipse(0, 0, 130, 150, 0x3f51b5, 0.3)
    const body   = this.add.ellipse(0, 0, 120, 140, 0x1a237e, 0.95)
    const inner  = this.add.ellipse(0, -10, 80, 90, 0x283593, 0.8)
    const eyeL   = this.add.circle(-22, -20, 12, 0x00e5ff)
    const eyeR   = this.add.circle(22, -20, 12, 0x00e5ff)
    const pupilL = this.add.circle(-22, -20, 5, 0x001f3f)
    const pupilR = this.add.circle(22, -20, 5, 0x001f3f)
    const crown  = this.add.text(0, -95, '👑', { fontSize: '28px' }).setOrigin(0.5)
    for (let t = 0; t < 5; t++) {
      const tent = this.add.rectangle((t - 2) * 22, 70, 10, 50, 0x1a237e, 0.8)
      this.bossContainer.add(tent)
      this.tweens.add({ targets: tent, y: 78, duration: 800 + t * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
    for (let h = 0; h < 3; h++) {
      const bg   = this.add.rectangle(-30 + h * 30, -130, 24, 14, 0x333333).setStrokeStyle(1, 0x666666)
      const fill = this.add.rectangle(-30 + h * 30, -130, 22, 12, 0xff1744)
      this.bossHP.push(fill)
      this.bossContainer.add([bg, fill])
    }
    const nameTxt  = this.add.text(0, -158, 'TIDAL SENTINEL', { fontSize: '13px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold', color: '#e0e0ff', stroke: '#000033', strokeThickness: 3 }).setOrigin(0.5)
    const badgeBg  = this.add.rectangle(0, -175, 70, 20, 0xff1744)
    const badgeTxt = this.add.text(0, -175, '⚠ BOSS', { fontSize: '11px', fontStyle: 'bold', fontFamily: 'Nunito, sans-serif', color: '#ffffff' }).setOrigin(0.5)
    this.bossContainer.add([glow, body, inner, eyeL, eyeR, pupilL, pupilR, crown, nameTxt, badgeBg, badgeTxt])
    this.tweens.add({ targets: this.bossContainer, y: this.groundY - 96, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: glow, alpha: { from: 0.3, to: 0.6 }, scaleX: 1.08, scaleY: 1.08, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    ;[eyeL, eyeR].forEach(eye => this.tweens.add({ targets: eye, alpha: { from: 1, to: 0.4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }))
  }

  private createBirds() {
    ['🐦', '🦅', '🦜', '🐦', '🕊️','🦉'].forEach((emoji, i) => {
      const bird = this.add.text(-80 - i * 200, 50 + i * 30, emoji, { fontSize: '22px' })
        .setScrollFactor(0.1).setDepth(1)
        bird.setScale(-1, 1)
      this.tweens.add({ targets: bird, x: this.screenW + 100, duration: 12000 + i * 3000, repeat: -1, ease: 'Linear', onRepeat: () => { bird.x = -80 } })
      this.tweens.add({ targets: bird, y: bird.y - 12, duration: 800 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    })
  }

  // ── Update ────────────────────────────────────────────────

  update(_time: number, delta: number) {
    this.waveTimer += delta
    this.waves.forEach((w, i) => {
      w.x = this.screenW / 2 + Math.sin(this.waveTimer * 0.001 + i * 1.2) * 20
    })
    this.updatePlayer(delta)
    if (!this.isBlocked) {
      this.checkObstacleCollisions()
      this.checkBossProximity()
    }
  }

  private updatePlayer(delta: number) {
    if (this.isBlocked) return

    const dt = delta / 16.67
    const goLeft  = this.cursors.left.isDown  || this.keyA.isDown || this.touchLeft
    const goRight = this.cursors.right.isDown || this.keyD.isDown || this.touchRight
    const jump    = Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
                    Phaser.Input.Keyboard.JustDown(this.keyW)       ||
                    Phaser.Input.Keyboard.JustDown(this.keySpace)   ||
                    this.touchJump
    this.touchJump = false

    if (goLeft)       { this.playerVelX = -4.5; this.facingRight = false }
    else if (goRight) { this.playerVelX =  4.5; this.facingRight = true  }
    else              { this.playerVelX *= 0.75 }

    if (jump && this.playerOnGround) { this.playerVelY = -14; this.playerOnGround = false }

    this.playerVelY += 0.55 * dt
    this.playerY    += this.playerVelY * dt

    const floorY = this.groundY - 24
    if (this.playerY >= floorY) { this.playerY = floorY; this.playerVelY = 0; this.playerOnGround = true }

    this.playerX = Math.max(40, this.playerX + this.playerVelX * dt)
    this.playerX = Math.min(this.getRightLimit(), this.playerX)
    this.player.setScale(this.facingRight ? 1 : -1, 1)
    this.player.setPosition(this.playerX, this.playerY)
  }

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
    if (this.solvedCount < 8)      return
    if (this.bossPhase >= 4)       return
    if (this.activeBossPhase > 0)  return
    if (this.interPhaseCooldown)   return
    if (Math.abs(this.playerX - BOSS_X) >= 110) return
    this.triggerBoss()
  }

  private triggerObstacle(id: string) {
    this.activeObsId     = id
    this.obstacleBlocked = true
    const cfg = OBSTACLES.find(o => o.id === id)!
    dispatchToReact(ZONE1_EVENTS.SHOW_PROBLEM, {
      type: 'obstacle', obstacleId: id,
      problemId: cfg.problemId, label: cfg.label,
    })
  }

  private triggerBoss() {
    const nextPhase = this.bossPhase + 1
    if (nextPhase > 3) return
    this.bossPhase       = nextPhase
    this.activeBossPhase = nextPhase
    this.bossBlocked     = true
    const problemIds = ['Z1-BOSS-01', 'Z1-BOSS-02', 'Z1-BOSS-03']
    dispatchToReact(ZONE1_EVENTS.SHOW_PROBLEM, {
      type: 'boss',
      obstacleId: `boss-phase-${nextPhase}`,
      problemId: problemIds[nextPhase - 1],
      bossPhase: nextPhase,
      label: `Tidal Sentinel — Phase ${nextPhase}`,
    })
    dispatchToReact(ZONE1_EVENTS.BOSS_PHASE, { phase: nextPhase })
    this.tweens.add({ targets: this.bossContainer, x: BOSS_X + 12, duration: 80, yoyo: true, repeat: 5, ease: 'Linear' })
  }

  // ── Answer result from React ──────────────────────────────
  // NO dedup here — the React side (answerDispatchedRef) guarantees
  // exactly one event per modal. We just act on it immediately.

  private handleAnswerResult(correct: boolean, obstacleId: string) {
    // Safety guard: only process if we're actually blocked
    // (prevents stray events from previous sessions)
    if (!this.obstacleBlocked && !this.bossBlocked) return

    if (correct) {
      if (obstacleId.startsWith('boss-phase')) {
        this.onBossPhaseCleared()
      } else {
        this.onObstacleCleared(obstacleId)
      }
    } else {
      this.onWrongAnswer()
    }
  }

  private onWrongAnswer() {
    this.flashPlayer()
    this.time.delayedCall(800, () => {
      this.obstacleBlocked = false
      this.bossBlocked     = false
      this.activeObsId     = null
      this.activeBossPhase = 0
      // Cooldown so player doesn't instantly re-trigger by walking
      this.obsCooldown = true
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

    this.tweens.add({
      targets: obs.container, alpha: 0, scaleY: 0,
      y: obs.container.y - 50, duration: 600, ease: 'Back.easeIn',
      onComplete: () => obs.container.destroy(),
    })
    this.spawnSparkles(obs.config.x, this.groundY - obs.config.height / 2)
    dispatchToReact(ZONE1_EVENTS.PROGRESS, { solved: this.solvedCount, total: 8 })

    this.obsCooldown = true
    this.time.delayedCall(700, () => { this.obsCooldown = false })
  }

  private onBossPhaseCleared() {
    // Drain HP pip for this phase (phase 1→pip 0, phase 2→pip 1, phase 3→pip 2)
    const hpIdx = this.bossPhase - 1
    if (this.bossHP[hpIdx]) {
      this.tweens.add({
        targets: this.bossHP[hpIdx], scaleX: 0, duration: 400, ease: 'Back.easeIn',
        onComplete: () => { if (this.bossHP[hpIdx]) this.bossHP[hpIdx].setFillStyle(0x444444) },
      })
    }
    this.tweens.add({
      targets: this.bossContainer, alpha: 0.2,
      duration: 100, yoyo: true, repeat: 4, ease: 'Linear',
    })

    if (this.bossPhase >= 3) {
      // ── All 3 phases solved ──────────────────────────────
      // Keep bossBlocked=true during defeat animation so
      // the player can't wander off mid-explosion
      this.time.delayedCall(900, () => this.defeatBoss())

    } else {
      // ── Phase 1 or 2 cleared — set up for next phase ────
      // Unblock the player and clear the active phase.
      // Set interPhaseCooldown so checkBossProximity waits
      // for the damage animation before triggering next phase.
      this.activeBossPhase    = 0
      this.bossBlocked        = false
      this.interPhaseCooldown = true

      this.time.delayedCall(1500, () => {
        this.interPhaseCooldown = false
        // Next update tick: checkBossProximity fires if player is close → phase 2/3
      })
    }
  }

  private defeatBoss() {
    this.spawnSparkles(BOSS_X, this.groundY - 90, 30)
    this.spawnSparkles(BOSS_X - 40, this.groundY - 60, 15)
    this.spawnSparkles(BOSS_X + 40, this.groundY - 60, 15)
    this.tweens.add({
      targets: this.bossContainer, scaleX: 0, scaleY: 0, alpha: 0,
      y: this.groundY + 100, duration: 800, ease: 'Back.easeIn',
      onComplete: () => {
        this.bossContainer.destroy()
        this.bossPhase   = 4
        this.bossBlocked = false
        dispatchToReact(ZONE1_EVENTS.ZONE_COMPLETE, {})
        this.cameras.main.zoomTo(1.1, 1000, 'Sine.easeInOut')
      },
    })
  }

  private spawnSparkles(x: number, y: number, count = 12) {
    const colors = [0xffd700, 0xff6b35, 0x00e5ff, 0x76ff03, 0xff4081]
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
      const d     = 80 + Math.random() * 120
      const dot   = this.add.circle(x, y, 4 + Math.random() * 4, colors[Math.floor(Math.random() * colors.length)]).setDepth(20)
      this.tweens.add({
        targets: dot, x: x + Math.cos(angle) * d, y: y + Math.sin(angle) * d,
        alpha: 0, scaleX: 0, scaleY: 0,
        duration: 600 + Math.random() * 400, ease: 'Quad.easeOut',
        onComplete: () => dot.destroy(),
      })
    }
  }

  private flashPlayer() {
    this.tweens.add({
      targets: this.player, alpha: 0.3, duration: 100, yoyo: true, repeat: 4, ease: 'Linear',
      onComplete: () => this.player.setAlpha(1),
    })
  }
}