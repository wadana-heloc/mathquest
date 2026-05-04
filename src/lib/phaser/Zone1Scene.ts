// // ─────────────────────────────────────────────────────────────
// //  MathQuest · src/lib/phaser/Zone1Scene.ts  — Zone 1 "Pebble Shore"
// //
// //  FREEZE FIX (this version):
// //  The previous `answerSent` flag in the Scene was meant to prevent
// //  double-processing, but it created a timing hole:
// //
// //    1. Phase 1 correct answer arrives → answerSent = true
// //    2. onBossPhaseCleared → interPhaseCooldown 1200ms timer starts
// //       (which was supposed to reset answerSent after 1200ms)
// //    3. triggerBoss() for phase 2 sets answerSent = false ✓
// //    4. Player solves phase 2 → ANSWER_RESULT arrives
// //    5. handleAnswerResult checks `if (answerSent) return` ← FREEZE
// //       because triggerBoss set it false but some other code path
// //       set it back true before step 4 arrived.
// //
// //  Root cause: answerSent was being managed in too many places
// //  (triggerBoss, onObstacleCleared timer, interPhaseCooldown timer)
// //  creating unpredictable state. The React side already has its own
// //  dedup (answerDispatchedRef), so Scene-level dedup is unnecessary.
// //
// //  Fix: remove answerSent entirely from the Scene. One clear rule:
// //  the Scene only processes ANSWER_RESULT when it's actually blocked.
// //  If it's not blocked, the event is a harmless no-op.
// // ─────────────────────────────────────────────────────────────

// import Phaser from 'phaser'

// export const ZONE1_EVENTS = {
//   SHOW_PROBLEM:  'zone1:showProblem',
//   ANSWER_RESULT: 'zone1:answerResult',
//   ZONE_COMPLETE: 'zone1:zoneComplete',
//   BOSS_PHASE:    'zone1:bossPhase',
//   PROGRESS:      'zone1:progress',
// }


// function dispatchToReact(name: string, detail: object) {
//   window.dispatchEvent(new CustomEvent(name, { detail }))
// }

// interface ObstacleConfig {
//   id: string
//   problemId: string
//   x: number
//   label: string
//   emoji: string
//   color: number
//   width: number
//   height: number
// }

// const OBSTACLES: ObstacleConfig[] = [
//   { id: 'obj1', problemId: 'Z1-OBJ-01', x: 600,  label: 'Chest',      emoji: '🪙', color: 0xd4a017, width: 64,  height: 56  },
//   { id: 'obj2', problemId: 'Z1-OBJ-02', x: 1000, label: 'Turtle',     emoji: '🐢', color: 0x3d9e3d, width: 56,  height: 48  },
//   { id: 'obj3', problemId: 'Z1-OBJ-03', x: 1420, label: 'Bridge',     emoji: '🐚', color: 0x8b5e3c, width: 100, height: 60  },
//   { id: 'obj4', problemId: 'Z1-OBJ-04', x: 1850, label: 'Rock',       emoji: '🪨', color: 0x7a7a7a, width: 70,  height: 64  },
//   { id: 'obj5', problemId: 'Z1-OBJ-05', x: 2280, label: 'Crabs',      emoji: '🦀', color: 0xe85c2a, width: 80,  height: 50  },
//   { id: 'obj6', problemId: 'Z1-OBJ-06', x: 2720, label: 'Stones',     emoji: '🪸', color: 0x3b82f6, width: 90,  height: 40  },
//   { id: 'obj7', problemId: 'Z1-OBJ-07', x: 3160, label: 'Pelican',    emoji: '🐙', color: 0xdeb887, width: 60,  height: 70  },
//   { id: 'obj8', problemId: 'Z1-OBJ-08', x: 3600, label: 'Lighthouse', emoji: '🦞', color: 0xcccccc, width: 50,  height: 120 },
// ]

// const BOSS_X         = 4200
// const WORLD_WIDTH    = 4800
// const GROUND_Y_RATIO = 0.78

// export class Zone1Scene extends Phaser.Scene {
//   // ── Dimensions ─────────────────────────────────────────────
//   private worldWidth!: number
//   private groundY!: number
//   private screenW!: number
//   private screenH!: number

//   // ── Player ─────────────────────────────────────────────────
//   private player!: Phaser.GameObjects.Container
//   private playerVelX     = 0
//   private playerVelY     = 0
//   private playerOnGround = true
//   private playerX        = 120
//   private playerY        = 0
//   private facingRight    = true

//   // ── Blocking flags ─────────────────────────────────────────
//   // Simple, clean: one flag per blocker type, no dedup logic here
//   private obstacleBlocked = false   // true while an obstacle problem is open
//   private bossBlocked     = false   // true while a boss problem is open
//   private get isBlocked() { return this.obstacleBlocked || this.bossBlocked }

//   // ── Cooldown flags ─────────────────────────────────────────
//   private obsCooldown        = false  // brief cooldown after clearing/closing obstacle
//   private interPhaseCooldown = false  // pause between boss phases for animation

//   // ── Input ──────────────────────────────────────────────────
//   private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
//   private keyA!: Phaser.Input.Keyboard.Key
//   private keyD!: Phaser.Input.Keyboard.Key
//   private keyW!: Phaser.Input.Keyboard.Key
//   private keySpace!: Phaser.Input.Keyboard.Key

//   // ── Touch (written by React on-screen buttons) ─────────────
//   public touchLeft  = false
//   public touchRight = false
//   public touchJump  = false

//   // ── Obstacle state ─────────────────────────────────────────
//   private obstacleObjects: Map<string, {
//     container: Phaser.GameObjects.Container
//     config: ObstacleConfig
//     solved: boolean
//   }> = new Map()
//   private solvedCount  = 0
//   private activeObsId: string | null = null

//   // ── Boss state ─────────────────────────────────────────────
//   private bossContainer!: Phaser.GameObjects.Container
//   private bossPhase       = 0  // 0=none, 1/2/3=phase in progress, 4=defeated
//   private activeBossPhase = 0  // which phase problem is currently open (0=none)
//   private bossHP: Phaser.GameObjects.Rectangle[] = []

//   // ── Environment ────────────────────────────────────────────
//   private waves: Phaser.GameObjects.Rectangle[] = []
//   private waveTimer = 0

//   // ── Cleanup ────────────────────────────────────────────────
//   private answerListener!: (e: Event) => void

//   // ── book UI ─────────────────────────────────────────────────────
//   private bookUI!: Phaser.GameObjects.Container;
// private isBookOpen = false;

//   constructor() { super({ key: 'Zone1Scene' }) }
//   preload() {}

//   create() {
//     this.screenW    = this.scale.width
//     this.screenH    = this.scale.height
//     this.worldWidth = WORLD_WIDTH
//     this.groundY    = this.screenH * GROUND_Y_RATIO
//     this.playerY    = this.groundY - 40

//     ;(window as any).__zone1Scene = this

//     this.createSky()
//     this.createSun()
//     this.createClouds()
//     this.createSea()
//     this.createGround()
//     this.createObstacles()
//     this.createBoss()
//     this.createBirds()
//     this.createPlayer()

//     this.cursors  = this.input.keyboard!.createCursorKeys()
//     this.keyA     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A)
//     this.keyD     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
//     this.keyW     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W)
//     this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

//     this.answerListener = (e: Event) => {
//       const { correct, obstacleId } = (e as CustomEvent).detail
//       this.handleAnswerResult(correct, obstacleId)
//     }
//     window.addEventListener(ZONE1_EVENTS.ANSWER_RESULT, this.answerListener)

//     this.cameras.main.setBounds(0, 0, this.worldWidth, this.screenH)
//     this.cameras.main.startFollow(this.player, true, 0.08, 0.08)

//     this.time.delayedCall(200, () =>
//       dispatchToReact(ZONE1_EVENTS.PROGRESS, { solved: 0, total: 8 })
//     )
//   }

//   shutdown() {
//     window.removeEventListener(ZONE1_EVENTS.ANSWER_RESULT, this.answerListener)
//     ;(window as any).__zone1Scene = null
//   }

//   // ── Environment ───────────────────────────────────────────

// //   private createSky() {
// //     const colors = [0x1a6ec7, 0x3a8fd6, 0x5aafe6, 0x7ecaf5, 0xaaddf8]
// //     const h = this.groundY / colors.length
// //     colors.forEach((c, i) =>
// //       this.add.rectangle(this.screenW / 2, i * h + h / 2, this.screenW, h + 2, c)
// //         .setScrollFactor(0).setDepth(0)
// //     )
// //   }


// private createSky() {
//   // Full-screen sky (NOT limited to groundY)
//   const rt = this.make.renderTexture({
//     width: this.screenW,
//     height: this.screenH,
//   }, true)

//   const gfx = this.make.graphics({ x: 0, y: 0 })

//   const steps = 60

//   const topColor = new Phaser.Display.Color(11, 61, 145)     // deep blue
//   const bottomColor = new Phaser.Display.Color(207, 239, 255) // light sky

//   for (let i = 0; i < steps; i++) {
//     const t = i / steps

//     const color = Phaser.Display.Color.Interpolate.ColorWithColor(
//       topColor,
//       bottomColor,
//       steps,
//       i
//     )

//     gfx.fillStyle(
//       Phaser.Display.Color.GetColor(color.r, color.g, color.b),
//       1
//     )

//     gfx.fillRect(
//       0,
//       t * this.screenH,
//       this.screenW,
//       this.screenH / steps + 2
//     )
//   }

//   rt.draw(gfx)
//   gfx.destroy()

//   rt.setPosition(0, 0)
//   rt.setOrigin(0, 0)
//   rt.setScrollFactor(0)
//   rt.setDepth(0)
// }

//   private createSun() {
//     const sx = this.screenW - 140
//     const glow = this.add.circle(sx, 90, 58, 0xfff5a0, 0.3).setScrollFactor(0).setDepth(1)
//     const sun  = this.add.circle(sx, 90, 40, 0xffe44a).setScrollFactor(0).setDepth(1)
//     this.tweens.add({ targets: [glow, sun], scaleX: 1.06, scaleY: 1.06, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
//     for (let i = 0; i < 8; i++) {
//       const a = (i / 8) * Math.PI * 2
//       const ray = this.add.rectangle(sx + Math.cos(a) * 56, 90 + Math.sin(a) * 56, 22, 4, 0xffe44a, 0.5)
//         .setScrollFactor(0).setDepth(1).setRotation(a)
//       this.tweens.add({ targets: ray, alpha: { from: 0.5, to: 0.15 }, duration: 1800 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
//     }
//   }

//   private createClouds() {
//     const pos = [
//       { x: 120, y: 60, sx: 0.05 }, { x: 380, y: 40, sx: 0.07 },
//       { x: 640, y: 80, sx: 0.04 }, { x: 900, y: 55, sx: 0.06 },
//     ]
//     pos.forEach(({ x, y, sx }) => {
//       const c = this.add.container(x, y).setScrollFactor(sx).setDepth(1)
//       const puffs: [number, number, number][] = [[0,0,38],[-30,8,28],[30,8,28],[-60,14,20],[60,14,20]]
//       puffs.forEach(([cx, cy, r]) => c.add(this.add.circle(cx, cy, r, 0xffffff, 0.9)))
//       this.tweens.add({ targets: c, y: y - 6, duration: 3000 + Math.random() * 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
//     })
//   }

// //   private createSea() {
// //     const seaH = this.screenH - this.groundY
// //     this.add.rectangle(this.screenW / 2, this.groundY + seaH / 2, this.screenW, seaH, 0x1a7bbf)
// //       .setScrollFactor(0).setDepth(2)
// //     const wc = [0x2196f3, 0x42a5f5, 0x64b5f6, 0x90caf9]
// //     for (let w = 0; w < 4; w++) {
// //       this.waves.push(
// //         this.add.rectangle(this.screenW / 2, this.groundY + 8 + w * 14, this.screenW + 60, 10, wc[w], 0.7)
// //           .setScrollFactor(0).setDepth(3)
// //       )
// //     }
// //     for (let f = 0; f < 6; f++) {
// //       const foam = this.add.ellipse(60 + f * (this.screenW / 5), this.groundY + 4, 40, 10, 0xffffff, 0.5)
// //         .setScrollFactor(0).setDepth(3)
// //       this.tweens.add({ targets: foam, scaleX: { from: 0.8, to: 1.3 }, alpha: { from: 0.5, to: 0.2 }, duration: 1200 + f * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
// //     }
// //   }
// private createSea() {
//   const seaHeight = 90;

//   // 👇 IMPORTANT: sea sits BELOW where ground starts
//   // const seaY = this.groundY + seaHeight / 2;
//   // const seaY = this.groundY + seaHeight / 2 + 10; 
//   const seaY = this.groundY + seaHeight / 2 - 40;

//   this.add.rectangle(
//     this.screenW / 2,
//     seaY,
//     this.screenW,
//     seaHeight,
//     0x1a7bbf
//   )
//     .setScrollFactor(0)
//     .setDepth(1); // 👈 ALWAYS behind beach

//   const waveColors = [0x42a5f5, 0x64b5f6, 0x90caf9];

//   for (let i = 0; i < 3; i++) {
//     const wave = this.add.rectangle(
//       this.screenW / 2,
//       // this.groundY + i * 4, // 👈 shoreline line
//       this.groundY + 5 + i * 6,
//       this.screenW + 120,
//       10,
//       waveColors[i],
//       0.7
//     )
//       .setScrollFactor(0)
//       .setDepth(2); // 👈 above sea, below ground

//     this.waves.push(wave);

//     this.tweens.add({
//       targets: wave,
//       x: this.screenW / 2 + 25,
//       duration: 1200 + i * 200,
//       yoyo: true,
//       repeat: -1,
//       ease: "Sine.easeInOut",
//     });
//   }
// }

// //   private createGround() {
// //     const groundH = this.screenH - this.groundY
// //     this.add.rectangle(this.worldWidth / 2, this.groundY + groundH / 2, this.worldWidth, groundH, 0xf5d78e).setDepth(2)
// //     this.add.rectangle(this.worldWidth / 2, this.groundY + 8, this.worldWidth, 16, 0xe6c46a).setDepth(2)
// //     const pc = [0xccbbaa, 0xaaa090, 0xdd8844, 0xcc99aa]
// //     for (let i = 0; i < 80; i++) {
// //       const px = 100 + Math.random() * (this.worldWidth - 200)
// //       const py = this.groundY + 16 + Math.random() * 40
// //       const s  = 3 + Math.random() * 8
// //       this.add.ellipse(px, py, s * 1.4, s, pc[Math.floor(Math.random() * pc.length)], 0.8).setDepth(2)
// //     }
// //     for (let i = 0; i < 8; i++) {
// //       const star = this.add.text(300 + i * 500, this.groundY + 22, '⭐', { fontSize: '18px' }).setDepth(2).setOrigin(0.5)
// //       this.tweens.add({ targets: star, angle: 20, duration: 2000 + Math.random() * 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
// //     }
// //     for (let i = 0; i < 12; i++) {
// //       this.add.text(200 + Math.random() * (this.worldWidth - 400), this.groundY + 18, '🐚', { fontSize: '14px' }).setDepth(2).setOrigin(0.5)
// //     }
// //   }
// private createGround() {
//   const seaHeight = 90
//   // const groundStartY = this.groundY + seaHeight
//   const groundStartY = this.groundY
//   const groundH = this.screenH - groundStartY

//   // ─────────────────────────────
//   // Sand base
//   // ─────────────────────────────
//   this.add.rectangle(
//     this.worldWidth / 2,
//     groundStartY + groundH / 2,
//     this.worldWidth,
//     groundH,
//     0xf5d78e
//   ).setDepth(2)

//   // Shore strip
//   this.add.rectangle(
//     this.worldWidth / 2,
//     groundStartY + 8,
//     this.worldWidth,
//     16,
//     0xe6c46a
//   ).setDepth(2)

//   // ─────────────────────────────
//   // Pebbles (more + natural spread)
//   // ─────────────────────────────
//   const pebblesCount = 180
//   const pc = [0xccbbaa, 0xaaa090, 0xdd8844, 0xcc99aa]

//   for (let i = 0; i < pebblesCount; i++) {
//     const px = Math.random() * this.worldWidth
//     const py = groundStartY + 10 + Math.random() * 70
//     const s = 2 + Math.random() * 9

//     this.add.ellipse(
//       px,
//       py,
//       s * 1.4,
//       s,
//       pc[Math.floor(Math.random() * pc.length)],
//       0.8
//     ).setDepth(2)
//   }

//   // ─────────────────────────────
//   // Stars (more + shoreline bias)
//   // ─────────────────────────────
//   const starsCount = 28

//   for (let i = 0; i < starsCount; i++) {
//     const star = this.add.text(
//       200 + Math.random() * (this.worldWidth - 400),
//       groundStartY + 8 + Math.random() * 35,
//       "⭐",
//       {
//         fontSize: `${14 + Math.random() * 8}px`
//       }
//     ).setDepth(2).setOrigin(0.5)

//     this.tweens.add({
//       targets: star,
//       angle: 15,
//       duration: 1800 + Math.random() * 1200,
//       yoyo: true,
//       repeat: -1,
//       ease: "Sine.easeInOut",
//     })
//   }

//   // ─────────────────────────────
//   // Shells (more scattered)
//   // ─────────────────────────────
//   const shellsCount = 35

//   for (let i = 0; i < shellsCount; i++) {
//     this.add.text(
//       Math.random() * this.worldWidth,
//       groundStartY + 15 + Math.random() * 60,
//       "🐚",
//       { fontSize: `${12 + Math.random() * 6}px` }
//     )
//       .setDepth(2)
//       .setOrigin(0.5)
//   }
// }

//   private createPlayer() {
//     this.player = this.add.container(this.playerX, this.playerY).setDepth(10)
//     const shadow = this.add.ellipse(0, 24, 40, 10, 0x000000, 0.18)
//     const body   = this.add.rectangle(0, 0, 36, 48, 0xff7043)
//     const pack   = this.add.rectangle(14, -4, 14, 24, 0xef9a9a)
//     const head   = this.add.circle(0, -32, 18, 0xffccaa)
//     const eyeL   = this.add.circle(-6, -35, 3, 0x333333)
//     const eyeR   = this.add.circle(6, -35, 3, 0x333333)
//     const smile  = this.add.arc(0, -28, 8, 0, 180, false, 0x333333)
//     const hat    = this.add.rectangle(0, -50, 28, 8, 0x1565c0)
//     const brim   = this.add.rectangle(0, -44, 36, 6, 0x1e88e5)
//     this.player.add([shadow, body, pack, head, eyeL, eyeR, smile, hat, brim])
//     this.tweens.add({ targets: this.player, y: this.playerY - 5, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
//   }
  
// //   private createPlayer() {
// //     this.player = this.add.container(this.playerX, this.playerY).setDepth(10);
    
// //     // Smooth Shadow
// //     const shadow = this.add.ellipse(0, 24, 42, 12, 0x000000, 0.2);
    
// //     // Body with a slight gradient feel (two stacked rectangles)
// //     const bodyBase = this.add.rectangle(0, 0, 36, 48, 0xff7043).setStrokeStyle(2, 0xbf360c);
// //     const bodyHighlight = this.add.rectangle(-8, 0, 10, 40, 0xff8a65, 0.5); // "Light" hitting the side
    
// //     const pack = this.add.rectangle(14, 2, 16, 28, 0x8d6e63).setStrokeStyle(2, 0x4e342e);
    
// //     // Head with "blush"
// //     const head = this.add.circle(0, -32, 20, 0xffccaa).setStrokeStyle(2, 0xe0a986);
// //     const cheekL = this.add.circle(-10, -28, 4, 0xff8a80, 0.4);
// //     const cheekR = this.add.circle(10, -28, 4, 0xff8a80, 0.4);
    
// //     const eyeL = this.add.circle(-7, -35, 3.5, 0x212121);
// //     const eyeR = this.add.circle(7, -35, 3.5, 0x212121);
    
// //     // A better hat
// //     const hatBase = this.add.rectangle(0, -52, 30, 10, 0x1565c0);
// //     const hatBrim = this.add.rectangle(0, -46, 42, 6, 0x0d47a1);

// //     this.player.add([shadow, bodyBase, bodyHighlight, pack, head, cheekL, cheekR, eyeL, eyeR, hatBase, hatBrim]);

// //     // Idle Animation: Breathing + Squishing
// //     this.tweens.add({
// //         targets: this.player,
// //         scaleY: 0.95,
// //         scaleX: 1.05,
// //         duration: 800,
// //         yoyo: true,
// //         repeat: -1,
// //         ease: 'Sine.easeInOut'
// //     });
// // }

//   // private createObstacles() {
//   //   OBSTACLES.forEach(cfg => {
//   //     const container = this.add.container(cfg.x, this.groundY - cfg.height / 2).setDepth(5)
//   //     const body  = this.add.rectangle(0, 0, cfg.width, cfg.height, cfg.color, 0.9).setStrokeStyle(3, 0x000000, 0.3)
//   //     const icon  = this.add.text(0, -cfg.height / 2 - 20, cfg.emoji, { fontSize: '36px' }).setOrigin(0.5)
//   //     const lbl   = this.add.text(0, cfg.height / 2 + 14, cfg.label, {
//   //       fontSize: '13px', fontFamily: 'Nunito, sans-serif',
//   //       color: '#ffffff', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
//   //     }).setOrigin(0.5)
//   //     const badge = this.add.circle(cfg.width / 2 + 8, -cfg.height / 2 - 8, 14, 0xff5722)
//   //     const qmark = this.add.text(cfg.width / 2 + 8, -cfg.height / 2 - 8, '?', {
//   //       fontSize: '16px', fontStyle: 'bold', color: '#ffffff',
//   //     }).setOrigin(0.5)
//   //     this.tweens.add({ targets: icon,  y: -cfg.height / 2 - 26, duration: 1000 + Math.random() * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
//   //     this.tweens.add({ targets: badge, scaleX: 1.2, scaleY: 1.2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
//   //     container.add([body, icon, lbl, badge, qmark])
//   //     this.obstacleObjects.set(cfg.id, { container, config: cfg, solved: false })
//   //   })
//   // }

//   private createObstacles() {
//   OBSTACLES.forEach(cfg => {
//     const container = this.add.container(cfg.x, this.groundY - cfg.height / 2).setDepth(5)

//     // Large emoji only — no box, no label, no badge
//     const icon = this.add.text(0, 0, cfg.emoji, {
//       fontSize: '100px', //64
//     }).setOrigin(0.5)

//     // Gentle bob animation
//     this.tweens.add({
//       targets: icon,
//       y: -12,
//       duration: 900 + Math.random() * 400,
//       yoyo: true,
//       repeat: -1,
//       ease: 'Sine.easeInOut',
//     })

//     container.add([icon])
//     this.obstacleObjects.set(cfg.id, { container, config: cfg, solved: false })
//   })
// }

//   private createBoss() {
//     this.bossContainer = this.add.container(BOSS_X, this.groundY - 90).setDepth(8)
//     const glow   = this.add.ellipse(0, 0, 200, 230, 0x3f51b5, 0.3)
//     const body   = this.add.ellipse(0, 0, 180, 210, 0x1a237e, 0.95)
//     const inner  = this.add.ellipse(0, -10, 120, 135, 0x283593, 0.8)
//     const eyeL   = this.add.circle(-30, -28, 16, 0x00e5ff)
//     const eyeR   = this.add.circle(30, -28, 16, 0x00e5ff)
//     const pupilL = this.add.circle(-30, -28, 7, 0x001f3f)
//     const pupilR = this.add.circle(30, -28, 7, 0x001f3f)
//     const crown  = this.add.text(0, -95, '👑', { fontSize: '40px' }).setOrigin(0.5)//28px
//     for (let t = 0; t < 5; t++) {
//       const tent = this.add.rectangle((t - 2) * 32, 105, 14, 70, 0x1a237e, 0.8)
//       this.bossContainer.add(tent)
//       this.tweens.add({ targets: tent, y: 78, duration: 800 + t * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
//     }
//     for (let h = 0; h < 3; h++) {
//       const bg   = this.add.rectangle(-30 + h * 30, -130, 24, 14, 0x333333).setStrokeStyle(1, 0x666666)
//       const fill = this.add.rectangle(-30 + h * 30, -130, 22, 12, 0xff1744)
//       this.bossHP.push(fill)
//       this.bossContainer.add([bg, fill])
//     }
//     const nameTxt  = this.add.text(0, -158, 'TIDAL SENTINEL', { fontSize: '13px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold', color: '#e0e0ff', stroke: '#000033', strokeThickness: 3 }).setOrigin(0.5)
//     const badgeBg  = this.add.rectangle(0, -175, 70, 20, 0xff1744)
//     const badgeTxt = this.add.text(0, -175, '⚠ BOSS', { fontSize: '11px', fontStyle: 'bold', fontFamily: 'Nunito, sans-serif', color: '#ffffff' }).setOrigin(0.5)
//     this.bossContainer.add([glow, body, inner, eyeL, eyeR, pupilL, pupilR, crown, nameTxt, badgeBg, badgeTxt])
//     this.tweens.add({ targets: this.bossContainer, y: this.groundY - 96, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
//     this.tweens.add({ targets: glow, alpha: { from: 0.3, to: 0.6 }, scaleX: 1.08, scaleY: 1.08, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
//     ;[eyeL, eyeR].forEach(eye => this.tweens.add({ targets: eye, alpha: { from: 1, to: 0.4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }))
//   }
// //   private createBoss() {
// //     this.bossContainer = this.add.container(BOSS_X, this.groundY - 120).setDepth(8);
    
// //     // Inner swirling core
// //     const core = this.add.circle(0, 0, 60, 0x1a237e).setStrokeStyle(4, 0x00e5ff);
// //     const pupil = this.add.circle(0, 0, 25, 0x000000);
// //     const glint = this.add.circle(-8, -8, 8, 0xffffff, 0.4);
    
// //     this.bossContainer.add([core, pupil, glint]);

// //     // Orbiting "Sentinels" (The HP Bars attached to orbiting gems)
// //     for (let h = 0; h < 3; h++) {
// //         const orbitContainer = this.add.container(0, 0);
// //         const gem = this.add.star(100, 0, 5, 15, 30, 0xff1744).setStrokeStyle(2, 0xffffff);
        
// //         // HP mini-bar above the gem
// //         const hpBg = this.add.rectangle(100, -25, 30, 6, 0x000000);
// //         const hpFill = this.add.rectangle(100, -25, 28, 4, 0xff1744);
// //         this.bossHP.push(hpFill);
        
// //         orbitContainer.add([gem, hpBg, hpFill]);
// //         this.bossContainer.add(orbitContainer);

// //         // Make them rotate
// //         this.tweens.add({
// //             targets: orbitContainer,
// //             angle: 360,
// //             duration: 4000 + (h * 1000),
// //             repeat: -1,
// //             ease: 'Linear'
// //         });
// //     }

// //     // Boss "Floating" Movement
// //     this.tweens.add({
// //         targets: this.bossContainer,
// //         y: '+=20',
// //         duration: 2000,
// //         yoyo: true,
// //         repeat: -1,
// //         ease: 'Sine.easeInOut'
// //     });
// // }

//   private createBirds() {
//     ['🐦', '🦅', '🦜', '🐦', '🕊️','🦉'].forEach((emoji, i) => {
//       const bird = this.add.text(-80 - i * 200, 50 + i * 30, emoji, { fontSize: '22px' })
//         .setScrollFactor(0.1).setDepth(1)
//         bird.setScale(-1, 1)
//       this.tweens.add({ targets: bird, x: this.screenW + 100, duration: 12000 + i * 3000, repeat: -1, ease: 'Linear', onRepeat: () => { bird.x = -80 } })
//       this.tweens.add({ targets: bird, y: bird.y - 12, duration: 800 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
//     })
//   }

//   // ── Update ────────────────────────────────────────────────

//   update(_time: number, delta: number) {
//     this.waveTimer += delta
//     this.waves.forEach((w, i) => {
//       w.x = this.screenW / 2 + Math.sin(this.waveTimer * 0.001 + i * 1.2) * 20
//     })
//     this.updatePlayer(delta)
//     if (!this.isBlocked) {
//       this.checkObstacleCollisions()
//       this.checkBossProximity()
//     }
//   }

//   private updatePlayer(delta: number) {
//     if (this.isBlocked) return

//     const dt = delta / 16.67
//     const goLeft  = this.cursors.left.isDown  || this.keyA.isDown || this.touchLeft
//     const goRight = this.cursors.right.isDown || this.keyD.isDown || this.touchRight
//     const jump    = Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
//                     Phaser.Input.Keyboard.JustDown(this.keyW)       ||
//                     Phaser.Input.Keyboard.JustDown(this.keySpace)   ||
//                     this.touchJump
//     this.touchJump = false

//     if (goLeft)       { this.playerVelX = -4.5; this.facingRight = false }
//     else if (goRight) { this.playerVelX =  4.5; this.facingRight = true  }
//     else              { this.playerVelX *= 0.75 }

//     if (jump && this.playerOnGround) { this.playerVelY = -14; this.playerOnGround = false }

//     this.playerVelY += 0.55 * dt
//     this.playerY    += this.playerVelY * dt

//     const floorY = this.groundY - 24
//     if (this.playerY >= floorY) { this.playerY = floorY; this.playerVelY = 0; this.playerOnGround = true }

//     this.playerX = Math.max(40, this.playerX + this.playerVelX * dt)
//     this.playerX = Math.min(this.getRightLimit(), this.playerX)
//     this.player.setScale(this.facingRight ? 1 : -1, 1)
//     this.player.setPosition(this.playerX, this.playerY)
//   }

//   private getRightLimit(): number {
//     for (const cfg of OBSTACLES) {
//       const obs = this.obstacleObjects.get(cfg.id)
//       if (obs && !obs.solved) return cfg.x - 30
//     }
//     if (this.bossPhase < 4) return BOSS_X - 80
//     return this.worldWidth - 60
//   }

//   private checkObstacleCollisions() {
//     if (this.obsCooldown || this.activeObsId) return
//     for (const cfg of OBSTACLES) {
//       const obs = this.obstacleObjects.get(cfg.id)
//       if (!obs || obs.solved) continue
//       if (Math.abs(this.playerX - cfg.x) < cfg.width / 2 + 40) {
//         this.triggerObstacle(cfg.id)
//         return
//       }
//     }
//   }

//   private checkBossProximity() {
//     if (this.solvedCount < 8)      return
//     if (this.bossPhase >= 4)       return
//     if (this.activeBossPhase > 0)  return
//     if (this.interPhaseCooldown)   return
//     if (Math.abs(this.playerX - BOSS_X) >= 110) return
//     this.triggerBoss()
//   }

//   private triggerObstacle(id: string) {
//     this.activeObsId     = id
//     this.obstacleBlocked = true
//     const cfg = OBSTACLES.find(o => o.id === id)!
//     dispatchToReact(ZONE1_EVENTS.SHOW_PROBLEM, {
//       type: 'obstacle', obstacleId: id,
//       problemId: cfg.problemId, label: cfg.label,
//     })
//   }

//   private triggerBoss() {
//     const nextPhase = this.bossPhase + 1
//     if (nextPhase > 3) return
//     this.bossPhase       = nextPhase
//     this.activeBossPhase = nextPhase
//     this.bossBlocked     = true
//     const problemIds = ['Z1-BOSS-01', 'Z1-BOSS-02', 'Z1-BOSS-03']
//     dispatchToReact(ZONE1_EVENTS.SHOW_PROBLEM, {
//       type: 'boss',
//       obstacleId: `boss-phase-${nextPhase}`,
//       problemId: problemIds[nextPhase - 1],
//       bossPhase: nextPhase,
//       label: `Tidal Sentinel — Phase ${nextPhase}`,
//     })
//     dispatchToReact(ZONE1_EVENTS.BOSS_PHASE, { phase: nextPhase })
//     this.tweens.add({ targets: this.bossContainer, x: BOSS_X + 12, duration: 80, yoyo: true, repeat: 5, ease: 'Linear' })
//   }

//   // ── Answer result from React ──────────────────────────────
//   // NO dedup here — the React side (answerDispatchedRef) guarantees
//   // exactly one event per modal. We just act on it immediately.

//   private handleAnswerResult(correct: boolean, obstacleId: string) {
//     // Safety guard: only process if we're actually blocked
//     // (prevents stray events from previous sessions)
//     if (!this.obstacleBlocked && !this.bossBlocked) return

//     if (correct) {
//       if (obstacleId.startsWith('boss-phase')) {
//         this.onBossPhaseCleared()
//       } else {
//         this.onObstacleCleared(obstacleId)
//       }
//     } else {
//       this.onWrongAnswer()
//     }
//   }

//   private onWrongAnswer() {
//     this.flashPlayer()
//     this.time.delayedCall(800, () => {
//       this.obstacleBlocked = false
//       this.bossBlocked     = false
//       this.activeObsId     = null
//       // Revert bossPhase so triggerBoss() re-fires the same phase.
//       // Without this, nextPhase = bossPhase+1 increments past 3 and
//       // the guard `if (nextPhase > 3) return` permanently blocks
//       // phase 3 from ever appearing again after one wrong answer.
//       if (this.activeBossPhase > 0) {
//         this.bossPhase--
//         this.interPhaseCooldown = true
//         this.time.delayedCall(1000, () => { this.interPhaseCooldown = false })
//       }
//       this.activeBossPhase = 0
//       // Cooldown so player doesn't instantly re-trigger by walking
//       this.obsCooldown = true
//       this.time.delayedCall(600, () => { this.obsCooldown = false })
//     })
//   }

//   // private onObstacleCleared(obstacleId: string) {
//   //   const obs = this.obstacleObjects.get(obstacleId)
//   //   if (!obs) return
//   //   obs.solved           = true
//   //   this.solvedCount++
//   //   this.activeObsId     = null
//   //   this.obstacleBlocked = false

//   //   this.tweens.add({
//   //     targets: obs.container, alpha: 0, scaleY: 0,
//   //     y: obs.container.y - 50, duration: 600, ease: 'Back.easeIn',
//   //     onComplete: () => obs.container.destroy(),
//   //   })
//   //   this.spawnSparkles(obs.config.x, this.groundY - obs.config.height / 2)
//   //   dispatchToReact(ZONE1_EVENTS.PROGRESS, { solved: this.solvedCount, total: 8 })

//   //   this.obsCooldown = true
//   //   this.time.delayedCall(700, () => { this.obsCooldown = false })
//   // }

//   private onObstacleCleared(obstacleId: string) {
//   const obs = this.obstacleObjects.get(obstacleId)
//   if (!obs) return
//   obs.solved           = true
//   this.solvedCount++
//   this.activeObsId     = null
//   this.obstacleBlocked = false

//   const cx = obs.config.x
//   const cy = this.groundY - obs.config.height / 2

//   // ── 1. Screen flash ───────────────────────────────────────
//   const flash = this.add.rectangle(
//     this.screenW / 2, this.screenH / 2,
//     this.screenW, this.screenH,
//     0xffffff, 0.5
//   ).setScrollFactor(0).setDepth(50)
//   this.tweens.add({
//     targets: flash, alpha: 0, duration: 350, ease: 'Quad.easeOut',
//     onComplete: () => flash.destroy(),
//   })

//   // ── 2. Emoji rockets upward and fades ─────────────────────
//   const ghost = this.add.text(cx, cy, obs.config.emoji, {
//     fontSize: '100px',
//   }).setOrigin(0.5).setDepth(30)
//   this.tweens.add({
//     targets: ghost,
//     y: cy - 220,
//     scaleX: 2.2, scaleY: 2.2,
//     alpha: 0,
//     duration: 700,
//     ease: 'Cubic.easeOut',
//     onComplete: () => ghost.destroy(),
//   })

//   // ── 3. Shockwave ring ─────────────────────────────────────
//   for (let r = 0; r < 3; r++) {
//     const ring = this.add.circle(cx, cy, 10, 0xffd700, 0)
//       .setStrokeStyle(4 - r, 0xffd700).setDepth(25)
//     this.tweens.add({
//       targets: ring,
//       scaleX: 6 + r * 2, scaleY: 6 + r * 2,
//       alpha: 0,
//       duration: 500 + r * 120,
//       delay: r * 80,
//       ease: 'Quad.easeOut',
//       onComplete: () => ring.destroy(),
//     })
//   }

//   // ── 4. Star burst (emoji confetti) ────────────────────────
//  // ── 4. Particle burst — colored dots in screen space ──────
// const burstColors = [0xffd700, 0xff6b35, 0x00e5ff, 0x76ff03, 0xff4081, 0xffffff, 0xff1744, 0x00bcd4]
// const cam = this.cameras.main
// const screenCX = cx - cam.scrollX
// const screenCY = cy - cam.scrollY

// for (let i = 0; i < 16; i++) {
//   const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.3
//   const dist  = 80 + Math.random() * 100
//   const size  = 6 + Math.random() * 10
//   const color = burstColors[i % burstColors.length]

//   const dot = this.add.circle(screenCX, screenCY, size, color)
//     .setScrollFactor(0)
//     .setDepth(60)

//   this.tweens.add({
//     targets: dot,
//     x: screenCX + Math.cos(angle) * dist,
//     y: screenCY + Math.sin(angle) * dist - 40,
//     duration: 800 + Math.random() * 400,   // move outward
//     ease: 'Cubic.easeOut',
//     onComplete: () => {
//       // Only START fading AFTER the dot has reached its destination
//       this.tweens.add({
//         targets: dot,
//         scaleX: 0, scaleY: 0,
//         alpha: 0,
//         duration: 600,                      // slow fade
//         ease: 'Quad.easeIn',
//         onComplete: () => dot.destroy(),
//       })
//     },
//   })
// }

// for (let i = 0; i < 10; i++) {
//   const angle = Math.random() * Math.PI * 2
//   const dist  = 30 + Math.random() * 50

//   const dot = this.add.circle(screenCX, screenCY, 4 + Math.random() * 5, 0xffffff)
//     .setScrollFactor(0)
//     .setDepth(61)

//   this.tweens.add({
//     targets: dot,
//     x: screenCX + Math.cos(angle) * dist,
//     y: screenCY + Math.sin(angle) * dist,
//     duration: 500 + Math.random() * 300,
//     ease: 'Quad.easeOut',
//     onComplete: () => {
//       this.tweens.add({
//         targets: dot,
//         scaleX: 0, scaleY: 0,
//         alpha: 0,
//         duration: 500,
//         ease: 'Quad.easeIn',
//         onComplete: () => dot.destroy(),
//       })
//     },
//   })

// }

//   // ── 5. "SOLVED!" floating text ────────────────────────────
//   const solvedTxt = this.add.text(cx, cy - 40, '✅ SOLVED!', {
//     fontSize: '28px', fontFamily: 'Nunito, sans-serif',
//     fontStyle: 'bold', color: '#ffffff',
//     stroke: '#00aa44', strokeThickness: 5,
//   }).setOrigin(0.5).setDepth(35).setAlpha(0).setScale(0.4)
//   this.tweens.add({
//     targets: solvedTxt,
//     y: cy - 110, alpha: 1, scaleX: 1, scaleY: 1,
//     duration: 400, ease: 'Back.easeOut',
//     onComplete: () => {
//       this.tweens.add({
//         targets: solvedTxt, alpha: 0, y: cy - 150,
//         duration: 400, delay: 500, ease: 'Quad.easeIn',
//         onComplete: () => solvedTxt.destroy(),
//       })
//     },
//   })

//   // ── 6. Obstacle container pops and vanishes ───────────────
//   this.tweens.add({
//     targets: obs.container,
//     scaleX: 1.4, scaleY: 1.4,
//     duration: 120, ease: 'Quad.easeOut',
//     onComplete: () => {
//       this.tweens.add({
//         targets: obs.container,
//         scaleX: 0, scaleY: 0, alpha: 0,
//         y: obs.container.y - 80,
//         duration: 400, ease: 'Back.easeIn',
//         onComplete: () => obs.container.destroy(),
//       })
//     },
//   })

//   // ── 7. Sparkles (existing, kept) ──────────────────────────
//   this.spawnSparkles(cx, cy, 20)

//   dispatchToReact(ZONE1_EVENTS.PROGRESS, { solved: this.solvedCount, total: 8 })
//   this.obsCooldown = true
//   this.time.delayedCall(700, () => { this.obsCooldown = false })
// }

//   private onBossPhaseCleared() {
//     // Drain HP pip for this phase (phase 1→pip 0, phase 2→pip 1, phase 3→pip 2)
//     const hpIdx = this.bossPhase - 1
//     if (this.bossHP[hpIdx]) {
//       this.tweens.add({
//         targets: this.bossHP[hpIdx], scaleX: 0, duration: 400, ease: 'Back.easeIn',
//         onComplete: () => { if (this.bossHP[hpIdx]) this.bossHP[hpIdx].setFillStyle(0x444444) },
//       })
//     }
//     this.tweens.add({
//       targets: this.bossContainer, alpha: 0.2,
//       duration: 100, yoyo: true, repeat: 4, ease: 'Linear',
//     })

//     if (this.bossPhase >= 3) {
//       // ── All 3 phases solved ──────────────────────────────
//       // Keep bossBlocked=true during defeat animation so
//       // the player can't wander off mid-explosion
//       this.time.delayedCall(900, () => this.defeatBoss())

//     } else {
//       // ── Phase 1 or 2 cleared — set up for next phase ────
//       // Unblock the player and clear the active phase.
//       // Set interPhaseCooldown so checkBossProximity waits
//       // for the damage animation before triggering next phase.
//       this.activeBossPhase    = 0
//       this.bossBlocked        = false
//       this.interPhaseCooldown = true

//       this.time.delayedCall(1500, () => {
//         this.interPhaseCooldown = false
//         // Next update tick: checkBossProximity fires if player is close → phase 2/3
//       })
//     }
//   }

//   private defeatBoss() {
//     this.cameras.main.shake(500, 0.018)
//     this.spawnSparkles(BOSS_X, this.groundY - 90, 40)
//     this.spawnSparkles(BOSS_X - 60, this.groundY - 60, 20)
//     this.spawnSparkles(BOSS_X + 60, this.groundY - 60, 20)
//     this.tweens.add({
//       targets: this.bossContainer, scaleX: 0, scaleY: 0, alpha: 0,
//       y: this.groundY + 100, duration: 600, ease: 'Back.easeIn',
//       onComplete: () => {
//         this.bossContainer.destroy()
//         this.bossPhase   = 4
//         this.bossBlocked = false
//         this.launchCelebration()
//       },
//     })
//   }

//   private launchCelebration() {
//     const cx = this.screenW / 2
//     const cy = this.screenH / 2

//     // ── Screen flash ──────────────────────────────────────────
//     const flash = this.add.rectangle(cx, cy, this.screenW, this.screenH, 0xffffff, 0.75)
//       .setScrollFactor(0).setDepth(70)
//     this.tweens.add({
//       targets: flash, alpha: 0, duration: 600, ease: 'Quad.easeOut',
//       onComplete: () => flash.destroy(),
//     })

//     // ── Dark overlay for contrast ─────────────────────────────
//     const overlay = this.add.rectangle(cx, cy, this.screenW, this.screenH, 0x000000, 0.45)
//       .setScrollFactor(0).setDepth(68)

//     // ── Trophy ────────────────────────────────────────────────
//     const trophy = this.add.text(cx, cy - 150, '🏆', { fontSize: '90px' })
//       .setOrigin(0.5).setScrollFactor(0).setDepth(75).setAlpha(0).setScale(0.1)
//     this.tweens.add({
//       targets: trophy, alpha: 1, scaleX: 1.2, scaleY: 1.2,
//       duration: 600, ease: 'Back.easeOut',
//       onComplete: () => {
//         this.tweens.add({ targets: trophy, scaleX: 1, scaleY: 1, duration: 250, ease: 'Sine.easeOut' })
//         this.tweens.add({ targets: trophy, y: cy - 165, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
//       },
//     })

//     // ── "BOSS DEFEATED!" headline ─────────────────────────────
//     const headline = this.add.text(cx, cy - 50, 'BOSS DEFEATED!', {
//       fontSize: '58px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
//       color: '#ffd700', stroke: '#b34400', strokeThickness: 8,
//     }).setOrigin(0.5).setScrollFactor(0).setDepth(75).setAlpha(0).setScale(0.3)
//     this.tweens.add({
//       targets: headline, alpha: 1, scaleX: 1, scaleY: 1,
//       duration: 500, delay: 150, ease: 'Back.easeOut',
//       onComplete: () => {
//         this.tweens.add({ targets: headline, scaleX: 1.06, scaleY: 1.06, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
//       },
//     })

//     // ── Sub-line ──────────────────────────────────────────────
//     const sub = this.add.text(cx, cy + 20, 'Tidal Sentinel Vanquished! 🌊', {
//       fontSize: '26px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
//       color: '#ffffff', stroke: '#1a237e', strokeThickness: 5,
//     }).setOrigin(0.5).setScrollFactor(0).setDepth(75).setAlpha(0)
//     this.tweens.add({ targets: sub, alpha: 1, y: cy + 12, duration: 400, delay: 350, ease: 'Quad.easeOut' })

//     // ── Stars burst from center ───────────────────────────────
//     this.time.delayedCall(200, () => {
//       for (let i = 0; i < 14; i++) {
//         const angle = (i / 14) * Math.PI * 2
//         const star = this.add.text(cx, cy, '⭐', { fontSize: '22px' })
//           .setOrigin(0.5).setScrollFactor(0).setDepth(73)
//         this.tweens.add({
//           targets: star,
//           x: cx + Math.cos(angle) * 220, y: cy + Math.sin(angle) * 170,
//           alpha: 0, scaleX: 0, scaleY: 0,
//           duration: 900, ease: 'Quad.easeOut',
//           onComplete: () => star.destroy(),
//         })
//       }
//     })

//     // ── Firework volleys ──────────────────────────────────────
//     const fwPoints = [
//       { x: cx - 210, y: cy - 110 }, { x: cx + 210, y: cy - 90 },
//       { x: cx - 100, y: cy - 180 }, { x: cx + 110, y: cy - 170 },
//       { x: cx,       y: cy - 220 }, { x: cx - 270, y: cy + 10  },
//       { x: cx + 270, y: cy - 10  },
//     ]
//     fwPoints.forEach(({ x, y }, i) => {
//       this.time.delayedCall(i * 180, () => this.spawnFirework(x, y))
//     })
//     this.time.delayedCall(1400, () => {
//       fwPoints.forEach(({ x, y }, i) => {
//         this.time.delayedCall(i * 140, () =>
//           this.spawnFirework(x + (Math.random() - 0.5) * 100, y + (Math.random() - 0.5) * 80)
//         )
//       })
//     })

//     // ── Confetti rain ─────────────────────────────────────────
//     for (let i = 0; i < 70; i++) {
//       this.time.delayedCall(Math.random() * 2200, () => {
//         const confettiColors = [0xffd700, 0xff4081, 0x00e5ff, 0x76ff03, 0xff6b35, 0xffffff, 0xff1744, 0xaa00ff]
//         const c = this.add.rectangle(
//           Math.random() * this.screenW, -12,
//           5 + Math.random() * 7, 10 + Math.random() * 10,
//           confettiColors[Math.floor(Math.random() * confettiColors.length)]
//         ).setScrollFactor(0).setDepth(72).setRotation(Math.random() * Math.PI)
//         this.tweens.add({
//           targets: c, y: this.screenH + 20,
//           rotation: c.rotation + (Math.random() - 0.5) * 8,
//           duration: 1600 + Math.random() * 1000, ease: 'Linear',
//           onComplete: () => c.destroy(),
//         })
//       })
//     }

//     // ── Fade out & dispatch ZONE_COMPLETE ─────────────────────
//     this.time.delayedCall(3000, () => {
//       this.tweens.add({
//         targets: [overlay, headline, sub], alpha: 0, duration: 700, ease: 'Quad.easeIn',
//       })
//       this.tweens.add({
//         targets: trophy, alpha: 0, duration: 700, ease: 'Quad.easeIn',
//         onComplete: () => { overlay.destroy(); headline.destroy(); sub.destroy(); trophy.destroy() },
//       })
//       dispatchToReact(ZONE1_EVENTS.ZONE_COMPLETE, {})
//       this.cameras.main.zoomTo(1.12, 1200, 'Sine.easeInOut')
//     })
//   }

//   private spawnFirework(x: number, y: number) {
//     const colors = [0xffd700, 0xff4081, 0x00e5ff, 0x76ff03, 0xff6b35, 0xffffff, 0xff1744, 0xaa00ff]
//     const count = 18
//     for (let i = 0; i < count; i++) {
//       const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3
//       const dist  = 55 + Math.random() * 110
//       const color = colors[Math.floor(Math.random() * colors.length)]
//       const dot   = this.add.circle(x, y, 3 + Math.random() * 6, color).setScrollFactor(0).setDepth(71)
//       this.tweens.add({
//         targets: dot,
//         x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist,
//         duration: 450 + Math.random() * 300, ease: 'Cubic.easeOut',
//         onComplete: () => {
//           this.tweens.add({
//             targets: dot, alpha: 0, scaleX: 0, scaleY: 0,
//             duration: 350, ease: 'Quad.easeIn',
//             onComplete: () => dot.destroy(),
//           })
//         },
//       })
//     }
//     const burst = this.add.circle(x, y, 18, 0xffffff).setScrollFactor(0).setDepth(71)
//     this.tweens.add({
//       targets: burst, scaleX: 3.5, scaleY: 3.5, alpha: 0,
//       duration: 280, ease: 'Quad.easeOut',
//       onComplete: () => burst.destroy(),
//     })
//   }

//   private spawnSparkles(x: number, y: number, count = 12) {
//     const colors = [0xffd700, 0xff6b35, 0x00e5ff, 0x76ff03, 0xff4081]
//     for (let i = 0; i < count; i++) {
//       const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
//       const d     = 80 + Math.random() * 120
//       const dot   = this.add.circle(x, y, 4 + Math.random() * 4, colors[Math.floor(Math.random() * colors.length)]).setDepth(20)
//       this.tweens.add({
//         targets: dot, x: x + Math.cos(angle) * d, y: y + Math.sin(angle) * d,
//         alpha: 0, scaleX: 0, scaleY: 0,
//         duration: 600 + Math.random() * 400, ease: 'Quad.easeOut',
//         onComplete: () => dot.destroy(),
//       })
//     }
//   }

//   private flashPlayer() {
//     this.tweens.add({
//       targets: this.player, alpha: 0.3, duration: 100, yoyo: true, repeat: 4, ease: 'Linear',
//       onComplete: () => this.player.setAlpha(1),
//     })
//   }

//   private createBookUI() {
//     this.bookUI = this.add.container(this.screenW / 2, this.screenH / 2).setDepth(100).setAlpha(0).setScale(0.5);

//     // 1. Dark Overlay (dims the game world)
//     const overlay = this.add.rectangle(0, 0, this.screenW, this.screenH, 0x000000, 0.6)
//         .setInteractive() // Prevents clicking objects behind the book
//         .setScrollFactor(0);

//     // 2. The Book Cover (Brown Leather)
//     const cover = this.add.graphics();
//     cover.fillStyle(0x5d4037, 1);
//     cover.fillRoundedRect(-310, -210, 620, 420, 15);
//     cover.lineStyle(4, 0x3e2723, 1);
//     cover.strokeRoundedRect(-310, -210, 620, 420, 15);

//     // 3. The Pages (Cream Color)
//     const leftPage = this.add.rectangle(-150, 0, 280, 380, 0xfff9c4).setStrokeStyle(2, 0xe6e0b0);
//     const rightPage = this.add.rectangle(150, 0, 280, 380, 0xfff9c4).setStrokeStyle(2, 0xe6e0b0);

//     // 4. The Spine Line
//     const spine = this.add.line(0, 0, 0, -180, 0, 180, 0x5d4037).setLineWidth(2);

//     // 5. Close Button (Red Circle in top right)
//     const closeBtn = this.add.container(290, -190);
//     const btnCirc = this.add.circle(0, 0, 15, 0xff5252).setInteractive({ useHandCursor: true });
//     const btnX = this.add.text(0, 0, '×', { fontSize: '20px', color: '#fff' }).setOrigin(0.5);
//     closeBtn.add([btnCirc, btnX]);
//     closeBtn.on('pointerdown', () => this.toggleBook());

//     // 6. Text Content
//     const title = this.add.text(-150, -170, "Pebble Shore Lore", { 
//         fontSize: '22px', color: '#5d4037', fontFamily: 'serif', fontStyle: 'bold' 
//     }).setOrigin(0.5);

//     const bodyText = this.add.text(150, 0, 
//         "Welcome, Traveler.\n\n" +
//         "The Tidal Sentinel has\n" +
//         "guarded these shores\n" +
//         "for centuries.\n\n" +
//         "Solve the math puzzles\n" +
//         "to prove your worth\n" +
//         "and pass the bridge.", 
//         { fontSize: '16px', color: '#333', fontFamily: 'serif', align: 'center', wordWrap: { width: 240 } }
//     ).setOrigin(0.5);

//     // Add everything to main container
//     this.bookUI.add([overlay, cover, leftPage, rightPage, spine, title, bodyText, closeBtn]);
//     this.bookUI.setScrollFactor(0); // Keep it fixed on screen
// }
// public toggleBook() {
//     this.isBookOpen = !this.isBookOpen;
    
//     // Block character movement while reading
//     // (Assuming you have this.isBlocked logic from previous code)
//     this.obstacleBlocked = this.isBookOpen; 

//     this.tweens.add({
//         targets: this.bookUI,
//         alpha: this.isBookOpen ? 1 : 0,
//         scale: this.isBookOpen ? 1 : 0.5,
//         duration: 300,
//         ease: 'Back.easeOut'
//     });
// }

// private createBookIcon() {
//     const iconBtn = this.add.container(50, 50).setScrollFactor(0).setDepth(90);
//     const bg = this.add.circle(0, 0, 25, 0xd4a017).setStrokeStyle(3, 0xffffff);
//     const emoji = this.add.text(0, 0, '📖', { fontSize: '28px' }).setOrigin(0.5);
    
//     iconBtn.add([bg, emoji]);
//     iconBtn.setInteractive(new Phaser.Geom.Circle(0, 0, 25), Phaser.Geom.Circle.Contains);
    
//     iconBtn.on('pointerdown', () => {
//         this.toggleBook();
//         // Visual feedback
//         this.tweens.add({ targets: iconBtn, scale: 0.8, duration: 100, yoyo: true });
//     });
// }
// }

// ─────────────────────────────────────────────────────────────
//  MathQuest · src/lib/phaser/Zone1Scene.ts  — Zone 1 "Pebble Shore"
//  v3.0 — MAJOR OVERHAUL
//
//  Changes from v2:
//    ✅ REMOVED: jumpable hazards (crabs/seagulls)
//    ✅ ADDED:   floating platforms (Mario-style multi-level walking areas)
//    ✅ ADDED:   stars placed ON + ABOVE platforms, reachable only by jumping
//    ✅ ADDED:   stars now track coins collected (1 star = 1 coin solved)
//    ✅ ADDED:   end-of-zone STAR REWARD SCREEN — animated, child-friendly
//    ✅ ADDED:   interactive instructions panel (animated, encouraging)
//    ✅ UPGRADED: companion is now a glowing magical seahorse 🦄🌊
//               - flies around the player with gentle figure-8 motion
//               - reacts with big emotions to correct/wrong answers
//               - has a name: "Coral"
//    ✅ UPGRADED: boss now throws bouncing bubble projectiles at player
//               - projectiles arc and bounce on ground
//               - player flash-dodges through them (visual only, no health loss)
//               - boss eye tracks player X position
//               - boss roars (shake) before each attack
//
//  Design rules upheld:
//    • Stars = coins = math victories. No cosmetic bypass.
//    • Companion encourages, never hints.
//    • Platforms add traversal joy without bypassing any gate.
//    • Wrong-answer: neutral flash, never shame.
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
//  MathQuest · src/lib/phaser/Zone1Scene.ts  — Zone 1 "Pebble Shore"
//  v3.0 — MAJOR OVERHAUL
//
//  Changes from v2:
//    ✅ REMOVED: jumpable hazards (crabs/seagulls)
//    ✅ ADDED:   floating platforms (Mario-style multi-level walking areas)
//    ✅ ADDED:   stars placed ON + ABOVE platforms, reachable only by jumping
//    ✅ ADDED:   stars now track coins collected (1 star = 1 coin solved)
//    ✅ ADDED:   end-of-zone STAR REWARD SCREEN — animated, child-friendly
//    ✅ ADDED:   interactive instructions panel (animated, encouraging)
//    ✅ UPGRADED: companion is now a glowing magical seahorse 🦄🌊
//               - flies around the player with gentle figure-8 motion
//               - reacts with big emotions to correct/wrong answers
//               - has a name: "Coral"
//    ✅ UPGRADED: boss now throws bouncing bubble projectiles at player
//               - projectiles arc and bounce on ground
//               - player flash-dodges through them (visual only, no health loss)
//               - boss eye tracks player X position
//               - boss roars (shake) before each attack
//
//  Design rules upheld:
//    • Stars = coins = math victories. No cosmetic bypass.
//    • Companion encourages, never hints.
//    • Platforms add traversal joy without bypassing any gate.
//    • Wrong-answer: neutral flash, never shame.
// ─────────────────────────────────────────────────────────────

import Phaser from 'phaser'

// Event names for communication from Phaser → React. Each event's detail object is defined in the dispatch calls below.
export const ZONE1_EVENTS = {
  SHOW_PROBLEM:  'zone1:showProblem',
  ANSWER_RESULT: 'zone1:answerResult',
  ZONE_COMPLETE: 'zone1:zoneComplete',
  BOSS_PHASE:    'zone1:bossPhase',
  PROGRESS:      'zone1:progress',
}
// Helper to dispatch events from Phaser → React. Each event has a "detail" object with relevant data for that event.
function dispatchToReact(name: string, detail: object) {
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

// ── Configuration for obstacles (problems) ─────────────────
// Each obstacle has a unique ID, associated problem ID, world X coordinate, label, emoji, color, and size.
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
  { id: 'obj3', problemId: 'Z1-OBJ-03', x: 1420, label: 'Bridge',     emoji: '🐚', color: 0x8b5e3c, width: 100, height: 60  },
  { id: 'obj4', problemId: 'Z1-OBJ-04', x: 1850, label: 'Rock',       emoji: '🪨', color: 0x7a7a7a, width: 70,  height: 64  },
  { id: 'obj5', problemId: 'Z1-OBJ-05', x: 2280, label: 'Crabs',      emoji: '🦀', color: 0xe85c2a, width: 80,  height: 50  },
  { id: 'obj6', problemId: 'Z1-OBJ-06', x: 2720, label: 'Stones',     emoji: '🪸', color: 0x3b82f6, width: 90,  height: 40  },
  { id: 'obj7', problemId: 'Z1-OBJ-07', x: 3160, label: 'Pelican',    emoji: '🐙', color: 0xdeb887, width: 60,  height: 70  },
  { id: 'obj8', problemId: 'Z1-OBJ-08', x: 3600, label: 'Lighthouse', emoji: '🦞', color: 0xcccccc, width: 50,  height: 120 },
]

// ── Configuration for world dimensions and key coordinates ─────
// BOSS_X is the X coordinate where the boss encounter takes place, near the end of the zone.
const BOSS_X         = 4200
// WORLD_WIDTH is the total width of the game world, which is larger than the screen width to allow for side-scrolling.
const WORLD_WIDTH    = 4800
// GROUND_Y is the Y coordinate of the ground level, calculated as a ratio of the screen height. This allows for responsive design across different screen sizes.
const GROUND_Y_RATIO = 0.78

// ── Floating platforms ────────────────────────────────────────
// Each platform has x, y (world coords), width, and optional bobAmount
// Platforms are placed in gaps between obstacles, with varying heights (yRatio) and widths. Some have a "bob" property for vertical bobbing animation, and some have decorative emojis on top.
interface PlatformConfig {
  x: number       // center X in world
  yRatio: number  // fraction of screenH (e.g. 0.55 = halfway up)
  width: number
  bob?: number    // vertical bob amplitude in px (default 0)
  emoji?: string  // decorative emoji on top
}

// Platforms placed ONLY in gaps between obstacles.
// Obstacle Xs: 600, 1000, 1420, 1850, 2280, 2720, 3160, 3600
// yRatio: ground is 0.78. Jump velocity -14 reaches ~0.62 max.
// ALL platforms capped at yRatio 0.65 so every one is reachable.

const PLATFORMS: PlatformConfig[] = [
  // Before obj1 (600)
  { x: 320,  yRatio: 0.68, width: 120, bob: 4,  emoji: '🌿' },
  // Between obj1 (600) and obj2 (1000)
  { x: 780,  yRatio: 0.65, width: 130, bob: 4,  emoji: '🌺' },
  // Between obj2 (1000) and obj3 (1420)
  { x: 1210, yRatio: 0.66, width: 120, bob: 4,  emoji: '🍄' },
  // Between obj3 (1420) and obj4 (1850)
  { x: 1630, yRatio: 0.64, width: 130, bob: 4  },
  // Between obj4 (1850) and obj5 (2280)
  { x: 2060, yRatio: 0.67, width: 120, bob: 4,  emoji: '🌸' },
  // Between obj5 (2280) and obj6 (2720)
  { x: 2490, yRatio: 0.65, width: 140, bob: 4  },
  // Between obj6 (2720) and obj7 (3160)
  { x: 2930, yRatio: 0.63, width: 130, bob: 4,  emoji: '🌿' },
  // Between obj7 (3160) and obj8 (3600)
  { x: 3370, yRatio: 0.66, width: 120, bob: 4,  emoji: '🌺' },
  // Between obj8 (3600) and boss (4200)
  { x: 3810, yRatio: 0.64, width: 130, bob: 4  },
  { x: 4010, yRatio: 0.68, width: 110, bob: 4,  emoji: '🍄' },
]

// ── Stars (now tied to coins = math wins) ─────────────────────
// Stars are placed on platforms or above them — reachable only by jumping.
// Total = 12 (one per obstacle solved, that's the earned count)
// They exist in world but only "award" when player collects them;
// the end-screen shows earned stars = solvedCount.
// Stars just above their platforms — all reachable by jumping from platform top
const STAR_POSITIONS: { x: number; yRatio: number }[] = [
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
  { x: 450,  yRatio: 0.70 },  // ground-level bonus near start
  { x: 900,  yRatio: 0.72 },  // ground-level bonus
]

// Companion messages for various moments — Gary the Snail
const COMPANION_MESSAGES = {
  start:        ["Meow! I'm Gary! 🐌", "Let's go! ✨", "You can do it! 💪"],
  approach:     ["Ooh, a puzzle! 🧩", "Solve it! 🧠", "You've got this! ⚡"],
  correct:      ["MEOW!! 🎉", "BRILLIANT! 🌟", "You're a STAR! ⭐", "Math genius! 🧠✨"],
  wrong:        ["Try again! 💪", "So close! Keep going!", "You can do it! 🌈"],
  jump:         ["Wheee! 🌀", "So high! 🌤️", "Woo-hoo! 🐌"],
  bossNear:     ["The Sentinel! 👀", "Stay brave! ⚔️", "I believe in you! 💖"],
  starCollect:  ["A star! ⭐", "Shiny! ✨", "Collect them all! 🌟"],
  idle:         ["I'm hungry... 🥫", "Are we there yet? 🐌", "Meoooow! 💭"],
}


export class Zone1Scene extends Phaser.Scene {
  // ── Dimensions ─────────────────────────────────────────────
  // These will be set in create() based on actual screen size for responsive design
  private worldWidth!: number
  private groundY!: number
  private screenW!: number
  private screenH!: number

  // ── Player ─────────────────────────────────────────────────
  // Player properties for movement, state, and animation. The player is represented as a container with rectangles for body and legs. Movement is handled with velocity and gravity, and the player can jump and run.
  private player!: Phaser.GameObjects.Container
  private playerVelX      = 0
  private playerVelY      = 0
  private playerOnGround  = true
  private playerX         = 120
  private playerY         = 0
  private facingRight     = true
  private isRunning       = false
  private legL!: Phaser.GameObjects.Rectangle
  private legR!: Phaser.GameObjects.Rectangle
  private legTimer        = 0

  // ── Blocking flags ─────────────────────────────────────────
  // These flags control whether the player can move, based on whether they are currently interacting with an obstacle or the boss. When either flag is true, player movement is blocked.
  private obstacleBlocked = false
  private bossBlocked     = false
  // isBlocked is true if either obstacleBlocked or bossBlocked is true, meaning player movement should be blocked in either case.
  private get isBlocked() { return this.obstacleBlocked || this.bossBlocked }

  // ── Cooldown flags ─────────────────────────────────────────
  // These flags are used to prevent rapid re-triggering of obstacle interactions and boss phase changes. After an interaction occurs, the corresponding cooldown flag is set to true for a short duration, during which further interactions of that type are ignored.
  private obsCooldown        = false
  private interPhaseCooldown = false

  // ── Input ──────────────────────────────────────────────────
  // Keyboard input objects for controlling the player. Cursors is a built-in Phaser object for arrow keys, while keyA, keyD, keyW, and keySpace are custom keys for WASD controls and jumping.
  // For touch input, we have boolean flags that are set when the player interacts with on-screen touch controls for moving left, right, or jumping. These will be used in the update loop to determine player movement based on touch input.
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keyA!: Phaser.Input.Keyboard.Key
  private keyD!: Phaser.Input.Keyboard.Key
  private keyW!: Phaser.Input.Keyboard.Key
  private keySpace!: Phaser.Input.Keyboard.Key

  // ── Touch ─────────────────────────────────────────────────
  // Touch input flags for on-screen controls. These will be set to true when the player is touching the corresponding control (left, right, jump) and will be used in the update loop to determine player movement based on touch input.
  public touchLeft  = false
  public touchRight = false
  public touchJump  = false

  // ── Obstacle state ─────────────────────────────────────────
  // obstacleObjects maps each obstacle ID to its corresponding game object container, configuration, and solved state. This allows us to track which obstacles have been solved and manage their interactions.
  private obstacleObjects: Map<string, {
    container: Phaser.GameObjects.Container
    config: ObstacleConfig
    solved: boolean
  }> = new Map()
  private solvedCount  = 0
  private activeObsId: string | null = null

  // ── Boss state ─────────────────────────────────────────────
  // The boss is represented as a container with rectangles for body and eyes. We track the current phase of the boss fight, the boss's HP represented as rectangles, and the positions of the boss's eyes and pupils for tracking the player.
  private bossContainer!: Phaser.GameObjects.Container
  private bossPhase        = 0
  private activeBossPhase  = 0
  private bossHP: Phaser.GameObjects.Rectangle[] = []
  private bossEyeL!: Phaser.GameObjects.Arc
  private bossEyeR!: Phaser.GameObjects.Arc
  private bossPupilL!: Phaser.GameObjects.Arc
  private bossPupilR!: Phaser.GameObjects.Arc

  // ── Boss attack system ─────────────────────────────────────
  //الشغلات الي يرميها البوس لما نقرب منو زي حجار او قنابل او غيرها
  // bossProjectiles is an array of active projectiles thrown by the boss. Each projectile has a game object, velocity, and bounce count for handling its movement and interactions in the game world.
  private bossProjectiles: {
    obj: Phaser.GameObjects.Text
    velX: number
    velY: number
    bounces: number
  }[] = []
  private bossAttackTimer    = 0
  private bossAttackInterval = 2600

  // ── Companion — Coral the Seahorse ────────────────────────
  // The companion is a friendly character that follows the player around and reacts to their actions. Coral is represented as a container with a body and speech bubble. We track Coral's position, target position for smooth movement, emotional reactions with tweens, and idle chatter timer.
  private companion!: Phaser.GameObjects.Container
  private companionX        = 80
  private companionTargetX  = 80
  private companionOffsetY  = 0
  private companionTime     = 0
  private companionEmoteTween: Phaser.Tweens.Tween | null = null
  private companionSpeechBubble!: Phaser.GameObjects.Container
  private companionSpeechText!: Phaser.GameObjects.Text
  private companionIdleTimer = 0
  private companionBody!: Phaser.GameObjects.Text

  // ── Platforms ─────────────────────────────────────────────
  // platformObjects is an array of floating platforms in the game world. Each platform has a container for its game objects, world coordinates, width, and properties for vertical bobbing animation. These platforms provide additional traversal options for the player and are placed strategically between obstacles.
  private platformObjects: {
    container: Phaser.GameObjects.Container
    worldX: number
    baseY: number
    width: number
    bob: number
    bobTime: number
  }[] = []

  // ── Stars (collectible, earned = solvedCount) ──────────────
  // starObjects is an array of collectible stars placed in the game world. Each star has a game object, world coordinates, collected state, and an optional glow ring for visual effect. Collecting stars is tied to solving obstacles, and the total number of stars collected is tracked for the end-of-zone reward screen. The starHUD is a container for displaying the star count on the screen, and starCountText is the text object that shows the current number of stars collected.
  private starObjects: {
    obj: Phaser.GameObjects.Text
    x: number
    y: number
    collected: boolean
    glowRing?: Phaser.GameObjects.Arc
  }[] = []
  private starsCollected = 0
  private starHUD!: Phaser.GameObjects.Container
  private starCountText!: Phaser.GameObjects.Text

  // ── Instructions panel ─────────────────────────────────────
  private instructionsShown = false

  // ── Environment ────────────────────────────────────────────
  // Arrays for environmental elements like waves, which are visual effects in the game world. The waveTimer is used to control the animation of the waves over time.
  private waves: Phaser.GameObjects.Rectangle[] = []
  private waveTimer = 0

  // ── Cleanup ────────────────────────────────────────────────
  // answerListener is a reference to the event listener function for handling answer results from React. This allows us to remove the event listener when the scene is shut down to prevent memory leaks and unintended behavior.
  private answerListener!: (e: Event) => void

  constructor() { super({ key: 'Zone1Scene' }) }
  preload() {}

  // ═══════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════

  create() {
    // Set dimensions based on actual screen size for responsive design
    this.screenW    = this.scale.width //عرض الشاشة
    this.screenH    = this.scale.height //ارتفاع الشاشة
    this.worldWidth = WORLD_WIDTH //عرض العالم الافتراضي (أكبر من عرض الشاشة للسماح بالتمرير الجانبي)
    this.groundY    = this.screenH * GROUND_Y_RATIO //مستوى الأرض كنسبة من ارتفاع الشاشة (مثلاً 0.78 يعني 78% من ارتفاع الشاشة)
    this.playerY    = this.groundY - 40 //موقع اللاعب الرأسي يبدأ فوق الأرض بقليل (40 بكسل في هذا المثال)
    ;(window as any).__zone1Scene = this // Expose scene instance for debugging and external calls from React (e.g. safeDestroy)

    // Render order: sky → sea → ground → platforms → stars → obstacles → boss → player → companion → HUD
    this.createSky()
    this.createSun()
    this.createClouds()
    this.createSea()
    this.createGround()
    this.createZoneSign()
    this.createPlatforms()
    this.createStars()
    this.createObstacles()
    this.createBoss()
    this.createBirds()
    this.createPlayer()
    this.createCompanion()
    this.createStarHUD()

    // Set up input handlers for keyboard controls. Cursors is a built-in Phaser object for arrow keys, while keyA, keyD, keyW, and keySpace are custom keys for WASD controls and jumping.
    this.cursors  = this.input.keyboard!.createCursorKeys()
    this.keyA     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.keyD     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    this.keyW     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W)
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    // Set up event listener for answer results from React. When an answer result event is received, the handleAnswerResult method will be called with the correctness and obstacle ID from the event detail.
    this.answerListener = (e: Event) => {
      const { correct, obstacleId } = (e as CustomEvent).detail
      this.handleAnswerResult(correct, obstacleId)
    }
    window.addEventListener(ZONE1_EVENTS.ANSWER_RESULT, this.answerListener)
// Set up camera to follow the player with smooth scrolling and bounds to prevent showing areas outside the world. The camera will follow the player's movement, keeping them centered on the screen while allowing for a smooth transition.
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.screenH)
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08)

    // Show instructions after a short delay
    this.time.delayedCall(800, () => this.showInstructions())

    this.time.delayedCall(200, () =>
      dispatchToReact(ZONE1_EVENTS.PROGRESS, { solved: 0, total: 8 })
    )

    // Companion idle chatter
    this.time.delayedCall(5000, () => this.startCompanionIdleChatter())
  }

  // ═══════════════════════════════════════════════════════════
  // SHUTDOWN & SAFE DESTROY
  // ═══════════════════════════════════════════════════════════  
  shutdown() {
    window.removeEventListener(ZONE1_EVENTS.ANSWER_RESULT, this.answerListener)
    ;(window as any).__zone1Scene = null
    // Remove DOM instructions overlay if still present
    const el = document.getElementById('mq-instructions')
    if (el && el.parentNode) el.parentNode.removeChild(el)
  }

  // Called by React if it needs to tear down Phaser from outside
  // (e.g. user navigates away before zone completes).
  // Safe to call even if game.destroy() was already called above.
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

    // ── Use a DOM overlay so text is guaranteed crisp & opaque ─
    // Phaser Graphics alpha + container alpha compound in ways that
    // make text invisible on some renderers. DOM has no such issue.
    const overlay = document.createElement('div')
    overlay.id = 'mq-instructions'
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,5,20,0.88);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Nunito', 'Segoe UI', sans-serif;
    `

    overlay.innerHTML = `
      <div style="
        background: #0d2a4a;
        border: 3px solid #00e5ff;
        border-radius: 20px;
        padding: 28px 32px;
        max-width: 560px; width: 92vw;
        box-shadow: 0 0 40px rgba(0,229,255,0.2);
        position: relative;
      ">
        <div style="
          position: absolute; top: 0; left: 0; right: 0; height: 60px;
          background: #0a4a6a; border-radius: 17px 17px 0 0;
        "></div>

        <h2 style="
          position: relative; text-align: center; margin: 0 0 22px 0;
          font-size: 22px; font-weight: 900; color: #00e5ff;
          text-shadow: 0 0 12px rgba(0,229,255,0.6);
        ">🌊 HOW TO PLAY 🌊</h2>

        <table style="width:100%; border-collapse: collapse; position: relative;">
          ${[
            ['⬅️ ➡️',  'Arrow keys or A / D',  'to walk'],
            ['⬆️',      'Up arrow or Space',     'to jump onto platforms'],
            ['🧩',      'Walk into obstacles',   'to get a math puzzle'],
            ['✅',      'Solve the puzzle',      'earn a coin &amp; walk on'],
            ['⭐',      'Collect stars',         'by jumping to platforms'],
            ['🐌',      'Gary the Snail',        'cheers you on!'],
            ['👑',      'Defeat the boss',       'to complete the zone!'],
          ].map(([icon, bold, rest], i, arr) => `
            <tr style="border-bottom: ${i < arr.length - 1 ? '1px solid rgba(0,229,255,0.1)' : 'none'}">
              <td style="padding: 9px 10px 9px 0; font-size: 20px; width: 42px;">${icon}</td>
              <td style="padding: 9px 8px; font-size: 14px; font-weight: 800; color: #ffd700; white-space: nowrap;">${bold}</td>
              <td style="padding: 9px 0; font-size: 14px; color: #e0f4ff;">${rest}</td>
            </tr>
          `).join('')}
        </table>

        <p style="
          text-align: center; margin: 18px 0 6px 0;
          font-size: 14px; font-weight: 800; color: #ffd700;
        ">💡 Every math coin you earn = 1 ⭐ Star at the end!</p>

        <p id="mq-tap-hint" style="
          text-align: center; margin: 0;
          font-size: 13px; color: #ffffff; opacity: 0.9;
        ">— Tap anywhere to begin! —</p>
      </div>
    `

    document.body.appendChild(overlay)

    // Pulsing hint text 
    // We want to encourage the player to tap without being too distracting, so we pulse the opacity of the hint text between 0.3 and 0.9 every 600 ms. When the overlay is closed (either by tapping or auto-closing after 14 seconds), we clear the interval to stop the pulsing.
    
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

    // Auto-close after 14 s
    setTimeout(() => { if (overlay.parentNode) close() }, 14000)
  }

  // ═══════════════════════════════════════════════════════════
  // ENVIRONMENT
  // ═══════════════════════════════════════════════════════════

  private createSky() {
    
    const rt = this.make.renderTexture({ width: this.screenW, height: this.screenH }, true)
    const gfx = this.make.graphics({ x: 0, y: 0 })
    const steps = 60
    const topColor    = new Phaser.Display.Color(11, 61, 145)
    const bottomColor = new Phaser.Display.Color(207, 239, 255)
    for (let i = 0; i < steps; i++) {
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(topColor, bottomColor, steps, i)
      gfx.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1)
      gfx.fillRect(0, (i / steps) * this.screenH, this.screenW, this.screenH / steps + 2)
    }
    rt.draw(gfx)
    gfx.destroy()
    rt.setPosition(0, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(0)
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
      puffs.forEach(([cx2, cy2, r]) => c.add(this.add.circle(cx2, cy2, r, 0xffffff, 0.9)))
      this.tweens.add({ targets: c, y: y - 6, duration: 3000 + Math.random() * 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    })
  }

  private createSea() {
    const seaHeight = 90
    const seaY = this.groundY + seaHeight / 2 - 40
    this.add.rectangle(this.screenW / 2, seaY, this.screenW, seaHeight, 0x1a7bbf).setScrollFactor(0).setDepth(1)
    const waveColors = [0x42a5f5, 0x64b5f6, 0x90caf9]
    for (let i = 0; i < 3; i++) {
      const wave = this.add.rectangle(this.screenW / 2, this.groundY + 5 + i * 6, this.screenW + 120, 10, waveColors[i], 0.7)
        .setScrollFactor(0).setDepth(2)
      this.waves.push(wave)
      this.tweens.add({ targets: wave, x: this.screenW / 2 + 25, duration: 1200 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
  }

  private createGround() {
    const groundStartY = this.groundY
    const groundH = this.screenH - groundStartY
    this.add.rectangle(this.worldWidth / 2, groundStartY + groundH / 2, this.worldWidth, groundH, 0xf5d78e).setDepth(2)
    this.add.rectangle(this.worldWidth / 2, groundStartY + 8, this.worldWidth, 16, 0xe6c46a).setDepth(2)
    const pc = [0xccbbaa, 0xaaa090, 0xdd8844, 0xcc99aa]
    for (let i = 0; i < 180; i++) {
      const px = Math.random() * this.worldWidth
      const py = groundStartY + 10 + Math.random() * 70
      const s = 2 + Math.random() * 9
      this.add.ellipse(px, py, s * 1.4, s, pc[Math.floor(Math.random() * pc.length)], 0.8).setDepth(2)
    }
    for (let i = 0; i < 28; i++) {
      const star = this.add.text(200 + Math.random() * (this.worldWidth - 400), groundStartY + 8 + Math.random() * 35, '⭐', { fontSize: `${14 + Math.random() * 8}px` })
        .setDepth(2).setOrigin(0.5)
      this.tweens.add({ targets: star, angle: 15, duration: 1800 + Math.random() * 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
    for (let i = 0; i < 35; i++) {
      this.add.text(Math.random() * this.worldWidth, groundStartY + 15 + Math.random() * 60, '🐚', { fontSize: `${12 + Math.random() * 6}px` })
        .setDepth(2).setOrigin(0.5)
    }
  }

  private createZoneSign() {
    // A welcoming sign at the start of the zone with a title and subtitle. The sign consists of a post and a board, with text for the zone name and a subtitle encouraging the player to solve puzzles. The sign animates into view with a fade-in and slight upward movement, and then has a subtle swinging animation to give it some life.
    const signX = 260
    const signY = this.groundY - 80
    const sign = this.add.container(signX, signY).setDepth(4)
    const post  = this.add.rectangle(0, 60, 10, 120, 0x8b6914)
    const board = this.add.rectangle(0, 0, 165, 72, 0xfff3cd).setStrokeStyle(4, 0x8b6914)
    const title = this.add.text(0, -14, '🌊 PEBBLE SHORE', { fontSize: '13px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold', color: '#5d4037' }).setOrigin(0.5)
    const sub   = this.add.text(0, 10, 'Zone 1 · Solve to advance!', { fontSize: '10px', fontFamily: 'Nunito, sans-serif', color: '#8d6e63' }).setOrigin(0.5)
    sign.add([post, board, title, sub])
    sign.setAlpha(0).setY(signY - 30)
    this.tweens.add({ targets: sign, alpha: 1, y: signY, duration: 700, delay: 300, ease: 'Back.easeOut' })
    this.tweens.add({ targets: sign, angle: 2, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  // ═══════════════════════════════════════════════════════════
  // PLATFORMS — Multi-level Mario-style
  // ═══════════════════════════════════════════════════════════

  private createPlatforms() {
    PLATFORMS.forEach((cfg, idx) => {
      const baseY   = this.screenH * cfg.yRatio
      const bobAmt  = cfg.bob ?? 0
      const container = this.add.container(cfg.x, baseY).setDepth(3)

      // Platform body — layered for a chunky island-rock look
      const shadow = this.add.ellipse(2, 10, cfg.width + 10, 18, 0x000000, 0.15)
      const base   = this.add.rectangle(0, 0, cfg.width, 22, 0x8b6914)  // dark soil
      const top    = this.add.rectangle(0, -6, cfg.width, 14, 0x5dbb5d)  // green top
      const highlight = this.add.rectangle(-cfg.width / 4, -10, cfg.width / 2, 4, 0x7dd87d, 0.5) // lighter strip

      // Underside stalactite detail
      for (let d = 0; d < 3; d++) {
        const dripX = -cfg.width / 3 + d * (cfg.width / 3)
        const drip = this.add.rectangle(dripX, 14, 8, 12 + Math.random() * 8, 0x7a5c1e)
        container.add(drip)
      }

      container.add([shadow, base, top, highlight])

      // Emoji decoration on top
      if (cfg.emoji) {
        const deco = this.add.text(0, -22, cfg.emoji, { fontSize: '18px' }).setOrigin(0.5)
        this.tweens.add({ targets: deco, y: -28, duration: 1200 + idx * 80, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        container.add(deco)
      }

      // Bob tween
      // If bobAmt is greater than 0, we add a tween to the platform container that animates its y position up and down by bobAmt pixels. The duration of the tween is 2000 ms plus an additional 300 ms for each platform index, creating a staggered bobbing effect. The tween yoyo's back and forth and repeats indefinitely, using a sine ease for smooth motion.
      if (bobAmt > 0) {
        this.tweens.add({
          targets: container,
          y: baseY + bobAmt,
          duration: 2000 + idx * 300,
          yoyo: true, repeat: -1,
          ease: 'Sine.easeInOut',
        })
      }

      this.platformObjects.push({
        container,
        worldX: cfg.x,
        baseY,
        width: cfg.width,
        bob: bobAmt,
        bobTime: 0,
      })
    })
  }

  // ═══════════════════════════════════════════════════════════
  // STARS — Placed above platforms, collected by jumping
  // ═══════════════════════════════════════════════════════════

  private createStars() {
    STAR_POSITIONS.forEach(({ x, yRatio }) => {
      const worldY = this.screenH * yRatio
      // Outer glow ring
      const glowRing = this.add.circle(x, worldY, 18, 0xffd700, 0.18).setDepth(5)
      // Star emoji
      const star = this.add.text(x, worldY, '⭐', { fontSize: '26px' }).setOrigin(0.5).setDepth(6)
      // Bob
      this.tweens.add({ targets: star, y: worldY - 10, duration: 700 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      // Glow pulse
      this.tweens.add({ targets: glowRing, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 1000 + Math.random() * 500, yoyo: false, repeat: -1, ease: 'Quad.easeOut' })

      this.starObjects.push({ obj: star, x, y: worldY, collected: false, glowRing })
    })
  }

  private createStarHUD() {
    this.starHUD = this.add.container(this.screenW - 100, 18).setScrollFactor(0).setDepth(100)
    const bg = this.add.graphics()
    bg.fillStyle(0x000a1a, 0.55)
    bg.fillRoundedRect(-50, -16, 100, 32, 10)
    bg.lineStyle(2, 0xffd700, 0.6)
    bg.strokeRoundedRect(-50, -16, 100, 32, 10)
    const icon = this.add.text(-32, 0, '⭐', { fontSize: '18px' }).setOrigin(0.5)
    this.starCountText = this.add.text(4, 0, `0 / ${STAR_POSITIONS.length}`, {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold', color: '#ffd700',
    }).setOrigin(0.5)
    this.starHUD.add([bg, icon, this.starCountText])
  }

  // ═══════════════════════════════════════════════════════════
  // PLAYER
  // ═══════════════════════════════════════════════════════════

  private createPlayer() {
    this.player = this.add.container(this.playerX, this.playerY).setDepth(10)

    // ── Shadow ────────────────────────────────────────────────
    const shadow = this.add.ellipse(0, 34, 46, 12, 0x000000, 0.2)

    // ── Legs (drawn first so body overlaps) ───────────────────
    this.legL = this.add.rectangle(-11, 26, 12, 20, 0x6d28d9)
    this.legR = this.add.rectangle( 11, 26, 12, 20, 0x6d28d9)
    // Sneakers
    const shoeL = this.add.ellipse(-13, 38, 20, 10, 0xfbbf24)
    const shoeR = this.add.ellipse( 13, 38, 20, 10, 0xfbbf24)
    // Shoe highlights
    const shoeHL = this.add.ellipse(-16, 35, 8, 5, 0xfde68a, 0.6)
    const shoeHR = this.add.ellipse( 10, 35, 8, 5, 0xfde68a, 0.6)

    // ── Body — rounded rectangle feel with layers ─────────────
    const body     = this.add.rectangle(0, 4, 40, 46, 0x7c3aed)
    const bodyHL   = this.add.rectangle(-8, -2, 12, 36, 0x8b5cf6, 0.5) // highlight stripe
    const bodyEdge = this.add.rectangle(0, 4, 40, 46, 0x5b21b6, 0)     // stroke trick

    // ── Belt ──────────────────────────────────────────────────
    const belt   = this.add.rectangle(0, 16, 40, 6, 0x1e1b4b)
    const buckle = this.add.rectangle(0, 16, 10, 5, 0xfbbf24)

    // ── Cape / scarf ─────────────────────────────────────────
    const cape = this.add.triangle(-4, -14, -18, 0, 4, -30, 10, 10, 0xa78bfa, 0.85)

    // ── Arms ─────────────────────────────────────────────────
    const armL = this.add.rectangle(-24, 6, 10, 24, 0x7c3aed)
    const armR = this.add.rectangle( 24, 6, 10, 24, 0x7c3aed)
    // Gloves
    const gloveL = this.add.circle(-24, 20, 7, 0xfbbf24)
    const gloveR = this.add.circle( 24, 20, 7, 0xfbbf24)

    // ── Neck ──────────────────────────────────────────────────
    const neck = this.add.rectangle(0, -16, 16, 10, 0xc4b5fd)

    // ── Head — round & expressive ─────────────────────────────
    const head   = this.add.circle(0, -32, 22, 0xc4b5fd)
    const headHL = this.add.ellipse(-6, -40, 12, 8, 0xddd6fe, 0.5)

    // ── Eyes ─────────────────────────────────────────────────
    const eyeLW  = this.add.ellipse(-8, -35, 13, 15, 0xffffff)
    const eyeRW  = this.add.ellipse( 8, -35, 13, 15, 0xffffff)
    const eyeLP  = this.add.circle(-8, -34, 5, 0x1e1b4b)
    const eyeRP  = this.add.circle( 8, -34, 5, 0x1e1b4b)
    const eyeLG  = this.add.circle(-6, -37, 2, 0xffffff)
    const eyeRG  = this.add.circle(10, -37, 2, 0xffffff)

    // ── Eyebrows — expressive arcs via rectangles ─────────────
    const browL = this.add.rectangle(-9, -46, 12, 3, 0x4c1d95).setAngle(-8)
    const browR = this.add.rectangle( 9, -46, 12, 3, 0x4c1d95).setAngle(8)

    // ── Nose ─────────────────────────────────────────────────
    const nose = this.add.circle(0, -29, 3, 0xa78bfa)

    // ── Smile ─────────────────────────────────────────────────
    const smile = this.add.arc(0, -23, 9, 0, 180, false, 0x4c1d95)

    // ── Antenna / horn (fun detail) ───────────────────────────
    const antennaStick = this.add.rectangle(8, -53, 3, 12, 0x7c3aed)
    const antennaBall  = this.add.circle(8, -60, 5, 0xfbbf24)

    this.player.add([
      shadow,
      this.legL, this.legR, shoeL, shoeR, shoeHL, shoeHR,
      body, bodyHL, belt, buckle,
      cape, armL, armR, gloveL, gloveR,
      neck, head, headHL,
      eyeLW, eyeRW, eyeLP, eyeRP, eyeLG, eyeRG,
      browL, browR, nose, smile,
      antennaStick, antennaBall,
    ])

    // Gentle idle bob

    this.tweens.add({
      targets: this.player, y: this.playerY - 5,
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
  }

  // ═══════════════════════════════════════════════════════════
  // COMPANION — Gary the Snail 🐌
  // ═══════════════════════════════════════════════════════════

  private createCompanion() {
    this.companion = this.add.container(this.companionX, this.groundY - 24).setDepth(9)

    // ── Shell (spiral pink/purple) ────────────────────────────
    const shellOuter = this.add.circle(4, -14, 16, 0xc084fc)           // purple outer
    const shellMid   = this.add.circle(4, -14, 11, 0xe879f9)           // lighter mid
    const shellInner = this.add.circle(4, -14,  6, 0xf0abfc)           // lightest core
    const shellDot   = this.add.circle(4, -14,  2, 0xfae8ff)           // highlight dot
    // Shell spiral line (simulated with a thin arc)
    const shellSpiral = this.add.arc(4, -14, 9, 30, 200, false, 0xa855f7, 0.5)

    // ── Body (grey blob) ──────────────────────────────────────
    const bodyBase = this.add.ellipse(-2, 6, 38, 20, 0x9ca3af)         // main body
    const bodyHighlight = this.add.ellipse(-6, 2, 14, 8, 0xd1d5db, 0.6) // highlight

    // ── Head / neck ───────────────────────────────────────────
    const neck = this.add.ellipse(-10, -4, 12, 18, 0x9ca3af)
    const headBlob = this.add.ellipse(-14, -14, 18, 16, 0x9ca3af)
    const headHighlight = this.add.ellipse(-18, -18, 7, 5, 0xd1d5db, 0.5)

    // ── Eyestalks ─────────────────────────────────────────────
    const stalkL = this.add.rectangle(-18, -22, 3, 10, 0x9ca3af)
    const stalkR = this.add.rectangle(-11, -22, 3, 10, 0x9ca3af)
    const eyeL   = this.add.circle(-18, -28, 5, 0xffffff)
    const eyeR   = this.add.circle(-11, -28, 5, 0xffffff)
    const pupilL = this.add.circle(-18, -28, 3, 0x1e293b)
    const pupilR = this.add.circle(-11, -28, 3, 0x1e293b)
    const glintL = this.add.circle(-17, -30, 1, 0xffffff)
    const glintR = this.add.circle(-10, -30, 1, 0xffffff)

    // ── Mouth ─────────────────────────────────────────────────
    const mouth = this.add.arc(-14, -10, 4, 0, 180, false, 0x6b7280)

    // ── Trail slime dots ─────────────────────────────────────
    for (let t = 0; t < 3; t++) {
      const slime = this.add.circle(14 + t * 10, 10, 3 - t * 0.5, 0x86efac, 0.5)
      this.companion.add(slime)
    }

    this.companion.add([
      bodyBase, bodyHighlight,
      neck, headBlob, headHighlight,
      shellOuter, shellMid, shellInner, shellDot, shellSpiral,
      stalkL, stalkR, eyeL, eyeR, pupilL, pupilR, glintL, glintR,
      mouth,
    ])

    // ── Eye-stalk wobble ──────────────────────────────────────
    this.tweens.add({ targets: stalkL, y: stalkL.y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: stalkR, y: stalkR.y - 3, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    // ── Speech bubble — kept in a SEPARATE world-space container
    //    so we can counter-scale it and prevent text from flipping ──
    this.companionSpeechBubble = this.add.container(0, 0).setDepth(11).setAlpha(0)

    const bubbleBg = this.add.graphics()
    bubbleBg.fillStyle(0xffffff, 0.95)
    bubbleBg.fillRoundedRect(0, -28, 110, 28, 8)
    bubbleBg.lineStyle(2, 0x9ca3af, 0.8)
    bubbleBg.strokeRoundedRect(0, -28, 110, 28, 8)
    // Bubble pointer triangle (points down-left toward Gary)
    bubbleBg.fillStyle(0xffffff, 0.95)
    bubbleBg.fillTriangle(8, 0, 0, 10, 20, 0)

    this.companionSpeechText = this.add.text(55, -14, '', {
      fontSize: '11px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#1e293b',
    }).setOrigin(0.5)

    this.companionSpeechBubble.add([bubbleBg, this.companionSpeechText])

    this.companionX       = this.playerX - 55
    this.companionTargetX = this.companionX
  }

  private companionSay(msg: string, durationMs = 2000) {
    if (!this.companionSpeechText) return
    this.companionSpeechText.setText(msg)
    if (this.companionEmoteTween) {
      this.companionEmoteTween.stop()
      this.companionEmoteTween = null
    }
    this.companionSpeechBubble.setAlpha(1)
    this.companionEmoteTween = this.tweens.add({
      targets: this.companionSpeechBubble, alpha: 0, duration: 350, delay: durationMs, ease: 'Quad.easeIn',
    })
  }

  // When the player gets something right, Gary does a happy hop and says an encouraging message. The hop is implemented as a tween that moves Gary's y position up by 40 pixels and then back down, while also briefly scaling him up to make the reaction more dynamic. The message is randomly selected from a set of "correct" responses to keep it varied, and a burst of golden slime particles is emitted to add some celebratory flair.
  private companionReactCorrect() {
    // Gary does an excited hop
    const currentY = this.companion.y
    this.tweens.add({
      targets: this.companion, y: currentY - 40,
      duration: 200, yoyo: true, ease: 'Quad.easeOut',
    })
    this.tweens.add({
      targets: this.companion, scaleX: this.companion.scaleX * 1.3, scaleY: 1.3,
      duration: 120, yoyo: true, ease: 'Back.easeOut',
    })
    this.companionSay(this.pick(COMPANION_MESSAGES.correct), 2200)
    this.spawnCompanionBurst(0xffd700)
  }
// When the player gets something wrong, Gary does a quick shake and says a consoling message. The shake is implemented as a tween that moves Gary's x position back and forth by 10 pixels, repeating a few times to create a noticeable but not too jarring effect. The message is randomly selected from a set of "wrong" responses to keep it fresh.
  private companionReactWrong() {
    const cx = this.companion.x
    this.tweens.add({ targets: this.companion, x: cx + 10, duration: 60, yoyo: true, repeat: 3, ease: 'Linear',
      onComplete: () => this.companion.setX(cx) })
    this.companionSay(this.pick(COMPANION_MESSAGES.wrong), 2000)
  }

  // Gary does a sad shrink and emits a burst of blue slime when the player gets something wrong. The burst consists of 8 small circles that shoot out in a radial pattern from Gary's position, fading and shrinking as they move outward. The circles are colored a bright cyan to contrast with the sad emotion, and they add a bit of visual feedback to reinforce the reaction.
  private spawnCompanionBurst(color: number) {
    const cam = this.cameras.main
    const sx = this.companionX - cam.scrollX
    const sy = (this.companion.y - cam.scrollY) - 10
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const dot = this.add.circle(sx, sy, 5, color).setScrollFactor(0).setDepth(60)
      this.tweens.add({
        targets: dot,
        x: sx + Math.cos(angle) * 50,
        y: sy + Math.sin(angle) * 50,
        alpha: 0, scaleX: 0, scaleY: 0,
        duration: 500, ease: 'Quad.easeOut',
        onComplete: () => dot.destroy(),
      })
    }
  }

  // Gary occasionally says idle chatter when the player is not interacting with him. This is implemented as a looped delayed call that checks if Gary is currently blocked (e.g., mid-reaction) or if the boss is active, and if not, it randomly selects an idle message for Gary to say. The messages are displayed in his speech bubble for a few seconds before fading out, and the loop continues indefinitely with a random delay between each message to keep it feeling natural.
  private startCompanionIdleChatter() {
    const chatLoop = () => {
      if (!this.isBlocked && !this.bossBlocked) {
        // Only say idle things if not already saying something
        if (this.companionSpeechBubble.alpha < 0.1) {
          this.companionSay(this.pick(COMPANION_MESSAGES.idle), 2500)
        }
      }
      this.time.delayedCall(8000 + Math.random() * 6000, chatLoop)
    }
    this.time.delayedCall(8000, chatLoop)
  }

  // ═══════════════════════════════════════════════════════════
  // OBSTACLES
  // ═══════════════════════════════════════════════════════════
// Obstacles are represented as containers with an emoji icon and a warning ring. The warning ring is a circle that starts with a certain radius and alpha, and then animates to grow larger and fade out repeatedly to create a pulsating effect. Each obstacle is stored in a map with its configuration and solved state, allowing the game to track which obstacles have been interacted with and whether they have been solved or not.
  private createObstacles() {
    OBSTACLES.forEach(cfg => {
      const container = this.add.container(cfg.x, this.groundY - cfg.height / 2).setDepth(5)
      const icon = this.add.text(0, 0, cfg.emoji, { fontSize: '100px' }).setOrigin(0.5)
      // Warning ring
      const warnRing = this.add.circle(0, 0, 70, 0xffd700, 0).setStrokeStyle(3, 0xffd700, 0)
      this.tweens.add({ targets: icon, y: -12, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      container.add([warnRing, icon])
      ;(container as any)._warnRing = warnRing
      this.obstacleObjects.set(cfg.id, { container, config: cfg, solved: false })
    })
  }

  // ═══════════════════════════════════════════════════════════
  // BOSS — Tidal Sentinel (enhanced: eye tracking + bubble attacks)
  // ═══════════════════════════════════════════════════════════

  private createBoss() {
    this.bossContainer = this.add.container(BOSS_X, this.groundY - 90).setDepth(8)
    const glow   = this.add.ellipse(0, 0, 200, 230, 0x3f51b5, 0.3)
    const body   = this.add.ellipse(0, 0, 180, 210, 0x1a237e, 0.95)
    const inner  = this.add.ellipse(0, -10, 120, 135, 0x283593, 0.8)
    this.bossEyeL  = this.add.circle(-30, -28, 16, 0x00e5ff)
    this.bossEyeR  = this.add.circle(30,  -28, 16, 0x00e5ff)
    this.bossPupilL = this.add.circle(-30, -28, 7, 0x001f3f)
    this.bossPupilR = this.add.circle(30,  -28, 7, 0x001f3f)
    const crown  = this.add.text(0, -95, '👑', { fontSize: '40px' }).setOrigin(0.5)
    for (let t = 0; t < 5; t++) {
      const tent = this.add.rectangle((t - 2) * 32, 105, 14, 70, 0x1a237e, 0.8)
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
    this.bossContainer.add([glow, body, inner, this.bossEyeL, this.bossEyeR, this.bossPupilL, this.bossPupilR, crown, nameTxt, badgeBg, badgeTxt])
    this.tweens.add({ targets: this.bossContainer, y: this.groundY - 96, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: glow, alpha: { from: 0.3, to: 0.6 }, scaleX: 1.08, scaleY: 1.08, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    ;[this.bossEyeL, this.bossEyeR].forEach(eye => this.tweens.add({ targets: eye, alpha: { from: 1, to: 0.4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }))
  }

  private createBirds() {
    ['🐦', '🦅', '🦜', '🐦', '🕊️', '🦉'].forEach((emoji, i) => {
      const bird = this.add.text(-80 - i * 200, 50 + i * 30, emoji, { fontSize: '22px' })
        .setScrollFactor(0.1).setDepth(1)
      bird.setScale(-1, 1)
      this.tweens.add({ targets: bird, x: this.screenW + 100, duration: 12000 + i * 3000, repeat: -1, ease: 'Linear', onRepeat: () => { bird.x = -80 } })
      this.tweens.add({ targets: bird, y: bird.y - 12, duration: 800 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    })
  }

  // ═══════════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════════
// The main update loop handles player input, movement, and interactions. It also updates the companion's position and reactions, the boss's eye tracking and projectile attacks, and checks for collisions with platforms, obstacles, and stars. The waveTimer is used to animate the background waves by adjusting their x positions in a sine wave pattern, creating a dynamic ocean effect.
  update(_time: number, delta: number) {
    this.waveTimer += delta
    this.waves.forEach((w, i) => {
      w.x = this.screenW / 2 + Math.sin(this.waveTimer * 0.001 + i * 1.2) * 20
    })

    this.updatePlayer(delta)
    this.updateCompanion(delta)
    this.updateBossEyes()
    this.updateBossProjectiles(delta)
    this.updatePlatformCollisions()

    if (!this.isBlocked) {
      this.checkObstacleCollisions()
      this.checkBossProximity()
      this.checkStarCollection()
    }
    this.updateObstacleWarnings()
  }

  // ── Player update ─────────────────────────────────────────
// The player update function handles movement based on keyboard and touch input, applies gravity, checks for ground collision, and updates the player's position and leg animation. The player can move left or right, jump if on the ground, and will experience a gradual slowdown when no input is given. The leg animation is a simple sine wave that creates a running motion when the player is moving on the ground.
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
    this.isRunning = goLeft || goRight

    if (goLeft)       { this.playerVelX = -4.5; this.facingRight = false }
    else if (goRight) { this.playerVelX =  4.5; this.facingRight = true  }
    else              { this.playerVelX *= 0.75 }

    const wasOnGround = this.playerOnGround
    if (jump && this.playerOnGround) {
      this.playerVelY = -14
      this.playerOnGround = false
      this.companionSay(this.pick(COMPANION_MESSAGES.jump), 900)
    }

    this.playerVelY += 0.55 * dt
    this.playerY    += this.playerVelY * dt

    // ── Ground collision ──────────────────────────────────────
    const floorY = this.groundY - 24
    if (this.playerY >= floorY) {
      this.playerY = floorY
      this.playerVelY = 0
      this.playerOnGround = true
    }

    this.playerX = Math.max(40, this.playerX + this.playerVelX * dt)
    this.playerX = Math.min(this.getRightLimit(), this.playerX)
    this.player.setScale(this.facingRight ? 1 : -1, 1)
    this.player.setPosition(this.playerX, this.playerY)

    // ── Leg animation ─────────────────────────────────────────
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

  // ── Platform collision ────────────────────────────────────

  private updatePlatformCollisions() {
    if (this.isBlocked) return

    let onPlatform = false
    for (const plat of this.platformObjects) {
      const platY   = plat.container.y  // current Y (may be bobbing)
      const platTop = platY - 7          // top surface of platform

      const dx = Math.abs(this.playerX - plat.worldX)
      const halfW = plat.width / 2 + 10

      // Player must be falling, within X range, and just crossing the top
      if (
        dx < halfW &&
        this.playerVelY >= 0 &&
        this.playerY <= platTop + 8 &&
        this.playerY >= platTop - 16
      ) {
        this.playerY        = platTop - 16
        this.playerVelY     = 0
        this.playerOnGround = true
        onPlatform          = true
        break
      }
    }
    // If player walks off a platform edge, let gravity take over
    // (playerOnGround is reset to false by the jump system naturally)
  }

  // ── Companion figure-8 flight ─────────────────────────────

  private updateCompanion(delta: number) {
    const dt = delta / 16.67
    this.companionTime += delta

    // Gary lags behind the player on the ground
    this.companionTargetX = this.playerX + (this.facingRight ? -58 : 58)
    const dx = this.companionTargetX - this.companionX
    this.companionX += dx * 0.06 * dt

    // Gary hops gently on the ground (no vertical drift — he's a snail)
    const hopY = Math.abs(Math.sin(this.companionTime * 0.003)) * 6
    const groundLevel = this.groundY - 20
    this.companion.setPosition(this.companionX, groundLevel - hopY)

    // Gary always faces right — flip only the body container, NOT text
    // scaleX=-1 flips Gary; speech bubble is a separate container (no flip)
    this.companion.setScale(dx < 0 ? 1 : -1, 1)

    // Speech bubble: always positioned above Gary in world space,
    // with its own scale kept at (1,1) so text is never mirrored.
    const bubbleX = this.companionX + (dx < 0 ? 30 : -140)
    const bubbleY = groundLevel - hopY - 50
    this.companionSpeechBubble.setPosition(bubbleX, bubbleY)
    // Always upright — counter the companion's X flip
    this.companionSpeechBubble.setScale(1, 1)
  }

  // ── Boss eye tracking ─────────────────────────────────────

  private updateBossEyes() {
    if (this.bossPhase === 0 || this.bossPhase >= 4) return
    // Pupils move toward player X position (clamped)
    const dx = (this.playerX - BOSS_X) / 400
    const clampedDx = Math.max(-6, Math.min(6, dx * 6))
    this.bossPupilL.setPosition(-30 + clampedDx, -28)
    this.bossPupilR.setPosition( 30 + clampedDx, -28)
  }

  // ── Boss bubble attack ────────────────────────────────────

  private updateBossProjectiles(delta: number) {
    if (this.bossBlocked && this.activeBossPhase > 0) {
      this.bossAttackTimer += delta
      if (this.bossAttackTimer >= this.bossAttackInterval) {
        this.bossAttackTimer = 0
        this.fireBossBubbles()
      }
    }

    const dt = delta / 16.67
    for (let i = this.bossProjectiles.length - 1; i >= 0; i--) {
      const p = this.bossProjectiles[i]
      p.velY += 0.6 * dt     // gravity on bubble
      const newX = p.obj.x + p.velX * dt
      const newY = p.obj.y + p.velY * dt

      // Bounce off ground
      if (newY >= this.groundY - 20 && p.bounces < 3) {
        p.velY = -(Math.abs(p.velY) * 0.6)
        p.bounces++
      }

      p.obj.setPosition(newX, newY)

      // Destroy if off-world
      if (newX < -100 || p.bounces >= 3 && newY > this.groundY) {
        p.obj.destroy()
        this.bossProjectiles.splice(i, 1)
      }
    }
  }
// The boss fires bubble projectiles in the player's direction at regular intervals when active. Each attack starts with a pre-attack animation where the boss roars by shaking and flashing its eyes. Then it fires 2 to 4 bubbles that arc toward the player's current position, with some random spread for unpredictability. The bubbles are represented as text objects with a bubble emoji, and they have a spinning tween for visual flair. The projectiles are stored in an array with their velocity and bounce count, allowing them to be updated each frame for movement and collision.
  private fireBossBubbles() {
    // Pre-attack: boss roars (shake + flash)
    this.tweens.add({ targets: this.bossContainer, x: BOSS_X + 10, duration: 60, yoyo: true, repeat: 3, ease: 'Linear' })
    const flashEye = () => {
      [this.bossEyeL, this.bossEyeR].forEach(e => { e.setFillStyle(0xff0000); this.time.delayedCall(200, () => e.setFillStyle(0x00e5ff)) })
    }
    flashEye()

    // Fire 2-4 arcing bubble shots toward player direction
    const count = 2 + this.activeBossPhase
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * 250, () => {
        const bubble = this.add.text(BOSS_X - 40, this.groundY - 130, '🫧', { fontSize: '28px' }).setOrigin(0.5).setDepth(7)
        // Angle toward player with spread
        const spread = (i - count / 2) * 0.18
        const velX = -(3.5 + Math.random() * 1.5)
        const velY = -(5 + Math.random() * 3)
        // Spin tween
        this.tweens.add({ targets: bubble, angle: 360, duration: 800, repeat: -1, ease: 'Linear' })
        this.bossProjectiles.push({ obj: bubble, velX, velY: velY + spread * 3, bounces: 0 })
      })
    }
  }

  private clearBossProjectiles() {
    this.bossProjectiles.forEach(p => {
      this.tweens.add({ targets: p.obj, alpha: 0, scaleX: 2, scaleY: 2, duration: 250, ease: 'Quad.easeOut', onComplete: () => p.obj.destroy() })
    })
    this.bossProjectiles = []
    this.bossAttackTimer = 0
  }

  // ── Obstacle proximity warnings ───────────────────────────
// As the player approaches unsolved obstacles, a warning ring around the obstacle's emoji icon becomes more visible. This is implemented by calculating the distance from the player to each obstacle and adjusting the alpha of the warning ring accordingly. The ring starts to fade in when the player is within 220 pixels, becoming fully visible at 40 pixels or closer, and fades out again as the player moves away.
  private updateObstacleWarnings() {
    this.obstacleObjects.forEach(({ container, config, solved }) => {
      if (solved) return
      const warnRing = (container as any)._warnRing as Phaser.GameObjects.Arc | undefined
      if (!warnRing) return
      const dist = Math.abs(this.playerX - config.x)
      if (dist < 220 && dist > 40) {
        const alpha = (1 - dist / 220) * 0.9
        warnRing.setStrokeStyle(3, 0xffd700, alpha)
      } else {
        warnRing.setStrokeStyle(3, 0xffd700, 0)
      }
    })
  }

  // ── Star collection ───────────────────────────────────────

  private checkStarCollection() {
    this.starObjects.forEach(s => {
      if (s.collected) return
      const dx = Math.abs(this.playerX - s.x)
      const dy = Math.abs(this.playerY - s.y)
      if (dx < 38 && dy < 44) this.collectStar(s)
    })
  }

  private collectStar(s: typeof this.starObjects[0]) {
    s.collected = true
    this.starsCollected++
    this.starCountText.setText(`${this.starsCollected} / ${STAR_POSITIONS.length}`)

    // Glow ring pop
    if (s.glowRing) {
      this.tweens.add({ targets: s.glowRing, scaleX: 4, scaleY: 4, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => s.glowRing!.destroy() })
    }

    // Star flies to HUD
    // Convert star's world position to screen position for the flying tween
    const cam = this.cameras.main
    const sx  = s.x - cam.scrollX
    const sy  = s.y - cam.scrollY
    const fly = this.add.text(sx, sy, '⭐', { fontSize: '26px' }).setOrigin(0.5).setScrollFactor(0).setDepth(80)
    this.tweens.add({
      targets: fly, x: this.screenW - 100, y: 18, scaleX: 0.3, scaleY: 0.3, alpha: 0,
      duration: 550, ease: 'Quad.easeIn', onComplete: () => fly.destroy(),
    })

    // HUD bounce
    this.tweens.add({ targets: this.starHUD, scaleX: 1.3, scaleY: 1.3, duration: 100, yoyo: true, ease: 'Back.easeOut' })

    s.obj.destroy()
    this.companionSay(this.pick(COMPANION_MESSAGES.starCollect), 1400)
  }

  // ═══════════════════════════════════════════════════════════
  // NAVIGATION / COLLISION GATES
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
    const obs = this.obstacleObjects.get(id)
    if (obs) this.tweens.add({ targets: obs.container, x: cfg.x + 8, duration: 60, yoyo: true, repeat: 3, ease: 'Linear' })
    this.companionSay(this.pick(COMPANION_MESSAGES.approach), 2500)
    dispatchToReact(ZONE1_EVENTS.SHOW_PROBLEM, { type: 'obstacle', obstacleId: id, problemId: cfg.problemId, label: cfg.label })
  }

  private triggerBoss() {
    const nextPhase = this.bossPhase + 1
    if (nextPhase > 3) return
    this.bossPhase       = nextPhase
    this.activeBossPhase = nextPhase
    this.bossBlocked     = true
    this.bossAttackTimer = this.bossAttackInterval * 0.6
    const problemIds = ['Z1-BOSS-01', 'Z1-BOSS-02', 'Z1-BOSS-03']
    dispatchToReact(ZONE1_EVENTS.SHOW_PROBLEM, {
      type: 'boss', obstacleId: `boss-phase-${nextPhase}`,
      problemId: problemIds[nextPhase - 1], bossPhase: nextPhase,
      label: `Tidal Sentinel — Phase ${nextPhase}`,
    })
    dispatchToReact(ZONE1_EVENTS.BOSS_PHASE, { phase: nextPhase })
    this.tweens.add({ targets: this.bossContainer, x: BOSS_X + 12, duration: 80, yoyo: true, repeat: 5, ease: 'Linear' })
    this.companionSay(this.pick(COMPANION_MESSAGES.bossNear), 3000)
  }

  // ═══════════════════════════════════════════════════════════
  // ANSWER HANDLING
  // ═══════════════════════════════════════════════════════════

  private handleAnswerResult(correct: boolean, obstacleId: string) {
    if (!this.obstacleBlocked && !this.bossBlocked) return
    this.clearBossProjectiles()
    if (correct) {
      this.companionReactCorrect()
      if (obstacleId.startsWith('boss-phase')) this.onBossPhaseCleared()
      else this.onObstacleCleared(obstacleId)
    } else {
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

    const cx = obs.config.x
    const cy = this.groundY - obs.config.height / 2

    // Screen flash
    const flash = this.add.rectangle(this.screenW / 2, this.screenH / 2, this.screenW, this.screenH, 0xffffff, 0.5)
      .setScrollFactor(0).setDepth(50)
    this.tweens.add({ targets: flash, alpha: 0, duration: 350, ease: 'Quad.easeOut', onComplete: () => flash.destroy() })

    // Emoji rockets
    const ghost = this.add.text(cx, cy, obs.config.emoji, { fontSize: '100px' }).setOrigin(0.5).setDepth(30)
    this.tweens.add({ targets: ghost, y: cy - 220, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => ghost.destroy() })

    // Shockwave rings
    for (let r = 0; r < 3; r++) {
      const ring = this.add.circle(cx, cy, 10, 0xffd700, 0).setStrokeStyle(4 - r, 0xffd700).setDepth(25)
      this.tweens.add({ targets: ring, scaleX: 6 + r * 2, scaleY: 6 + r * 2, alpha: 0, duration: 500 + r * 120, delay: r * 80, ease: 'Quad.easeOut', onComplete: () => ring.destroy() })
    }

    // Coin earn notification — "⭐ +1 Star!"
    const cam = this.cameras.main
    const screenCX = cx - cam.scrollX
    const screenCY = cy - cam.scrollY

    const coinPop = this.add.text(screenCX, screenCY - 30, `⭐ +1 Star!`, {
      fontSize: '22px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#ffd700', stroke: '#b34400', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(65).setAlpha(0).setScale(0.5)
    this.tweens.add({
      targets: coinPop, y: screenCY - 90, alpha: 1, scaleX: 1.1, scaleY: 1.1,
      duration: 500, ease: 'Back.easeOut',
      onComplete: () => { this.tweens.add({ targets: coinPop, alpha: 0, y: screenCY - 120, duration: 350, delay: 600, ease: 'Quad.easeIn', onComplete: () => coinPop.destroy() }) },
    })

    // Particle burst
    const burstColors = [0xffd700, 0xff6b35, 0x00e5ff, 0x76ff03, 0xff4081, 0xffffff, 0xff1744, 0x00bcd4]
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.3
      const dist  = 80 + Math.random() * 100
      const dot   = this.add.circle(screenCX, screenCY, 6 + Math.random() * 10, burstColors[i % burstColors.length]).setScrollFactor(0).setDepth(60)
      this.tweens.add({
        targets: dot, x: screenCX + Math.cos(angle) * dist, y: screenCY + Math.sin(angle) * dist - 40,
        duration: 800 + Math.random() * 400, ease: 'Cubic.easeOut',
        onComplete: () => { this.tweens.add({ targets: dot, scaleX: 0, scaleY: 0, alpha: 0, duration: 600, ease: 'Quad.easeIn', onComplete: () => dot.destroy() }) },
      })
    }

    // SOLVED! text
    const solvedTxt = this.add.text(cx, cy - 40, '✅ SOLVED!', {
      fontSize: '28px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#ffffff', stroke: '#00aa44', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(35).setAlpha(0).setScale(0.4)
    this.tweens.add({
      targets: solvedTxt, y: cy - 110, alpha: 1, scaleX: 1, scaleY: 1, duration: 400, ease: 'Back.easeOut',
      onComplete: () => { this.tweens.add({ targets: solvedTxt, alpha: 0, y: cy - 150, duration: 400, delay: 500, ease: 'Quad.easeIn', onComplete: () => solvedTxt.destroy() }) },
    })

    // Container pop
    this.tweens.add({
      targets: obs.container, scaleX: 1.4, scaleY: 1.4, duration: 120, ease: 'Quad.easeOut',
      onComplete: () => { this.tweens.add({ targets: obs.container, scaleX: 0, scaleY: 0, alpha: 0, y: obs.container.y - 80, duration: 400, ease: 'Back.easeIn', onComplete: () => obs.container.destroy() }) },
    })

    this.spawnSparkles(cx, cy, 20)
    dispatchToReact(ZONE1_EVENTS.PROGRESS, { solved: this.solvedCount, total: 8 })
    this.obsCooldown = true
    this.time.delayedCall(700, () => { this.obsCooldown = false })
  }

  private onBossPhaseCleared() {
    const hpIdx = this.bossPhase - 1
    if (this.bossHP[hpIdx]) {
      this.tweens.add({ targets: this.bossHP[hpIdx], scaleX: 0, duration: 400, ease: 'Back.easeIn', onComplete: () => { if (this.bossHP[hpIdx]) this.bossHP[hpIdx].setFillStyle(0x444444) } })
    }
    this.tweens.add({ targets: this.bossContainer, alpha: 0.2, duration: 100, yoyo: true, repeat: 4, ease: 'Linear' })

    if (this.bossPhase >= 3) {
      this.time.delayedCall(900, () => this.defeatBoss())
    } else {
      this.activeBossPhase    = 0
      this.bossBlocked        = false
      this.interPhaseCooldown = true
      this.time.delayedCall(1500, () => { this.interPhaseCooldown = false })
    }
  }

  private defeatBoss() {
    this.cameras.main.shake(500, 0.018)
    this.spawnSparkles(BOSS_X, this.groundY - 90, 40)
    this.spawnSparkles(BOSS_X - 60, this.groundY - 60, 20)
    this.spawnSparkles(BOSS_X + 60, this.groundY - 60, 20)
    this.tweens.add({
      targets: this.bossContainer, scaleX: 0, scaleY: 0, alpha: 0, y: this.groundY + 100, duration: 600, ease: 'Back.easeIn',
      onComplete: () => {
        this.bossContainer.destroy()
        this.bossPhase   = 4
        this.bossBlocked = false
        this.time.delayedCall(600, () => this.launchCelebration())
      },
    })
  }

  // ═══════════════════════════════════════════════════════════
  // CELEBRATION — original BOSS DEFEATED screen
  // ═══════════════════════════════════════════════════════════

  private launchCelebration() {
    const cx = this.screenW / 2
    const cy = this.screenH / 2

    // ── Screen flash ──────────────────────────────────────────
    const flash = this.add.rectangle(cx, cy, this.screenW, this.screenH, 0xffffff, 0.75)
      .setScrollFactor(0).setDepth(70)
    this.tweens.add({ targets: flash, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => flash.destroy() })

    // ── Dark overlay for contrast ─────────────────────────────
    const overlay = this.add.rectangle(cx, cy, this.screenW, this.screenH, 0x000000, 0.45)
      .setScrollFactor(0).setDepth(68)

    // ── Trophy ────────────────────────────────────────────────
    const trophy = this.add.text(cx, cy - 150, '🏆', { fontSize: '90px' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(75).setAlpha(0).setScale(0.1)
    this.tweens.add({
      targets: trophy, alpha: 1, scaleX: 1.2, scaleY: 1.2, duration: 600, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: trophy, scaleX: 1, scaleY: 1, duration: 250, ease: 'Sine.easeOut' })
        this.tweens.add({ targets: trophy, y: cy - 165, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      },
    })

    // ── "BOSS DEFEATED!" headline ─────────────────────────────
    const headline = this.add.text(cx, cy - 50, 'BOSS DEFEATED!', {
      fontSize: '58px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#ffd700', stroke: '#b34400', strokeThickness: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(75).setAlpha(0).setScale(0.3)
    this.tweens.add({
      targets: headline, alpha: 1, scaleX: 1, scaleY: 1, duration: 500, delay: 150, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: headline, scaleX: 1.06, scaleY: 1.06, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      },
    })

    // ── Sub-line ──────────────────────────────────────────────
    const sub = this.add.text(cx, cy + 20, 'Tidal Sentinel Vanquished! 🌊', {
      fontSize: '26px', fontFamily: 'Nunito, sans-serif', fontStyle: 'bold',
      color: '#ffffff', stroke: '#1a237e', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(75).setAlpha(0)
    this.tweens.add({ targets: sub, alpha: 1, y: cy + 12, duration: 400, delay: 350, ease: 'Quad.easeOut' })

    // ── Stars burst from center ───────────────────────────────
    this.time.delayedCall(200, () => {
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2
        const star = this.add.text(cx, cy, '⭐', { fontSize: '22px' })
          .setOrigin(0.5).setScrollFactor(0).setDepth(73)
        this.tweens.add({
          targets: star,
          x: cx + Math.cos(angle) * 220, y: cy + Math.sin(angle) * 170,
          alpha: 0, scaleX: 0, scaleY: 0,
          duration: 900, ease: 'Quad.easeOut',
          onComplete: () => star.destroy(),
        })
      }
    })

    // ── Firework volleys ──────────────────────────────────────
    const fwPoints = [
      { x: cx - 210, y: cy - 110 }, { x: cx + 210, y: cy - 90 },
      { x: cx - 100, y: cy - 180 }, { x: cx + 110, y: cy - 170 },
      { x: cx,       y: cy - 220 }, { x: cx - 270, y: cy + 10  },
      { x: cx + 270, y: cy - 10  },
    ]
    fwPoints.forEach(({ x, y }, i) => {
      this.time.delayedCall(i * 180, () => this.spawnFirework(x, y))
    })
    this.time.delayedCall(1400, () => {
      if (!this.scene.isActive()) return
      fwPoints.forEach(({ x, y }, i) => {
        this.time.delayedCall(i * 140, () =>
          this.spawnFirework(x + (Math.random() - 0.5) * 100, y + (Math.random() - 0.5) * 80)
        )
      })
    })

    // ── Confetti rain ─────────────────────────────────────────
    for (let i = 0; i < 70; i++) {
      this.time.delayedCall(Math.random() * 2200, () => {
        if (!this.scene.isActive()) return
        const confettiColors = [0xffd700, 0xff4081, 0x00e5ff, 0x76ff03, 0xff6b35, 0xffffff, 0xff1744, 0xaa00ff]
        const c = this.add.rectangle(
          Math.random() * this.screenW, -12,
          5 + Math.random() * 7, 10 + Math.random() * 10,
          confettiColors[Math.floor(Math.random() * confettiColors.length)]
        ).setScrollFactor(0).setDepth(72).setRotation(Math.random() * Math.PI)
        this.tweens.add({
          targets: c, y: this.screenH + 20,
          rotation: c.rotation + (Math.random() - 0.5) * 8,
          duration: 1600 + Math.random() * 1000, ease: 'Linear',
          onComplete: () => { if (c.active) c.destroy() },
        })
      })
    }

    // ── Fade out & dispatch ZONE_COMPLETE ─────────────────────
    this.time.delayedCall(3000, () => {
      // Guard: scene may already be gone if React navigated away early
      if (!this.scene.isActive()) return

      this.tweens.add({
        targets: [overlay, headline, sub], alpha: 0, duration: 700, ease: 'Quad.easeIn',
      })
      this.tweens.add({
        targets: trophy, alpha: 0, duration: 700, ease: 'Quad.easeIn',
        onComplete: () => {
          if (overlay.active)  overlay.destroy()
          if (headline.active) headline.destroy()
          if (sub.active)      sub.destroy()
          if (trophy.active)   trophy.destroy()

          // ── Destroy Phaser BEFORE React unmounts the canvas ──
          // This stops the render loop so no framebuffer resize
          // can happen after the canvas is removed from the DOM.
          this.game.destroy(true, false)

          // Dispatch AFTER destroy so React sees a clean state
          dispatchToReact(ZONE1_EVENTS.ZONE_COMPLETE, {})
        },
      })
    })
  }

  // ═══════════════════════════════════════════════════════════
  // FX HELPERS
  // ═══════════════════════════════════════════════════════════

  private spawnFirework(x: number, y: number) {
    const colors = [0xffd700, 0xff4081, 0x00e5ff, 0x76ff03, 0xff6b35, 0xffffff, 0xff1744, 0xaa00ff]
    const count = 18
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3
      const dist  = 55 + Math.random() * 110
      const dot   = this.add.circle(x, y, 3 + Math.random() * 6, colors[Math.floor(Math.random() * colors.length)]).setScrollFactor(0).setDepth(71)
      this.tweens.add({
        targets: dot, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, duration: 450 + Math.random() * 300, ease: 'Cubic.easeOut',
        onComplete: () => { this.tweens.add({ targets: dot, alpha: 0, scaleX: 0, scaleY: 0, duration: 350, ease: 'Quad.easeIn', onComplete: () => dot.destroy() }) },
      })
    }
    const burst = this.add.circle(x, y, 18, 0xffffff).setScrollFactor(0).setDepth(71)
    this.tweens.add({ targets: burst, scaleX: 3.5, scaleY: 3.5, alpha: 0, duration: 280, ease: 'Quad.easeOut', onComplete: () => burst.destroy() })
  }

  private spawnSparkles(x: number, y: number, count = 12) {
    const colors = [0xffd700, 0xff6b35, 0x00e5ff, 0x76ff03, 0xff4081]
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

  // ── Utility ───────────────────────────────────────────────

  private pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
  }
}