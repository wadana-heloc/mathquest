"use client";

import { useEffect, useRef } from "react";

/**
 * MathParticles — Phaser.js atmospheric background
 *
 * Uses CANVAS renderer (not WebGL) to avoid framebuffer errors.
 * Renders floating math symbols as subtle background atmosphere.
 * Fully pointer-events:none — never blocks the auth form.
 */
export default function MathParticles() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gameRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    if (gameRef.current) return;

    const SYMBOLS = ["×", "÷", "+", "−", "=", "9", "7", "11", "√", "π", "Σ", "?", "%", "3²", "∞"];
    const COLORS  = [0xe8b84b, 0x2dd4bf, 0x7c3aed, 0xffffff];

    type Particle = {
      x: number; y: number;
      vx: number; vy: number;
      alpha: number; alphaDir: number;
      fontSize: number;
      symbol: string;
      color: string;
      textObj: Phaser.GameObjects.Text | null;
    };

    // Dynamically import Phaser — must be client-only
    import("phaser").then((Phaser) => {
      if (gameRef.current) return;

      class ParticleScene extends Phaser.Scene {
        private particles: Particle[] = [];

        constructor() {
          super({ key: "ParticleScene" });
        }

        create() {
          const w = this.scale.width;
          const h = this.scale.height;
          const count = Math.min(35, Math.floor((w * h) / 20000));

          for (let i = 0; i < count; i++) {
            const colorHex = COLORS[Math.floor(Math.random() * COLORS.length)];
            const colorStr = "#" + colorHex.toString(16).padStart(6, "0");
            // ── SIZE: was 10–22px, now 16–32px ──────────────────────────
            const fontSize = Math.floor(Math.random() * 16) + 16;
            const symbol   = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

            const textObj = this.add.text(
              Math.random() * w,
              Math.random() * h,
              symbol,
              {
                fontFamily: "Nunito, sans-serif",
                fontSize:   `${fontSize}px`,
                color:      colorStr,
              }
            );
            textObj.setOrigin(0.5, 0.5);
            const alpha = 0.15 + Math.random() * 0.30;
            textObj.setAlpha(alpha);

            this.particles.push({
              x:        textObj.x,
              y:        textObj.y,
              vx:       (Math.random() - 0.5) * 0.6,
              vy:       -(Math.random() * 0.5 + 0.2),
              alpha,
              alphaDir: Math.random() > 0.5 ? 0.002 : -0.002,
              fontSize,
              symbol,
              color:    colorStr,
              textObj,
            });
          }
        }

        update() {
          const w = this.scale.width;
          const h = this.scale.height;

          for (const p of this.particles) {
            if (!p.textObj) continue;

            // Move
            p.x += p.vx;
            p.y += p.vy;

            // Pulse alpha between 0.1 and 0.45
            p.alpha += p.alphaDir;
            if (p.alpha > 0.45) p.alphaDir = -Math.abs(p.alphaDir);
            if (p.alpha < 0.10) p.alphaDir =  Math.abs(p.alphaDir);

            // Wrap vertically — respawn at bottom when off top
            if (p.y < -20) {
              p.y = h + 20;
              p.x = Math.random() * w;
            }
            // Wrap horizontally
            if (p.x < -20)    p.x = w + 20;
            if (p.x > w + 20) p.x = -20;

            p.textObj.setPosition(p.x, p.y);
            p.textObj.setAlpha(p.alpha);
          }
        }
      }

      const config: Phaser.Types.Core.GameConfig = {
        // CANVAS — avoids all WebGL framebuffer errors
        type:            Phaser.CANVAS,
        parent:          containerRef.current!,
        width:           window.innerWidth,
        height:          window.innerHeight,
        backgroundColor: "transparent",
        transparent:     true,
        scene:           [ParticleScene],
        scale: {
          mode:       Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        input: {
          keyboard: false,
          mouse:    false,
          touch:    false,
          gamepad:  false,
        },
        audio:  { noAudio: true },
        banner: false,
        // Disable all rendering features we don't need
        render: {
          antialias:       true,
          pixelArt:        false,
          roundPixels:     false,
        },
      };

      const game = new Phaser.Game(config);
      gameRef.current = game;

      // Ensure canvas never blocks pointer events on the form
      setTimeout(() => {
        const canvas = containerRef.current?.querySelector("canvas");
        if (canvas) {
          canvas.style.position      = "absolute";
          canvas.style.inset         = "0";
          canvas.style.pointerEvents = "none";
          canvas.style.opacity       = "1";
        }
      }, 100);
    });

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    />
  );
}