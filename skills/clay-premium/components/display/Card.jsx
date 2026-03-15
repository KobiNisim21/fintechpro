// CLAY PREMIUM SKILL — Card.jsx
//
// WHY THIS LOOKS THE WAY IT DOES:
// The card is the primary surface in this system. It floats above the canvas
// via the 4-layer shadow stack. The glass-clay hybrid (bg-white/70 +
// backdrop-blur) allows the colored background blobs to show through,
// creating ambient color that makes the card feel part of the clay world.
//
// The hover state adds TWO effects simultaneously:
// 1. translateY(-8px): the card physically rises toward the viewer
// 2. Enhanced shadow: stronger colored drop + stronger top-left highlight
//    This combination simulates the card genuinely floating closer in space.
//
// The transition is 500ms — deliberately slow for a premium, unhurried feel.
// Button transitions are 200ms (snappy). Card transitions are 500ms (graceful).
//
// Decorative elements can be absolutely positioned to "peek" from card edges.
// Use negative bottom margin on inner elements: -bottom-8 -left-8 -right-8

import { useState } from "react";

const CARD_SHADOW     = "16px 16px 32px rgba(160,150,180,0.20), -10px -10px 24px rgba(255,255,255,0.90), inset 6px 6px 12px rgba(139,92,246,0.03), inset -6px -6px 12px rgba(255,255,255,1.00)";
const CARD_HOV_SHADOW = "20px 20px 40px rgba(160,150,180,0.30), -12px -12px 28px rgba(255,255,255,0.95), inset 6px 6px 12px rgba(139,92,246,0.05), inset -6px -6px 12px rgba(255,255,255,1.00)";
const BTN_SHADOW      = "12px 12px 24px rgba(139,92,246,0.30), -8px -8px 16px rgba(255,255,255,0.40), inset 4px 4px 8px rgba(255,255,255,0.40), inset -4px -4px 8px rgba(0,0,0,0.10)";
const BTN_HOV_SHADOW  = "16px 16px 32px rgba(139,92,246,0.40), -8px -8px 20px rgba(255,255,255,0.50), inset 4px 4px 8px rgba(255,255,255,0.40), inset -4px -4px 8px rgba(0,0,0,0.10)";

export function Card({
  children,
  variant = "glass",
  interactive = true,
  padding = "32px",
  radius = 32,
  style: externalStyle,
  onClick,
}) {
  const [hovered, setHovered] = useState(false);

  const backgrounds = {
    glass:   "rgba(255,255,255,0.70)",
    solid:   "#FFFFFF",
    frosted: "rgba(255,255,255,0.85)",
    accent:  "linear-gradient(to bottom right, rgba(167,139,250,0.15), rgba(124,58,237,0.05))",
  };

  const shadows = {
    glass:   hovered && interactive ? CARD_HOV_SHADOW : CARD_SHADOW,
    solid:   hovered && interactive ? CARD_HOV_SHADOW : CARD_SHADOW,
    frosted: hovered && interactive ? CARD_HOV_SHADOW : CARD_SHADOW,
    accent:  hovered && interactive ? BTN_HOV_SHADOW  : BTN_SHADOW,
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: radius,
        padding,
        cursor: onClick ? "pointer" : "default",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        background: backgrounds[variant] || backgrounds.glass,
        boxShadow: shadows[variant] || shadows.glass,
        transform: interactive && hovered ? "translateY(-8px)" : "none",
        transition: "all 500ms ease-out",
        ...externalStyle,
      }}
    >
      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

// ── STAT ORB ──────────────────────────────────────────────────────────────────
// WHY: Stat orbs are circular clay objects — the most "pure" clay shape.
// They breathe (scale 1 → 1.02 cycle) and respond to hover with scale-110.
// The 4-layer orb shadow creates their spherical, floating quality.

export function StatOrb({ value, label, gradient = "linear-gradient(to bottom right, #A78BFA, #7C3AED)" }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 120, height: 120,
        borderRadius: "50%",
        background: gradient,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        boxShadow: "10px 10px 20px rgba(139,92,246,0.25), -8px -8px 16px rgba(255,255,255,0.90), inset 4px 4px 8px rgba(255,255,255,0.50), inset -4px -4px 8px rgba(0,0,0,0.08)",
        transform: hovered ? "scale(1.10)" : "scale(1)",
        transition: "transform 300ms ease-in-out",
        animation: "clay-breathe 6s ease-in-out infinite",
        cursor: "default",
      }}
    >
      <div style={{
        fontFamily: "Nunito, sans-serif", fontWeight: 900,
        fontSize: 24, color: "#FFFFFF", lineHeight: 1,
      }}>
        {value}
      </div>
      {label && (
        <div style={{
          fontFamily: "DM Sans, sans-serif", fontWeight: 500,
          fontSize: 10, color: "rgba(255,255,255,0.85)",
          marginTop: 4, textAlign: "center", lineHeight: 1.2,
        }}>
          {label}
        </div>
      )}
      <style>{`
        @keyframes clay-breathe {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
}

// ── ALERT ─────────────────────────────────────────────────────────────────────
// WHY: Alerts use the card shadow system but with semantic color tints.
// The glass background allows the canvas and blobs to show through,
// keeping alerts visually part of the clay world rather than
// harsh flat-colored notification boxes.

export function Alert({ type = "info", title, children, onDismiss }) {
  const types = {
    info:    { bg: "rgba(224,242,254,0.9)", border: "rgba(14,165,233,0.25)",  accent: "#0EA5E9", icon: "ℹ" },
    success: { bg: "rgba(209,250,229,0.9)", border: "rgba(16,185,129,0.25)", accent: "#10B981", icon: "✓" },
    warning: { bg: "rgba(254,243,199,0.9)", border: "rgba(245,158,11,0.25)", accent: "#F59E0B", icon: "!" },
    error:   { bg: "rgba(254,226,226,0.9)", border: "rgba(239,68,68,0.25)",  accent: "#EF4444", icon: "✕" },
  };
  const t = types[type] || types.info;

  return (
    <div style={{
      display: "flex", gap: 14, padding: "18px 20px",
      borderRadius: 20, backdropFilter: "blur(12px)",
      background: t.bg,
      border: `1.5px solid ${t.border}`,
      boxShadow: "8px 8px 16px rgba(160,150,180,0.12), -6px -6px 12px rgba(255,255,255,0.80), inset 3px 3px 6px rgba(255,255,255,0.60)",
      fontFamily: "DM Sans, sans-serif",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 12, flexShrink: 0,
        background: t.accent,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#FFFFFF", fontSize: 16, fontWeight: 700,
        boxShadow: `4px 4px 8px ${t.border}, -2px -2px 4px rgba(255,255,255,0.5)`,
      }}>
        {t.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div style={{
            fontFamily: "Nunito, sans-serif", fontSize: 15, fontWeight: 800,
            color: "#332F3A", marginBottom: children ? 4 : 0,
          }}>
            {title}
          </div>
        )}
        {children && (
          <div style={{ fontSize: 14, color: "#635F69", lineHeight: 1.5 }}>
            {children}
          </div>
        )}
      </div>

      {onDismiss && (
        <button onClick={onDismiss} style={{
          background: "none", border: "none",
          color: "#635F69", cursor: "pointer",
          fontSize: 18, lineHeight: 1,
          borderRadius: 8, padding: 4,
          transition: "color 150ms ease",
          flexShrink: 0,
        }}>×</button>
      )}
    </div>
  );
}

// ── USAGE ─────────────────────────────────────────────────────────────────────
// <Card>Simple floating card content</Card>
// <Card variant="solid" interactive={false} padding="40px">Non-interactive solid</Card>
// <Card variant="accent" radius={40}>Accent-tinted hero card</Card>
//
// <StatOrb value="99%" label="Uptime" />
// <StatOrb value="4.9★" gradient="linear-gradient(to br, #FCD34D, #F59E0B)" label="Rating" />
//
// <Alert type="success" title="Deployed!">Your site is live.</Alert>
// <Alert type="warning" title="Usage at 80%" onDismiss={() => {}}>Upgrade soon.</Alert>
// <Alert type="error" title="Build failed">Check your config.</Alert>
