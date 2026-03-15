# SETUP — CLAY PREMIUM SKILL

## 1. Install Dependencies

```bash
npm install lucide-react
```

No animation library required — all motion is pure CSS.

---

## 2. Wire Up Fonts

Add to your `<head>` (Next.js: `layout.jsx`, Vite: `index.html`):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
```

---

## 3. Import globals.css

```js
// Next.js App Router (layout.jsx)
import '@/skills/clay-premium/integration/globals.css'

// Vite / CRA
import './skills/clay-premium/integration/globals.css'
```

---

## 4. Merge Tailwind Config

Add the `theme.extend` block from `tailwind.config.js` into your project config.

Key additions:
- `clay.*` color tokens
- `shadow-clayCard`, `shadow-clayButton`, `shadow-clayPressed`, etc.
- `animate-clay-float`, `animate-clay-breathe`, `animate-clay-fade-up`
- Extended border radii (`rounded-4xl` = 32px, `rounded-6xl` = 48px)
- `font-display` (Nunito), `font-body` (DM Sans)

---

## 5. Add the Background Blob System

Every page layout needs this wrapper:

```jsx
export default function Layout({ children }) {
  return (
    <div style={{ background: "#F4F1FA", minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      {/* Background blob layer — pointer-events-none, fixed, behind everything */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
        {/* Blob 1 — Violet, top-left */}
        <div className="absolute h-[60vh] w-[60vh] rounded-full blur-3xl bg-violet-400/10 -top-[10%] -left-[10%] animate-clay-float" />
        {/* Blob 2 — Pink, top-right */}
        <div className="absolute h-[60vh] w-[60vh] rounded-full blur-3xl bg-pink-400/10 -top-[10%] -right-[10%] animate-clay-float-delayed animation-delay-2000" />
        {/* Blob 3 — Sky, left-center */}
        <div className="absolute h-[50vh] w-[50vh] rounded-full blur-3xl bg-sky-400/10 top-[30%] -left-[5%] animate-clay-float-slow animation-delay-4000" />
      </div>

      {/* Content above blobs */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
```

---

## 6. Verify Setup

```jsx
export default function ClayTest() {
  return (
    <div style={{ background: "#F4F1FA", padding: 48 }}>
      <div style={{
        background: "rgba(255,255,255,0.7)",
        borderRadius: 32,
        padding: 32,
        backdropFilter: "blur(20px)",
        boxShadow: "16px 16px 32px rgba(160,150,180,0.20), -10px -10px 24px rgba(255,255,255,0.90), inset 6px 6px 12px rgba(139,92,246,0.03), inset -6px -6px 12px rgba(255,255,255,1)",
        maxWidth: 400,
      }}>
        <h2 style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: 28, color: "#332F3A" }}>
          Clay Premium
        </h2>
        <p style={{ color: "#635F69", marginTop: 12 }}>
          Card with 4-layer shadow ✓
        </p>
        <button style={{
          marginTop: 20,
          background: "linear-gradient(to bottom right, #A78BFA, #7C3AED)",
          color: "#fff",
          borderRadius: 20,
          padding: "12px 28px",
          border: "none",
          fontFamily: "Nunito, sans-serif",
          fontWeight: 800,
          cursor: "pointer",
          boxShadow: "12px 12px 24px rgba(139,92,246,0.30), -8px -8px 16px rgba(255,255,255,0.40), inset 4px 4px 8px rgba(255,255,255,0.40), inset -4px -4px 8px rgba(0,0,0,0.10)",
        }}>
          Press me
        </button>
      </div>
    </div>
  );
}
```

You should see:
- Canvas background `#F4F1FA` — slightly lavender tinted, not white
- Card with visible top-left highlight and colored bottom-right shadow
- Button with violet gradient and pronounced 3D glow shadow
- Nunito font on the heading

---

## 7. Folder Location

```
your-project/
└── skills/
    └── clay-premium/
```
