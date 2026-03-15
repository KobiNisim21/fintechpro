// CLAY PREMIUM SKILL — Button.jsx
//
// WHY THIS LOOKS THE WAY IT DOES:
// The Clay Button is the most physically expressive element in this system.
// It simulates a soft silicone object that:
// 1. FLOATS above the canvas (outward 4-layer shadow at rest)
// 2. RISES toward the viewer on hover (-translate-y-1 + stronger shadow)
// 3. SQUISHES when pressed (scale-[0.92] + inset shadow)
//
// The gradient (light violet to vivid violet) simulates the convex surface
// catching ambient light at the top-left edge. A flat color doesn't have
// this highlight — it looks like a colored rectangle, not a clay object.
//
// The active:scale-[0.92] squish MUST remain at exactly 0.92.
// 0.95 is too subtle — you don't feel it.
// 0.88 is too extreme — it looks broken.
// 0.92 is the calibrated physical press.
//
// Button heights follow accessibility minimums:
// sm: 44px, default: 56px, lg: 64px.
// Never below 44px — clay objects are tactile and should be easy to grab.

import { useState } from "react";

const shadows = {
  clayButton:      "12px 12px 24px rgba(139,92,246,0.30), -8px -8px 16px rgba(255,255,255,0.40), inset 4px 4px 8px rgba(255,255,255,0.40), inset -4px -4px 8px rgba(0,0,0,0.10)",
  clayButtonHover: "16px 16px 32px rgba(139,92,246,0.40), -8px -8px 20px rgba(255,255,255,0.50), inset 4px 4px 8px rgba(255,255,255,0.40), inset -4px -4px 8px rgba(0,0,0,0.10)",
  clayPressed:     "inset 10px 10px 20px #D9D4E3, inset -10px -10px 20px #FFFFFF",
  clayCardHover:   "20px 20px 40px rgba(160,150,180,0.30), -12px -12px 28px rgba(255,255,255,0.95), inset 6px 6px 12px rgba(139,92,246,0.05), inset -6px -6px 12px rgba(255,255,255,1)",
};

const variants = {
  primary: {
    background:  "linear-gradient(to bottom right, #A78BFA, #7C3AED)",
    color:       "#FFFFFF",
    shadow:      shadows.clayButton,
    shadowHover: shadows.clayButtonHover,
    shadowActive:shadows.clayPressed,
  },
  secondary: {
    background:  "#FFFFFF",
    color:       "#332F3A",
    shadow:      shadows.clayButton.replace("rgba(139,92,246,0.30)", "rgba(160,150,180,0.20)").replace("rgba(139,92,246,0.40)", "rgba(160,150,180,0.30)"),
    shadowHover: shadows.clayCardHover,
    shadowActive:shadows.clayPressed,
  },
  outline: {
    background:  "transparent",
    color:       "#7C3AED",
    border:      "2px solid rgba(124,58,237,0.25)",
    shadow:      "none",
    shadowHover: "none",
    shadowActive:shadows.clayPressed,
    backgroundHover: "rgba(124,58,237,0.06)",
    borderHover: "2px solid rgba(124,58,237,0.60)",
  },
  ghost: {
    background:  "transparent",
    color:       "#332F3A",
    shadow:      "none",
    shadowHover: "none",
    shadowActive:shadows.clayPressed,
    backgroundHover: "rgba(124,58,237,0.08)",
    colorHover:  "#7C3AED",
  },
};

const sizes = {
  sm: { height: 44, padding: "0 20px", fontSize: 14, radius: 16 },
  md: { height: 56, padding: "0 28px", fontSize: 16, radius: 20 },
  lg: { height: 64, padding: "0 36px", fontSize: 18, radius: 24 },
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  iconPosition = "left",
  fullWidth = false,
  disabled = false,
  loading = false,
  onClick,
}) {
  const [state, setState] = useState("rest");
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;

  const isHover  = state === "hover";
  const isActive = state === "active";

  const shadow = isActive
    ? v.shadowActive
    : isHover
    ? v.shadowHover
    : v.shadow;

  const bg = isHover && v.backgroundHover ? v.backgroundHover : v.background;
  const color = isHover && v.colorHover ? v.colorHover : v.color;
  const border = isHover && v.borderHover ? v.borderHover : v.border || "none";

  return (
    <button
      onClick={!disabled && !loading ? onClick : undefined}
      onMouseEnter={() => !disabled && setState("hover")}
      onMouseLeave={() => setState("rest")}
      onMouseDown={() => !disabled && setState("active")}
      onMouseUp={() => setState(disabled ? "rest" : "hover")}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: s.height,
        padding: s.padding,
        fontSize: s.fontSize,
        fontFamily: "Nunito, sans-serif",
        fontWeight: 800,
        letterSpacing: "0.01em",
        borderRadius: s.radius,
        border,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        userSelect: "none",
        whiteSpace: "nowrap",
        outline: "none",
        width: fullWidth ? "100%" : undefined,
        background: bg,
        color,
        boxShadow: shadow,
        // The physical press transform — see philosophy.md
        transform: isActive
          ? "scale(0.92) translateY(1px)"
          : isHover
          ? "translateY(-4px)"
          : "none",
        transition: "all 200ms ease-in-out",
      }}
    >
      {loading ? (
        <span style={{
          width: 18, height: 18,
          border: "2.5px solid rgba(255,255,255,0.4)",
          borderTop: "2.5px solid #fff",
          borderRadius: "50%",
          animation: "clay-spin 500ms linear infinite",
          flexShrink: 0,
        }} />
      ) : (
        <>
          {Icon && iconPosition === "left"  && <Icon size={s.fontSize}     strokeWidth={2} />}
          {children}
          {Icon && iconPosition === "right" && <Icon size={s.fontSize}     strokeWidth={2} />}
        </>
      )}

      <style>{`
        @keyframes clay-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}

// ── USAGE ─────────────────────────────────────────────────────────────────────
// <Button variant="primary">Get started free</Button>
// <Button variant="primary" size="lg" icon={ArrowRight} iconPosition="right">Start building</Button>
// <Button variant="secondary">Learn more</Button>
// <Button variant="outline">View docs</Button>
// <Button variant="ghost">Cancel</Button>
// <Button loading>Processing...</Button>
// <Button fullWidth>Full width CTA</Button>
