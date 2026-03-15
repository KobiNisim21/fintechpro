// CLAY PREMIUM SKILL — Navbar.jsx
//
// WHY THIS LOOKS THE WAY IT DOES:
// The nav floats as an island at the top — it doesn't span the full
// browser width. Instead it is a pill-shaped or heavily rounded container
// that sits on the canvas, casting a card shadow below it.
//
// This "floating island" nav pattern perfectly expresses the clay physics:
// the nav is a clay object sitting on the surface, not a bar painted on it.
//
// Glass background (white/80 + backdrop-blur) lets the animated background
// blobs show through, keeping the nav connected to the canvas environment.
//
// The logo uses a gradient violet orb + Nunito Black text — communicating
// brand through the same visual language as the rest of the system.
//
// On mobile, the nav compresses and the links fold into a menu button.
// The menu panel uses the same glass-clay card treatment.

import { useState } from "react";
import { Menu, X } from "lucide-react";

const NAV_SHADOW = "16px 16px 32px rgba(160,150,180,0.20), -10px -10px 24px rgba(255,255,255,0.90), inset 6px 6px 12px rgba(139,92,246,0.03), inset -6px -6px 12px rgba(255,255,255,1.00)";
const BTN_SHADOW = "12px 12px 24px rgba(139,92,246,0.30), -8px -8px 16px rgba(255,255,255,0.40), inset 4px 4px 8px rgba(255,255,255,0.40), inset -4px -4px 8px rgba(0,0,0,0.10)";
const BTN_HOV   = "16px 16px 32px rgba(139,92,246,0.40), -8px -8px 20px rgba(255,255,255,0.50), inset 4px 4px 8px rgba(255,255,255,0.40), inset -4px -4px 8px rgba(0,0,0,0.10)";
const BTN_PRESS = "inset 10px 10px 20px #D9D4E3, inset -10px -10px 20px #FFFFFF";

export function Navbar({ brand = "Brand", links = [], ctaLabel = "Get started", onCtaClick }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovLink, setHovLink] = useState(null);
  const [ctaState, setCtaState] = useState("rest");

  return (
    <div style={{ padding: "16px 24px", position: "sticky", top: 0, zIndex: 100 }}>
      {/* Floating island nav */}
      <nav style={{
        maxWidth: 1100,
        margin: "0 auto",
        borderRadius: 40,
        height: 72,
        padding: "0 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(255,255,255,0.80)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: NAV_SHADOW,
        fontFamily: "DM Sans, sans-serif",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(to bottom right, #A78BFA, #7C3AED)",
            boxShadow: "6px 6px 12px rgba(139,92,246,0.35), -4px -4px 8px rgba(255,255,255,0.70), inset 2px 2px 4px rgba(255,255,255,0.5)",
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "Nunito, sans-serif", fontWeight: 900,
            fontSize: 20, color: "#332F3A", letterSpacing: "-0.02em",
          }}>
            {brand}
          </span>
        </div>

        {/* Desktop Links */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {links.map((link, i) => (
            <a
              key={i}
              href={link.href}
              onMouseEnter={() => setHovLink(i)}
              onMouseLeave={() => setHovLink(null)}
              style={{
                padding: "8px 18px",
                borderRadius: 20,
                fontSize: 15, fontWeight: hovLink === i ? 700 : 500,
                color: hovLink === i ? "#7C3AED" : "#332F3A",
                textDecoration: "none",
                background: hovLink === i ? "rgba(124,58,237,0.08)" : "transparent",
                transition: "all 200ms ease",
              }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onMouseEnter={() => setCtaState("hover")}
            onMouseLeave={() => setCtaState("rest")}
            onMouseDown={() => setCtaState("active")}
            onMouseUp={() => setCtaState("hover")}
            onClick={onCtaClick}
            style={{
              height: 48, padding: "0 24px",
              borderRadius: 20, border: "none",
              background: "linear-gradient(to bottom right, #A78BFA, #7C3AED)",
              color: "#FFFFFF",
              fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 15,
              cursor: "pointer",
              boxShadow: ctaState === "active" ? BTN_PRESS : ctaState === "hover" ? BTN_HOV : BTN_SHADOW,
              transform: ctaState === "active" ? "scale(0.92)" : ctaState === "hover" ? "translateY(-2px)" : "none",
              transition: "all 200ms ease-in-out",
              outline: "none",
            }}
          >
            {ctaLabel}
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              display: "none", // shown via @media in real impl
              width: 44, height: 44, borderRadius: 14,
              background: "rgba(255,255,255,0.6)", border: "none",
              cursor: "pointer", outline: "none",
              alignItems: "center", justifyContent: "center",
              boxShadow: "8px 8px 16px rgba(160,150,180,0.15), -6px -6px 12px rgba(255,255,255,0.90)",
              color: "#332F3A",
            }}
          >
            {mobileOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{
          marginTop: 8,
          maxWidth: 1100, margin: "8px auto 0",
          borderRadius: 32, padding: "16px 20px 20px",
          background: "rgba(255,255,255,0.90)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: NAV_SHADOW,
        }}>
          {links.map((link, i) => (
            <a key={i} href={link.href} style={{
              display: "block", padding: "12px 16px", borderRadius: 16,
              fontSize: 16, fontWeight: 600, color: "#332F3A",
              textDecoration: "none",
            }}>
              {link.label}
            </a>
          ))}
          <div style={{ marginTop: 12 }}>
            <button onClick={onCtaClick} style={{
              display: "block", width: "100%",
              height: 52, borderRadius: 20, border: "none",
              background: "linear-gradient(to bottom right, #A78BFA, #7C3AED)",
              color: "#FFFFFF",
              fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 16,
              cursor: "pointer", boxShadow: BTN_SHADOW,
            }}>
              {ctaLabel}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          nav > div:last-child > button:last-child { display: flex !important; }
          nav > div:nth-child(2) { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── USAGE ─────────────────────────────────────────────────────────────────────
// <Navbar
//   brand="Drip"
//   links={[
//     { label: "Skills",  href: "/skills" },
//     { label: "Pricing", href: "/pricing" },
//     { label: "Docs",    href: "/docs" },
//   ]}
//   ctaLabel="Get started free"
//   onCtaClick={() => router.push("/signup")}
// />
