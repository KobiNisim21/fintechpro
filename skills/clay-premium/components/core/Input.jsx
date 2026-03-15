// CLAY PREMIUM SKILL — Input.jsx
//
// WHY THIS LOOKS THE WAY IT DOES:
// Inputs are CONCAVE — they press INTO the clay surface.
// This is the physical opposite of buttons (convex, bulging out).
//
// The recessed background (#EFEBF5) is slightly darker than the canvas.
// This creates the visual depth of a depression in the material.
//
// The inset shadow system (shadow-clayPressed) simulates:
// - Top-left interior shadow: dark area where the clay cups inward
// - Bottom-right interior highlight: light catching the opposite wall
//
// On focus, the input TRANSFORMS: it brightens to white (#FFFFFF),
// and gains a violet focus ring. The transition from recessed dark
// to elevated white communicates "this surface is now active."
//
// This convex/concave contrast between buttons and inputs is the core
// clay physics principle. Never give inputs outward shadows.

import { useState } from "react";

export function Input({
  label,
  placeholder = "",
  value,
  onChange,
  type = "text",
  error,
  hint,
  disabled = false,
  required = false,
  icon: Icon,
  prefix,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: "DM Sans, sans-serif" }}>
      {label && (
        <label style={{
          fontSize: 14,
          fontWeight: 700,
          color: error ? "#E11D48" : "#332F3A",
          letterSpacing: "0.01em",
          fontFamily: "Nunito, sans-serif",
        }}>
          {label}
          {required && <span style={{ color: "#7C3AED", marginLeft: 3 }}>*</span>}
        </label>
      )}

      <div style={{ position: "relative" }}>
        {/* Left icon */}
        {Icon && (
          <div style={{
            position: "absolute", left: 20, top: "50%",
            transform: "translateY(-50%)",
            color: focused ? "#7C3AED" : "#635F69",
            transition: "color 200ms ease",
            pointerEvents: "none",
          }}>
            <Icon size={20} strokeWidth={2} />
          </div>
        )}

        {/* Prefix text */}
        {prefix && (
          <div style={{
            position: "absolute", left: 20, top: "50%",
            transform: "translateY(-50%)",
            color: "#635F69", fontSize: 16, fontWeight: 500,
            pointerEvents: "none",
          }}>
            {prefix}
          </div>
        )}

        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            height: 64,
            padding: `0 ${Icon || prefix ? 52 : 24}px`,
            fontSize: 16,
            fontFamily: "DM Sans, sans-serif",
            fontWeight: 500,
            color: "#332F3A",
            border: "none",
            outline: "none",
            borderRadius: 16,
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? "not-allowed" : "text",
            // CONCAVE: recessed into the clay surface
            background: focused ? "#FFFFFF" : "#EFEBF5",
            boxShadow: error
              ? "inset 10px 10px 20px rgba(225,29,72,0.15), inset -10px -10px 20px rgba(255,255,255,0.8), 0 0 0 3px rgba(225,29,72,0.25)"
              : focused
              ? "inset 10px 10px 20px #D9D4E3, inset -10px -10px 20px #FFFFFF, 0 0 0 4px rgba(124,58,237,0.20)"
              : "inset 10px 10px 20px #D9D4E3, inset -10px -10px 20px #FFFFFF",
            transition: "all 200ms ease-in-out",
          }}
        />
      </div>

      {error && (
        <span style={{ fontSize: 13, color: "#E11D48", fontWeight: 500 }}>{error}</span>
      )}
      {hint && !error && (
        <span style={{ fontSize: 13, color: "#635F69" }}>{hint}</span>
      )}
    </div>
  );
}

// ── BADGE ─────────────────────────────────────────────────────────────────────
// WHY: Badges are pill-shaped (rounded-full) — the most extreme radius in
// the system. They communicate "tag" or "label" through their fully rounded
// shape. They are small clay objects with their own subtle shadow.
//
// The vibrant solid color backgrounds vs. the pale canvas create the
// candy-store contrast that defines this palette. Each variant uses
// a distinct saturated background color.

export function Badge({ children, variant = "default", dot = false, size = "md" }) {
  const variants = {
    default: {
      bg: "#EDE9FE",
      color: "#6D28D9",
      border: "1px solid rgba(124,58,237,0.15)",
    },
    primary: {
      bg: "linear-gradient(to bottom right, #A78BFA, #7C3AED)",
      color: "#FFFFFF",
      border: "none",
    },
    success: {
      bg: "#D1FAE5",
      color: "#065F46",
      border: "1px solid rgba(16,185,129,0.15)",
    },
    warning: {
      bg: "#FEF3C7",
      color: "#92400E",
      border: "1px solid rgba(245,158,11,0.20)",
    },
    error: {
      bg: "#FEE2E2",
      color: "#991B1B",
      border: "1px solid rgba(239,68,68,0.15)",
    },
    info: {
      bg: "#E0F2FE",
      color: "#0C4A6E",
      border: "1px solid rgba(14,165,233,0.15)",
    },
    pink: {
      bg: "#FCE7F3",
      color: "#9D174D",
      border: "1px solid rgba(219,39,119,0.15)",
    },
  };

  const sizes = {
    sm: { padding: "3px 10px", fontSize: 11, gap: 4 },
    md: { padding: "5px 14px", fontSize: 13, gap: 5 },
    lg: { padding: "7px 18px", fontSize: 14, gap: 6 },
  };

  const v = variants[variant] || variants.default;
  const s = sizes[size] || sizes.md;

  const dotColor =
    variant === "success" ? "#10B981"  :
    variant === "warning" ? "#F59E0B"  :
    variant === "error"   ? "#EF4444"  :
    variant === "info"    ? "#0EA5E9"  :
    variant === "pink"    ? "#DB2777"  :
    variant === "primary" ? "#FFFFFF"  :
    "#7C3AED";

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: s.gap,
      padding: s.padding,
      borderRadius: 9999,
      fontSize: s.fontSize,
      fontFamily: "Nunito, sans-serif",
      fontWeight: 800,
      letterSpacing: "0.01em",
      whiteSpace: "nowrap",
      background: v.bg,
      color: v.color,
      border: v.border || "none",
    }}>
      {dot && (
        <span style={{
          width: 6, height: 6,
          borderRadius: "50%",
          background: dotColor,
          flexShrink: 0,
        }} />
      )}
      {children}
    </span>
  );
}

// ── USAGE ─────────────────────────────────────────────────────────────────────
// <Input label="Email" type="email" placeholder="you@example.com" required />
// <Input label="Password" type="password" icon={Lock} error="Incorrect password" />
// <Input label="URL" prefix="https://" placeholder="yoursite.com" />
// <Input hint="We never share your email" />
//
// <Badge>Default</Badge>
// <Badge variant="primary">Featured</Badge>
// <Badge variant="success" dot>Active</Badge>
// <Badge variant="warning" dot>Pending</Badge>
// <Badge variant="error">Error</Badge>
// <Badge variant="pink" size="lg">New</Badge>
