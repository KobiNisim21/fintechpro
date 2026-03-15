/** @type {import('tailwindcss').Config} */

// CLAY PREMIUM SKILL — Tailwind Config Extension
// Merge theme.extend into your existing tailwind.config.js

module.exports = {
  theme: {
    extend: {
      // ── COLORS ──────────────────────────────────────────────────────────────
      colors: {
        clay: {
          canvas:       "#F4F1FA",
          "card-bg":    "rgba(255,255,255,0.70)",
          "input-bg":   "#EFEBF5",
          foreground:   "#332F3A",
          muted:        "#635F69",
          accent:       "#7C3AED",
          "accent-alt": "#DB2777",
          sky:          "#0EA5E9",
          success:      "#10B981",
          warning:      "#F59E0B",
        },
      },

      // ── FONTS ────────────────────────────────────────────────────────────────
      fontFamily: {
        display: ["Nunito", "system-ui", "sans-serif"],
        body:    ["DM Sans",  "system-ui", "sans-serif"],
      },

      // ── BORDER RADII ─────────────────────────────────────────────────────────
      borderRadius: {
        xl:    "12px",
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
        "5xl": "40px",
        "6xl": "48px",
        "7xl": "60px",
        full:  "9999px",
      },

      // ── BOX SHADOWS ──────────────────────────────────────────────────────────
      boxShadow: {
        clayDeep:
          "30px 30px 60px #CDC6D9, -30px -30px 60px #FFFFFF, inset 10px 10px 20px rgba(139,92,246,0.05), inset -10px -10px 20px rgba(255,255,255,0.8)",
        clayCard:
          "16px 16px 32px rgba(160,150,180,0.20), -10px -10px 24px rgba(255,255,255,0.90), inset 6px 6px 12px rgba(139,92,246,0.03), inset -6px -6px 12px rgba(255,255,255,1)",
        clayCardHover:
          "20px 20px 40px rgba(160,150,180,0.30), -12px -12px 28px rgba(255,255,255,0.95), inset 6px 6px 12px rgba(139,92,246,0.05), inset -6px -6px 12px rgba(255,255,255,1)",
        clayButton:
          "12px 12px 24px rgba(139,92,246,0.30), -8px -8px 16px rgba(255,255,255,0.40), inset 4px 4px 8px rgba(255,255,255,0.40), inset -4px -4px 8px rgba(0,0,0,0.10)",
        clayButtonHover:
          "16px 16px 32px rgba(139,92,246,0.40), -8px -8px 20px rgba(255,255,255,0.50), inset 4px 4px 8px rgba(255,255,255,0.40), inset -4px -4px 8px rgba(0,0,0,0.10)",
        clayPressed:
          "inset 10px 10px 20px #D9D4E3, inset -10px -10px 20px #FFFFFF",
        clayOrb:
          "10px 10px 20px rgba(139,92,246,0.25), -8px -8px 16px rgba(255,255,255,0.90), inset 4px 4px 8px rgba(255,255,255,0.50), inset -4px -4px 8px rgba(0,0,0,0.08)",
        clayInset:
          "inset 8px 8px 16px #D5CFE2, inset -8px -8px 16px #FFFFFF",
      },

      // ── ANIMATIONS ───────────────────────────────────────────────────────────
      animation: {
        "clay-float":          "clay-float 8s ease-in-out infinite",
        "clay-float-delayed":  "clay-float-delayed 10s ease-in-out infinite",
        "clay-float-slow":     "clay-float-slow 12s ease-in-out infinite",
        "clay-breathe":        "clay-breathe 6s ease-in-out infinite",
        "clay-fade-up":        "clay-fade-up 0.6s ease-out both",
      },

      keyframes: {
        "clay-float": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%":       { transform: "translateY(-20px) rotate(2deg)" },
        },
        "clay-float-delayed": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%":       { transform: "translateY(-15px) rotate(-2deg)" },
        },
        "clay-float-slow": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%":       { transform: "translateY(-30px) rotate(5deg)" },
        },
        "clay-breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%":       { transform: "scale(1.02)" },
        },
        "clay-fade-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },

      // ── BACKDROP BLUR ─────────────────────────────────────────────────────────
      backdropBlur: {
        xl: "20px",
      },
    },
  },
  plugins: [],
};
