// import type { Config } from "tailwindcss";

// const config: Config = {
//   content: [
//     "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
//     "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
//     "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
//   ],
//   theme: {
//     extend: {
//       colors: {
//         background: "var(--background)",
//         foreground: "var(--foreground)",
//       },
//     },
//   },
//   plugins: [],
// };
// export default config;



// import type { Config } from "tailwindcss";

// const config: Config = {
//   content: [
//     "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
//     "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
//     "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
//   ],
//   theme: {
//     extend: {
//       colors: {
//         primary:      "#1A1A2E",
//         gold:         "#E8B84B",
//         teal:         "#2DD4BF",
//         coral:        "#F97316",
//         violet:       "#7C3AED",
//         "game-green": "#22C55E",
//         bg:           "#F8F7F4",
//         surface:      "#FFFFFF",
//         border:       "#E2E0DC",
//         "text-muted": "#6B6A66",
//         "navy-light": "#252547",
//         "navy-mid":   "#1E1E38",
//       },
//       fontFamily: {
//         display: ["Nunito", "sans-serif"],
//         body:    ["Inter", "sans-serif"],
//       },
//       borderRadius: {
//         sm:   "6px",
//         md:   "12px",
//         lg:   "20px",
//         xl:   "32px",
//         full: "9999px",
//       },
//       keyframes: {
//         "fade-up": {
//           "0%":   { opacity: "0", transform: "translateY(20px)" },
//           "100%": { opacity: "1", transform: "translateY(0)" },
//         },
//         "fade-in": {
//           "0%":   { opacity: "0" },
//           "100%": { opacity: "1" },
//         },
//         "slide-left": {
//           "0%":   { opacity: "0", transform: "translateX(40px)" },
//           "100%": { opacity: "1", transform: "translateX(0)" },
//         },
//         "slide-right": {
//           "0%":   { opacity: "0", transform: "translateX(-40px)" },
//           "100%": { opacity: "1", transform: "translateX(0)" },
//         },
//         "glow-pulse": {
//           "0%, 100%": { boxShadow: "0 0 20px rgba(232,184,75,0.2)" },
//           "50%":      { boxShadow: "0 0 40px rgba(232,184,75,0.5)" },
//         },
//         "float": {
//           "0%, 100%": { transform: "translateY(0px)" },
//           "50%":      { transform: "translateY(-8px)" },
//         },
//         "shimmer": {
//           "0%":   { backgroundPosition: "-200% center" },
//           "100%": { backgroundPosition: "200% center" },
//         },
//         "spin": {
//           "0%":   { transform: "rotate(0deg)" },
//           "100%": { transform: "rotate(360deg)" },
//         },
//       },
//       animation: {
//         "fade-up":    "fade-up 0.6s ease-out forwards",
//         "fade-in":    "fade-in 0.4s ease-out forwards",
//         "slide-left": "slide-left 0.5s ease-out forwards",
//         "slide-right":"slide-right 0.5s ease-out forwards",
//         "glow-pulse": "glow-pulse 3s ease-in-out infinite",
//         "float":      "float 4s ease-in-out infinite",
//         "shimmer":    "shimmer 2s linear infinite",
//         "spin":       "spin 1s linear infinite",
//       },
//     },
//   },
//   plugins: [],
// };

// export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary:      "#1A1A2E",
        gold:         "#E8B84B",
        teal:         "#2DD4BF",
        coral:        "#F97316",
        violet:       "#7C3AED",
        "game-green": "#22C55E",
        bg:           "#F8F7F4",
        surface:      "#FFFFFF",
        border:       "#E2E0DC",
        "text-muted": "#6B6A66",
        "navy-light": "#252547",
        "navy-mid":   "#1E1E38",
        // Zone card backgrounds
        "zone1-sky":  "#0E1F38",  // deep sky blue — Zone 1 Pebble Shore
        "zone2-cave": "#1C1530",  // deep purple   — Zone 2 Echo Caves
        "zone3-iron": "#2A1E18",  // dark ember     — Zone 3 Iron Summit
        "zone4-frac": "#252018",  // dark gold      — Zone 4 Fractured Expanse
      },
      fontFamily: {
        display: ["Nunito", "sans-serif"],
        body:    ["Inter", "sans-serif"],
      },
      borderRadius: {
        sm:   "6px",
        md:   "12px",
        lg:   "20px",
        xl:   "32px",
        full: "9999px",
      },
      keyframes: {
        // ── Auth page ──────────────────────────────────────────────────
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-left": {
          "0%":   { opacity: "0", transform: "translateX(40px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-right": {
          "0%":   { opacity: "0", transform: "translateX(-40px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(232,184,75,0.2)" },
          "50%":      { boxShadow: "0 0 40px rgba(232,184,75,0.5)" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "spin": {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        // ── Welcome page ───────────────────────────────────────────────
        "float": {
          "0%, 100%": { transform: "translateY(0px) rotate(-3deg)" },
          "50%":      { transform: "translateY(-18px) rotate(3deg)" },
        },
        "float-logo": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-8px)" },
        },
        "hero-glow": {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%":      { opacity: "0.7", transform: "scale(1.08)" },
        },
        "title-reveal": {
          "0%":   { opacity: "0", transform: "translateY(40px) skewY(2deg)" },
          "100%": { opacity: "1", transform: "translateY(0px) skewY(0deg)" },
        },
        "pulse-ring": {
          "0%":   { transform: "scale(0.95)", boxShadow: "0 0 0 0 rgba(232,184,75,0.5)" },
          "70%":  { transform: "scale(1)",    boxShadow: "0 0 0 16px rgba(232,184,75,0)" },
          "100%": { transform: "scale(0.95)", boxShadow: "0 0 0 0 rgba(232,184,75,0)" },
        },
        "ticker": {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "spin-slow": {
          "from": { transform: "rotate(0deg)" },
          "to":   { transform: "rotate(360deg)" },
        },
        "fade-slide-up": {
          "0%":   { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0px)" },
        },
        // ── Game components ─────────────────────────────────────────────
        // Wrong answer card shake
        shake: {
          '0%':   { transform: 'translateX(0)' },
          '15%':  { transform: 'translateX(-7px)' },
          '30%':  { transform: 'translateX(7px)' },
          '45%':  { transform: 'translateX(-5px)' },
          '60%':  { transform: 'translateX(5px)' },
          '75%':  { transform: 'translateX(-2px)' },
          '100%': { transform: 'translateX(0)' },
        },
        // Submit button light sweep
        shine: {
          '0%':   { transform: 'translateX(-100%)' },
          '60%':  { transform: 'translateX(200%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        // Hint box slide-in
        fadeSlideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        // Auth
        "fade-up":       "fade-up 0.6s ease-out forwards",
        "fade-in":       "fade-in 0.4s ease-out forwards",
        "slide-left":    "slide-left 0.5s ease-out forwards",
        "slide-right":   "slide-right 0.5s ease-out forwards",
        "glow-pulse":    "glow-pulse 3s ease-in-out infinite",
        "shimmer":       "shimmer 2s linear infinite",
        "spin":          "spin 1s linear infinite",
        // Welcome
        "float":         "float 6s ease-in-out infinite",
        "float-logo":    "float-logo 4s ease-in-out infinite",
        "hero-glow":     "hero-glow 4s ease-in-out infinite",
        "title-reveal":  "title-reveal 0.8s cubic-bezier(0.16,1,0.3,1) 0.3s both",
        "pulse-ring":    "pulse-ring 2.5s ease-in-out infinite",
        "ticker":        "ticker 18s linear infinite",
        "spin-slow":     "spin-slow 20s linear infinite",
        "fade-slide-up": "fade-slide-up 0.5s ease-out both",
        // Game components
       shake:         'shake 0.45s ease',
        shine:         'shine 2.5s ease infinite',
        fadeSlideDown: 'fadeSlideDown 0.3s ease',
      },
    },
  },
  plugins: [],
};

export default config;