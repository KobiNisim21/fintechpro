// CLAY PREMIUM SKILL — LandingPage.jsx
// THE NORTH STAR EXAMPLE
//
// What to notice in each section:
// - BACKGROUND: #F4F1FA canvas + 3 animated blobs with blur-3xl. Never flat.
// - NAVBAR: Floating island pill — not a full-width bar. Clay card shadow.
// - HERO: Nunito Black gradient headline. Orbiting float shapes. Two CTAs stacked mobile, row desktop.
// - FEATURES BENTO: Asymmetric grid. Hero card 2×2. Never uniform.
// - STATS: Four stat orbs with clay shadow + breathe animation.
// - BENEFITS: Icon gradient containers (rotate per icon). Check icons in emerald circles.
// - PRICING: Featured card elevated with scale + accent shadow. "Popular" badge floating above.
// - CTA BANNER: Deep clay surface shadow on the hero panel.
// - FOOTER: Matches nav island style. Mini gradient orb logo.
//
// Critical interactions to verify before shipping:
// 1. Buttons squish on click (scale-[0.92] + inset shadow)
// 2. Cards rise on hover (translateY -8px)
// 3. Blobs animate (check animation-fill-mode)
// 4. Nunito Black renders on all headings
// 5. No text lighter than #635F69

import { useState } from "react";
import { Zap, Shield, BarChart, Palette, Code, Globe, ArrowRight, Check, Star } from "lucide-react";

// ── TOKENS ────────────────────────────────────────────────────────────────────
const t = {
  canvas:   "#F4F1FA",
  fg:       "#332F3A",
  muted:    "#635F69",
  accent:   "#7C3AED",
  accentAlt:"#DB2777",
  success:  "#10B981",
  warning:  "#F59E0B",
};

const SHADOWS = {
  card:     "16px 16px 32px rgba(160,150,180,0.20), -10px -10px 24px rgba(255,255,255,0.90), inset 6px 6px 12px rgba(139,92,246,0.03), inset -6px -6px 12px rgba(255,255,255,1.00)",
  cardHov:  "20px 20px 40px rgba(160,150,180,0.30), -12px -12px 28px rgba(255,255,255,0.95), inset 6px 6px 12px rgba(139,92,246,0.05), inset -6px -6px 12px rgba(255,255,255,1.00)",
  btn:      "12px 12px 24px rgba(139,92,246,0.30), -8px -8px 16px rgba(255,255,255,0.40), inset 4px 4px 8px rgba(255,255,255,0.40), inset -4px -4px 8px rgba(0,0,0,0.10)",
  btnHov:   "16px 16px 32px rgba(139,92,246,0.40), -8px -8px 20px rgba(255,255,255,0.50), inset 4px 4px 8px rgba(255,255,255,0.40), inset -4px -4px 8px rgba(0,0,0,0.10)",
  btnPress: "inset 10px 10px 20px #D9D4E3, inset -10px -10px 20px #FFFFFF",
  orb:      "10px 10px 20px rgba(139,92,246,0.25), -8px -8px 16px rgba(255,255,255,0.90), inset 4px 4px 8px rgba(255,255,255,0.50), inset -4px -4px 8px rgba(0,0,0,0.08)",
  deep:     "30px 30px 60px #CDC6D9, -30px -30px 60px #FFFFFF, inset 10px 10px 20px rgba(139,92,246,0.05), inset -10px -10px 20px rgba(255,255,255,0.8)",
};

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Sans:wght@400;500;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "DM Sans", system-ui, sans-serif; background: #F4F1FA; color: #332F3A; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  ::selection { background: rgba(124,58,237,0.2); }
  a { text-decoration: none; }

  @keyframes clay-float          { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-20px) rotate(2deg)} }
  @keyframes clay-float-delayed  { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-15px) rotate(-2deg)} }
  @keyframes clay-float-slow     { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-30px) rotate(5deg)} }
  @keyframes clay-breathe        { 0%,100%{transform:scale(1)} 50%{transform:scale(1.02)} }
  @keyframes clay-fade-up        { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes clay-spin           { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

  .blob-1 { animation: clay-float 8s ease-in-out infinite; }
  .blob-2 { animation: clay-float-delayed 10s ease-in-out infinite; animation-delay: 2s; }
  .blob-3 { animation: clay-float-slow 12s ease-in-out infinite; animation-delay: 4s; }
  .orb    { animation: clay-breathe 6s ease-in-out infinite; }
  .fade-up{ animation: clay-fade-up 0.6s ease-out both; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
`;

// ── CLAY BUTTON COMPONENT (local) ─────────────────────────────────────────────
function ClayBtn({ children, icon: Icon, variant = "primary", size = "md", fullWidth = false, onClick }) {
  const [state, setState] = useState("rest");
  const isPrimary = variant === "primary";
  const isHov = state === "hover";
  const isAct = state === "active";

  return (
    <button
      onMouseEnter={() => setState("hover")}
      onMouseLeave={() => setState("rest")}
      onMouseDown={() => setState("active")}
      onMouseUp={() => setState("hover")}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        height: size === "lg" ? 64 : size === "sm" ? 44 : 56,
        padding: size === "lg" ? "0 36px" : "0 28px",
        borderRadius: 20, border: "none",
        background: isPrimary
          ? "linear-gradient(to bottom right, #A78BFA, #7C3AED)"
          : "rgba(255,255,255,0.80)",
        color: isPrimary ? "#FFFFFF" : t.fg,
        fontFamily: "Nunito, sans-serif",
        fontWeight: 800,
        fontSize: size === "lg" ? 18 : size === "sm" ? 14 : 16,
        boxShadow: isAct ? SHADOWS.btnPress : isHov ? SHADOWS.btnHov : SHADOWS.btn,
        transform: isAct ? "scale(0.92)" : isHov ? "translateY(-4px)" : "none",
        transition: "all 200ms ease-in-out",
        cursor: "pointer", outline: "none",
        width: fullWidth ? "100%" : "auto",
      }}
    >
      {children}
      {Icon && <Icon size={18} strokeWidth={2} />}
    </button>
  );
}

// ── CLAY CARD COMPONENT (local) ───────────────────────────────────────────────
function ClayCard({ children, interactive = true, radius = 32, padding = "32px", shadow = SHADOWS.card, style: ext }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative", overflow: "hidden",
        borderRadius: radius, padding,
        background: "rgba(255,255,255,0.70)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        boxShadow: interactive && hov ? SHADOWS.cardHov : shadow,
        transform: interactive && hov ? "translateY(-8px)" : "none",
        transition: "all 500ms ease-out",
        ...ext,
      }}
    >
      <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

// ── GRADIENT ICON ORB ─────────────────────────────────────────────────────────
function IconOrb({ icon: Icon, gradient = "linear-gradient(to bottom right, #A78BFA, #7C3AED)", size = 48 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 16,
      background: gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "6px 6px 12px rgba(160,150,180,0.25), -4px -4px 8px rgba(255,255,255,0.80), inset 2px 2px 4px rgba(255,255,255,0.50)",
      flexShrink: 0,
    }}>
      <Icon size={Math.floor(size * 0.48)} strokeWidth={2} color="#FFFFFF" />
    </div>
  );
}

// ── BACKGROUND ────────────────────────────────────────────────────────────────
function Blobs() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div className="blob-1" style={{
        position: "absolute", width: "60vh", height: "60vh", borderRadius: "50%",
        background: "rgba(139,92,246,0.10)", filter: "blur(80px)",
        top: "-10%", left: "-10%",
      }} />
      <div className="blob-2" style={{
        position: "absolute", width: "60vh", height: "60vh", borderRadius: "50%",
        background: "rgba(236,72,153,0.10)", filter: "blur(80px)",
        top: "-10%", right: "-10%",
      }} />
      <div className="blob-3" style={{
        position: "absolute", width: "50vh", height: "50vh", borderRadius: "50%",
        background: "rgba(14,165,233,0.08)", filter: "blur(60px)",
        top: "30%", left: "5%",
      }} />
    </div>
  );
}

// ── NAV ───────────────────────────────────────────────────────────────────────
function Nav() {
  const [hov, setHov] = useState(null);
  const links = ["Skills", "Pricing", "Docs", "Blog"];

  return (
    <div style={{ padding: "16px 24px", position: "sticky", top: 0, zIndex: 100 }}>
      <nav style={{
        maxWidth: 1100, margin: "0 auto",
        borderRadius: 40, height: 72, padding: "0 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.80)",
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        boxShadow: SHADOWS.card,
        fontFamily: "DM Sans, sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="orb" style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(to bottom right, #A78BFA, #7C3AED)",
            boxShadow: "6px 6px 12px rgba(139,92,246,0.35), -4px -4px 8px rgba(255,255,255,0.70)",
          }} />
          <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: 20, color: t.fg }}>Drip</span>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {links.map((l, i) => (
            <a key={l} href="#"
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
              style={{
                padding: "8px 18px", borderRadius: 20,
                fontSize: 15, fontWeight: hov === i ? 700 : 500,
                color: hov === i ? t.accent : t.fg,
                background: hov === i ? "rgba(124,58,237,0.08)" : "transparent",
                transition: "all 200ms ease",
              }}>{l}</a>
          ))}
        </div>

        <ClayBtn size="sm">Get started free</ClayBtn>
      </nav>
    </div>
  );
}

// ── HERO ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ padding: "60px 24px 80px", textAlign: "center", position: "relative", zIndex: 1 }}>
      {/* Orbiting decorative orbs */}
      <div style={{
        position: "absolute", top: 20, left: "10%",
        width: 80, height: 80, borderRadius: "50%",
        background: "linear-gradient(to bottom right, #FCD34D, #F59E0B)",
        boxShadow: SHADOWS.orb, opacity: 0.9,
      }} className="blob-1" />
      <div style={{
        position: "absolute", top: 60, right: "12%",
        width: 60, height: 60, borderRadius: "50%",
        background: "linear-gradient(to bottom right, #6EE7B7, #10B981)",
        boxShadow: SHADOWS.orb, opacity: 0.85,
      }} className="blob-2" />
      <div style={{
        position: "absolute", bottom: 40, left: "18%",
        width: 50, height: 50, borderRadius: 16,
        background: "linear-gradient(to bottom right, #93C5FD, #3B82F6)",
        boxShadow: SHADOWS.orb, opacity: 0.8,
      }} className="blob-3" />

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Eyebrow badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 20px", borderRadius: 9999,
            background: "#EDE9FE", color: "#6D28D9",
            fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 14,
            boxShadow: "6px 6px 12px rgba(160,150,180,0.15), -4px -4px 8px rgba(255,255,255,0.80)",
          }}>
            <span style={{ fontSize: 16 }}>🎨</span>
            Give your app the design it deserves
          </div>
        </div>

        {/* Headline — Nunito Black with gradient */}
        <h1 style={{
          fontFamily: "Nunito, sans-serif", fontWeight: 900,
          fontSize: "clamp(48px, 8vw, 96px)",
          lineHeight: 1.08, letterSpacing: "-0.03em",
          marginBottom: 28,
        }}>
          <span style={{ color: t.fg }}>Stop shipping</span><br />
          <span style={{
            background: `linear-gradient(to right, ${t.fg} 5%, ${t.accent} 45%, ${t.accentAlt} 100%)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            generic UIs.
          </span>
        </h1>

        {/* Subtext */}
        <p style={{
          fontSize: "clamp(17px, 2vw, 21px)", color: t.muted, lineHeight: 1.7,
          maxWidth: 560, margin: "0 auto 48px", fontWeight: 500,
        }}>
          Complete design systems for AI-built projects. One command places
          a full skill in your project. Every component your agent builds
          from that moment belongs to the same world.
        </p>

        {/* CTAs */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 64 }}>
          <ClayBtn size="lg" icon={ArrowRight}>Browse skills</ClayBtn>
          <ClayBtn variant="secondary" size="lg">Read the docs</ClayBtn>
        </div>

        {/* Command pill */}
        <div style={{
          display: "inline-flex", alignItems: "center",
          borderRadius: 20, overflow: "hidden",
          boxShadow: SHADOWS.card,
          background: "rgba(255,255,255,0.80)",
          backdropFilter: "blur(16px)",
        }}>
          <div style={{
            padding: "14px 20px",
            background: "#EDE9FE",
            borderRight: "1px solid rgba(124,58,237,0.12)",
            fontSize: 13, fontFamily: "monospace",
            color: t.accent, fontWeight: 700,
          }}>$</div>
          <div style={{
            padding: "14px 24px",
            fontSize: 14, fontFamily: "monospace",
            color: t.fg, letterSpacing: "0.02em",
          }}>
            npx getdrip add clay-premium
          </div>
        </div>
      </div>
    </section>
  );
}

// ── STATS ─────────────────────────────────────────────────────────────────────
function Stats() {
  const stats = [
    { value: "12+",  label: "Design Skills", grad: "linear-gradient(to br, #A78BFA, #7C3AED)" },
    { value: "15+",  label: "Components",    grad: "linear-gradient(to br, #F472B6, #DB2777)" },
    { value: "1",    label: "Command",       grad: "linear-gradient(to br, #34D399, #10B981)" },
    { value: "∞",    label: "Consistency",   grad: "linear-gradient(to br, #38BDF8, #0EA5E9)" },
  ];

  return (
    <section style={{ padding: "40px 24px 80px", position: "relative", zIndex: 1 }}>
      <div style={{
        maxWidth: 900, margin: "0 auto",
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: 24, justifyItems: "center",
      }}>
        {stats.map((s, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            {/* Stat orb */}
            <div className="orb" style={{
              width: 110, height: 110, borderRadius: "50%",
              background: s.grad,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              boxShadow: SHADOWS.orb,
            }}>
              <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: 26, color: "#FFF", lineHeight: 1 }}>{s.value}</div>
            </div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 14, color: t.muted, textAlign: "center" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── FEATURES BENTO ────────────────────────────────────────────────────────────
const ICON_GRADS = [
  "linear-gradient(to bottom right, #A78BFA, #7C3AED)",
  "linear-gradient(to bottom right, #F472B6, #DB2777)",
  "linear-gradient(to bottom right, #34D399, #10B981)",
  "linear-gradient(to bottom right, #38BDF8, #0EA5E9)",
  "linear-gradient(to bottom right, #FCD34D, #F59E0B)",
  "linear-gradient(to bottom right, #818CF8, #6366F1)",
];

const FEATURES = [
  { icon: Palette, title: "Complete design worlds", body: "Colors, typography, spacing, motion, and 15+ annotated components. The agent understands intent, not just code snippets.", hero: true },
  { icon: Code,    title: "Agent-native structure", body: "Philosophy before tokens. Examples as the north star.", hero: false },
  { icon: Zap,     title: "One command install",    body: "npx getdrip add places the skill exactly where it needs to be.", hero: false },
  { icon: Shield,  title: "Persistent context",     body: "The skill stays in your project forever.", hero: false },
  { icon: BarChart,"title": "Growing library",      body: "New aesthetics added regularly.", hero: false },
  { icon: Globe,   title: "Works everywhere",       body: "Cursor, Lovable, Claude Code, Bolt.", hero: false },
];

function FeatureCard({ feature, index }) {
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        gridColumn: feature.hero ? "span 2" : "span 1",
        gridRow: feature.hero ? "span 2" : "span 1",
        position: "relative", overflow: "hidden",
        borderRadius: 32, padding: feature.hero ? 40 : 28,
        background: "rgba(255,255,255,0.70)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        boxShadow: hov ? SHADOWS.cardHov : SHADOWS.card,
        transform: hov ? "translateY(-8px) scale(1.01)" : "none",
        transition: "all 500ms ease-out",
      }}
    >
      <IconOrb
        icon={feature.icon}
        gradient={ICON_GRADS[index % ICON_GRADS.length]}
        size={feature.hero ? 60 : 48}
      />
      <h3 style={{
        fontFamily: "Nunito, sans-serif", fontWeight: 800,
        fontSize: feature.hero ? 28 : 18, color: t.fg,
        marginTop: 20, marginBottom: 10,
        lineHeight: 1.2,
      }}>
        {feature.title}
      </h3>
      <p style={{ fontSize: 15, color: t.muted, lineHeight: 1.65 }}>
        {feature.body}
      </p>
    </div>
  );
}

function Features() {
  return (
    <>
      <section style={{ padding: "80px 24px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 16px", borderRadius: 9999, marginBottom: 20,
              background: "#EDE9FE", color: t.accent,
              fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 13,
            }}>
              ✦ Features
            </div>
            <h2 style={{
              fontFamily: "Nunito, sans-serif", fontWeight: 900,
              fontSize: "clamp(32px, 5vw, 56px)", color: t.fg,
              letterSpacing: "-0.03em", lineHeight: 1.1,
            }}>
              Everything your agent needs
            </h2>
          </div>

          {/* Asymmetric bento — hero card is 2×2 */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridAutoRows: "180px",
            gap: 20,
          }}>
            {FEATURES.map((f, i) => <FeatureCard key={i} feature={f} index={i} />)}
          </div>
        </div>
      </section>
    </>
  );
}

// ── PRICING ───────────────────────────────────────────────────────────────────
function Pricing() {
  const plans = [
    {
      name: "Free", price: "$0", period: "forever",
      desc: "For getting started",
      features: ["3 free skills", "npx getdrip add", "MIT license", "Community"],
      featured: false,
    },
    {
      name: "Pro", price: "$12", period: "/month",
      desc: "For serious builders",
      features: ["All 12+ skills", "Priority updates", "New skills first", "Commercial license", "Email support"],
      featured: true,
    },
    {
      name: "Team", price: "$39", period: "/month",
      desc: "For teams that ship",
      features: ["Everything in Pro", "5 team members", "Shared config", "Slack support", "Custom skills"],
      featured: false,
    },
  ];

  return (
    <section style={{ padding: "80px 24px", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 16px", borderRadius: 9999, marginBottom: 20,
            background: "#FCE7F3", color: t.accentAlt,
            fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 13,
          }}>
            ✦ Pricing
          </div>
          <h2 style={{
            fontFamily: "Nunito, sans-serif", fontWeight: 900,
            fontSize: "clamp(32px, 5vw, 52px)", color: t.fg,
            letterSpacing: "-0.03em", lineHeight: 1.1,
          }}>
            Start free. Upgrade when ready.
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, alignItems: "center" }}>
          {plans.map((p, i) => {
            const [hov, setHov] = useState(false);
            return (
              <div key={i} style={{ position: "relative" }}>
                {/* Floating badge above featured card */}
                {p.featured && (
                  <div style={{
                    position: "absolute", top: -16, left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 10, whiteSpace: "nowrap",
                    padding: "6px 18px", borderRadius: 9999,
                    background: "linear-gradient(to right, #A78BFA, #7C3AED)",
                    color: "#FFFFFF",
                    fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 13,
                    boxShadow: SHADOWS.btn,
                  }}>
                    ⭐ Most Popular
                  </div>
                )}

                <div
                  onMouseEnter={() => setHov(true)}
                  onMouseLeave={() => setHov(false)}
                  style={{
                    borderRadius: 32, padding: "36px 28px",
                    background: p.featured
                      ? "linear-gradient(to bottom, rgba(167,139,250,0.18), rgba(255,255,255,0.85))"
                      : "rgba(255,255,255,0.70)",
                    backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                    boxShadow: p.featured ? SHADOWS.btnHov : (hov ? SHADOWS.cardHov : SHADOWS.card),
                    transform: p.featured
                      ? (hov ? "translateY(-10px) scale(1.03)" : "scale(1.04)")
                      : (hov ? "translateY(-6px)" : "none"),
                    transition: "all 400ms ease-out",
                  }}
                >
                  <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: 20, color: t.fg, marginBottom: 6 }}>{p.name}</div>
                  <div style={{ fontSize: 14, color: t.muted, marginBottom: 24, fontWeight: 500 }}>{p.desc}</div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 28 }}>
                    <span style={{
                      fontFamily: "Nunito, sans-serif", fontWeight: 900,
                      fontSize: 52, color: t.fg, lineHeight: 1,
                      letterSpacing: "-0.04em",
                    }}>{p.price}</span>
                    <span style={{ fontSize: 14, color: t.muted, fontWeight: 500 }}>{p.period}</span>
                  </div>

                  <ClayBtn
                    variant={p.featured ? "primary" : "secondary"}
                    fullWidth
                    size="md"
                  >
                    {p.name === "Free" ? "Start free" : `Choose ${p.name}`}
                  </ClayBtn>

                  <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                    {p.features.map(f => (
                      <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: "50%",
                          background: "#D1FAE5",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          boxShadow: "3px 3px 6px rgba(16,185,129,0.15), -2px -2px 4px rgba(255,255,255,0.80)",
                        }}>
                          <Check size={11} strokeWidth={2.5} color={t.success} />
                        </div>
                        <span style={{ fontSize: 14, color: t.muted, fontWeight: 500 }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── CTA SECTION ───────────────────────────────────────────────────────────────
function CTA() {
  return (
    <section style={{ padding: "80px 24px 120px", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{
          borderRadius: 60, padding: "64px 48px", textAlign: "center",
          background: "rgba(255,255,255,0.75)",
          backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          boxShadow: SHADOWS.deep,
          position: "relative", overflow: "hidden",
        }}>
          {/* Decorative blobs inside the panel */}
          <div style={{
            position: "absolute", width: 200, height: 200, borderRadius: "50%",
            background: "rgba(167,139,250,0.15)", filter: "blur(40px)",
            top: -40, left: -40, pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", width: 160, height: 160, borderRadius: "50%",
            background: "rgba(236,72,153,0.10)", filter: "blur(30px)",
            bottom: -30, right: -30, pointerEvents: "none",
          }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 16px", borderRadius: 9999, marginBottom: 24,
              background: "#EDE9FE", color: t.accent,
              fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 13,
            }}>
              ✦ Get started
            </div>

            <h2 style={{
              fontFamily: "Nunito, sans-serif", fontWeight: 900,
              fontSize: "clamp(32px, 5vw, 60px)", lineHeight: 1.08,
              letterSpacing: "-0.03em", marginBottom: 20,
            }}>
              <span style={{ color: t.fg }}>Give your app the design</span><br />
              <span style={{
                background: `linear-gradient(to right, ${t.accent}, ${t.accentAlt})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                it deserves.
              </span>
            </h2>

            <p style={{
              fontSize: 18, color: t.muted, lineHeight: 1.7,
              maxWidth: 480, margin: "0 auto 40px", fontWeight: 500,
            }}>
              One command. Your entire project gets a real design system.
            </p>

            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
              <ClayBtn size="lg" icon={ArrowRight}>Browse skills</ClayBtn>
              <ClayBtn variant="secondary" size="lg">Read the docs</ClayBtn>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function Footer() {
  const [hov, setHov] = useState(null);
  const links = ["Skills", "Docs", "GitHub", "npm"];

  return (
    <div style={{ padding: "0 24px 32px", position: "relative", zIndex: 1 }}>
      <footer style={{
        maxWidth: 1100, margin: "0 auto",
        borderRadius: 32, height: 72, padding: "0 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.60)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        boxShadow: SHADOWS.card,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(to bottom right, #A78BFA, #7C3AED)",
            boxShadow: "4px 4px 8px rgba(139,92,246,0.30), -2px -2px 4px rgba(255,255,255,0.70)",
          }} />
          <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: 16, color: t.fg }}>Drip</span>
        </div>

        <span style={{ fontSize: 13, color: t.muted, fontWeight: 500 }}>
          © 2024 Drip
        </span>

        <div style={{ display: "flex", gap: 4 }}>
          {links.map((l, i) => (
            <a key={l} href="#"
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
              style={{
                padding: "6px 14px", borderRadius: 14,
                fontSize: 14, fontWeight: hov === i ? 700 : 500,
                color: hov === i ? t.accent : t.muted,
                background: hov === i ? "rgba(124,58,237,0.08)" : "transparent",
                transition: "all 200ms ease",
              }}
            >{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function ClayLandingPage() {
  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <div style={{ minHeight: "100vh", background: t.canvas, position: "relative" }}>
        <Blobs />
        <div style={{ position: "relative", zIndex: 1 }}>
          <Nav />
          <Hero />
          <Stats />
          <Features />
          <Pricing />
          <CTA />
          <Footer />
        </div>
      </div>
    </>
  );
}
