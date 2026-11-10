/** @type {import('tailwindcss').Config} */

// FinTechPro — Tailwind Theme Extension
// Design system extracted from Figma reference kit (FinTech/Modern Clean)
// Exact hex codes from Figma inspector: border-radius 12px, padding 24px,
// box-shadow 0 8px 26px rgba(16,16,…), Neutral/10 background

module.exports = {
  theme: {
    extend: {
      // ── COLORS ──────────────────────────────────────────────────────────
      colors: {
        // Canvas & Surface
        canvas:        "#F5F5F7",     // Off-white page background (between cards)
        surface:       "#FFFFFF",     // Card / panel background
        "surface-alt": "#FAFAFA",     // Hover / subtle surface variant

        // Text hierarchy
        ink:           "#0A101F",     // Primary text (headings, values)
        "ink-soft":    "#1A1A2E",     // Slightly lighter primary
        secondary:     "#8A92B2",     // Muted labels, meta text
        tertiary:      "#B0B5C9",     // Disabled text, placeholder

        // Brand / Accent
        accent:        "#5D41EC",     // Purple accent (CTAs, active tabs)
        "accent-hover":"#4C33D4",     // Purple hover state
        "accent-soft": "#EDE9FC",     // Purple tinted background

        // Trend colors
        positive:      "#07AB81",     // Green — gains, buy, up
        "positive-soft":"#DEF8F1",    // Green tinted badge background
        negative:      "#E5484D",     // Red — losses, sell, down
        "negative-soft":"#FFEAEB",    // Red tinted badge background
        warning:       "#F7931A",     // Amber — Bitcoin orange, caution
        "warning-soft":"#FFF3E0",     // Amber tinted badge background
        info:          "#3B82F6",     // Blue — neutral informational

        // Structural
        line:          "#E8E8ED",     // Default card border & dividers
        "line-strong": "#D1D1D9",     // Emphasized dividers
        "line-light":  "#F0F0F5",     // Very subtle separators

        // Chart palette (for Recharts / data viz)
        "chart-1":     "#5D41EC",     // Purple
        "chart-2":     "#07AB81",     // Green
        "chart-3":     "#F7931A",     // Orange
        "chart-4":     "#3B82F6",     // Blue
        "chart-5":     "#E5484D",     // Red
        "chart-6":     "#8A92B2",     // Gray
      },

      // ── FONT FAMILY ─────────────────────────────────────────────────────
      fontFamily: {
        sans:    ["Inter", "SF Pro Display", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["Inter", "SF Pro Display", "sans-serif"],
        mono:    ["SF Mono", "JetBrains Mono", "Fira Code", "monospace"],
      },

      // ── FONT SIZE ───────────────────────────────────────────────────────
      fontSize: {
        "hero":     ["2.75rem", { lineHeight: "1.1",  letterSpacing: "-0.04em", fontWeight: "700" }],
        "heading":  ["1.5rem",  { lineHeight: "1.25", letterSpacing: "-0.02em", fontWeight: "600" }],
        "subhead":  ["1.125rem",{ lineHeight: "1.4",  letterSpacing: "-0.01em", fontWeight: "600" }],
        "body":     ["0.9375rem",{ lineHeight: "1.5",  fontWeight: "400" }],
        "caption":  ["0.8125rem",{ lineHeight: "1.5",  fontWeight: "500" }],
        "micro":    ["0.6875rem",{ lineHeight: "1.4",  fontWeight: "500" }],
      },

      // ── BORDER RADIUS ───────────────────────────────────────────────────
      borderRadius: {
        "sm":  "6px",
        "md":  "8px",
        "lg":  "10px",
        "xl":  "12px",      // ← Card radius (from Figma: border-radius: 12px)
        "2xl": "16px",      // Large cards / hero
        "3xl": "20px",      // Feature cards
        "pill": "9999px",   // Pill badges & toggles
      },

      // ── BOX SHADOWS (multi-layer, soft, extracted from Figma) ───────────
      boxShadow: {
        // Primary card shadow (Figma: 0 8px 26px 0 rgba(16,16,…))
        "card":
          "0 1px 2px rgba(16, 16, 40, 0.04), 0 4px 12px rgba(16, 16, 40, 0.04), 0 8px 26px rgba(16, 16, 40, 0.06)",
        // Card hover — slightly lifted
        "card-hover":
          "0 2px 4px rgba(16, 16, 40, 0.04), 0 8px 20px rgba(16, 16, 40, 0.06), 0 14px 36px rgba(16, 16, 40, 0.08)",
        // Sidebar shadow
        "sidebar":
          "4px 0 16px rgba(16, 16, 40, 0.04), 1px 0 4px rgba(16, 16, 40, 0.02)",
        // Input / inset fields
        "input":
          "inset 0 1px 3px rgba(16, 16, 40, 0.06)",
        // Elevated modal / dialog
        "modal":
          "0 4px 12px rgba(16, 16, 40, 0.06), 0 16px 48px rgba(16, 16, 40, 0.12)",
        // Pill badge
        "badge":
          "0 1px 3px rgba(16, 16, 40, 0.06)",
        // Button
        "button":
          "0 1px 2px rgba(16, 16, 40, 0.06), 0 2px 6px rgba(16, 16, 40, 0.04)",
        // Button hover
        "button-hover":
          "0 2px 4px rgba(16, 16, 40, 0.08), 0 4px 12px rgba(16, 16, 40, 0.06)",
        // Subtle — for inner sections, dividers
        "subtle":
          "0 1px 3px rgba(0, 0, 0, 0.03)",
      },

      // ── SPACING (card-specific) ─────────────────────────────────────────
      spacing: {
        "card":    "24px",    // Standard card padding (from Figma: 24px)
        "card-sm": "16px",    // Compact card padding
        "card-lg": "32px",    // Generous card padding
        "gap":     "20px",    // Standard grid gap
        "gap-sm":  "12px",    // Tight grid gap
        "gap-lg":  "24px",    // Generous grid gap
        "sidebar": "280px",   // Sidebar width
      },

      // ── TRANSITIONS ─────────────────────────────────────────────────────
      transitionDuration: {
        "fast": "120ms",
        "base": "200ms",
        "slow": "300ms",
      },

      transitionTimingFunction: {
        "smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
        "bounce": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },

      // ── KEYFRAMES & ANIMATIONS ──────────────────────────────────────────
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to:   { transform: "translateY(0)" },
        },
        "shimmer": {
          "100%": { transform: "translateX(100%)" },
        },
      },

      animation: {
        "fade-in":   "fade-in 0.3s ease-out both",
        "scale-in":  "scale-in 0.2s ease-out both",
        "slide-up":  "slide-up 0.3s ease-out both",
        "shimmer":   "shimmer 2s infinite",
      },

      // ── BACKDROP BLUR ──────────────────────────────────────────────────
      backdropBlur: {
        "xs":  "4px",
        "sm":  "8px",
        "md":  "12px",
        "lg":  "16px",
        "xl":  "20px",
      },
    },
  },
  plugins: [],
};
