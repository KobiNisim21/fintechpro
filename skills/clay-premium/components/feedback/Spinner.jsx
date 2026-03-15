// CLAY PREMIUM SKILL — Spinner.jsx
//
// WHY THIS LOOKS THE WAY IT DOES:
// The clay spinner uses a pulsing circular orb rather than a thin arc.
// This matches the "clay breathe" animation aesthetic — objects in this world
// expand and contract slightly, simulating inflation.
//
// The dual-ring progress bar has a pastel track (recessed inset shadow)
// and a vivid gradient fill, matching the convex/concave principle.
// The fill is convex (outward shadow), the track is concave (inset shadow).

export function Spinner({ size = "md", label, color = "#7C3AED" }) {
  const sizes = {
    sm: { ring: 24, stroke: 2.5 },
    md: { ring: 40, stroke: 3   },
    lg: { ring: 56, stroke: 4   },
    xl: { ring: 72, stroke: 5   },
  };
  const s = sizes[size] || sizes.md;
  const r = (s.ring / 2) - s.stroke;
  const circ = 2 * Math.PI * r;

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 12,
      fontFamily: "DM Sans, sans-serif",
    }}>
      <svg
        width={s.ring} height={s.ring}
        viewBox={`0 0 ${s.ring} ${s.ring}`}
        style={{ animation: "clay-spin 700ms linear infinite", flexShrink: 0 }}
      >
        {/* Track — recessed pastel */}
        <circle
          cx={s.ring / 2} cy={s.ring / 2} r={r}
          fill="none"
          stroke="#EFEBF5"
          strokeWidth={s.stroke}
        />
        {/* Arc — vivid color, 75% visible */}
        <circle
          cx={s.ring / 2} cy={s.ring / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={s.stroke}
          strokeLinecap="round"
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
          strokeDashoffset={circ * 0.25}
          style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
        />
      </svg>

      {label && (
        <span style={{
          fontSize: 14, fontWeight: 600, color: "#635F69",
          fontFamily: "Nunito, sans-serif",
        }}>
          {label}
        </span>
      )}

      <style>{`
        @keyframes clay-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ── PROGRESS BAR ─────────────────────────────────────────────────────────────

export function ProgressBar({ value = 0, label, showPercent = true, color = "#7C3AED", size = "md" }) {
  const heights = { sm: 8, md: 12, lg: 18 };
  const h = heights[size] || heights.md;

  return (
    <div style={{ fontFamily: "DM Sans, sans-serif" }}>
      {(label || showPercent) && (
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 10,
        }}>
          {label && (
            <span style={{
              fontSize: 14, fontWeight: 700, color: "#332F3A",
              fontFamily: "Nunito, sans-serif",
            }}>
              {label}
            </span>
          )}
          {showPercent && (
            <span style={{
              fontSize: 14, fontWeight: 800, color: color,
              fontFamily: "Nunito, sans-serif",
            }}>
              {value}%
            </span>
          )}
        </div>
      )}

      {/* Track — concave (recessed) */}
      <div style={{
        height: h,
        borderRadius: 9999,
        background: "#EFEBF5",
        boxShadow: "inset 4px 4px 8px #D9D4E3, inset -4px -4px 8px #FFFFFF",
        overflow: "hidden",
      }}>
        {/* Fill — convex (bulging) */}
        <div style={{
          height: "100%",
          width: `${value}%`,
          borderRadius: 9999,
          background: `linear-gradient(to right, ${color}99, ${color})`,
          boxShadow: `0 2px 8px ${color}50, inset 0 1px 0 rgba(255,255,255,0.4)`,
          transition: "width 600ms ease-out",
        }} />
      </div>
    </div>
  );
}

// ── SKELETON ─────────────────────────────────────────────────────────────────

export function Skeleton({ width = "100%", height = 20, radius = 12 }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg, #EFEBF5 25%, #E8E2F4 50%, #EFEBF5 75%)",
      backgroundSize: "200% 100%",
      animation: "clay-shimmer 1.5s ease-in-out infinite",
    }}>
      <style>{`
        @keyframes clay-shimmer {
          from { background-position: 200% 0; }
          to   { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ── USAGE ─────────────────────────────────────────────────────────────────────
// <Spinner size="md" />
// <Spinner size="lg" label="Deploying your site..." color="#10B981" />
//
// <ProgressBar value={72} label="Storage used" />
// <ProgressBar value={100} color="#10B981" size="sm" />
//
// <Skeleton width={240} height={20} />
// <Skeleton width="100%" height={80} radius={24} />
