# TOKENS — COLORS

## The Candy-Store Philosophy

Every color in this system is deliberate. The palette is vivid, saturated,
and harmonious. This is not a pastel system — pastels lose the joyful energy.
Not an earth-tone system — earth tones undercut the playfulness.
It is a candy-store palette: vivid, confident, optimistic.

---

## Core Palette

### Canvas & Backgrounds

| Token | CSS Var | Hex | Usage |
|---|---|---|---|
| `canvas` | `--color-canvas` | `#F4F1FA` | Primary page background — slight lavender tint. Never pure white. |
| `card-bg` | `--color-card-bg` | `rgba(255,255,255,0.70)` | Card backgrounds — glass-clay hybrid |
| `card-bg-solid` | `--color-card-bg-solid` | `#FFFFFF` | Solid card variant |
| `input-bg` | `--color-input-bg` | `#EFEBF5` | Recessed input background |

**WHY `#F4F1FA`:** The slight lavender tint is essential. Cards and blobs
use purple/violet accents — a pure white background makes them look harsh.
The tinted canvas creates the sensation of everything existing in the same
light environment. Switch to white and the magic breaks.

### Text

| Token | CSS Var | Hex | Usage |
|---|---|---|---|
| `foreground` | `--color-fg` | `#332F3A` | Primary text — soft charcoal, not black |
| `muted` | `--color-muted` | `#635F69` | Secondary text — MINIMUM for WCAG AA |

**Critical rule:** Never use text lighter than `#635F69` on `#F4F1FA`. This is
the accessibility floor. Any lighter and contrast fails WCAG AA minimum.

### Accents

| Token | CSS Var | Hex | Tailwind | Usage |
|---|---|---|---|---|
| `accent` | `--color-accent` | `#7C3AED` | `violet-700` | Primary — CTAs, links, brand |
| `accent-alt` | `--color-accent-alt` | `#DB2777` | `pink-600` | Secondary — gradients, highlights |
| `sky` | `--color-sky` | `#0EA5E9` | `sky-500` | Informational, background blobs |
| `success` | `--color-success` | `#10B981` | `emerald-500` | Checkmarks, benefits, positive |
| `warning` | `--color-warning` | `#F59E0B` | `amber-400` | Ratings, alerts, warmth |

---

## Gradient System

### Primary Button Gradient
```css
background: linear-gradient(to bottom right, #A78BFA, #7C3AED);
/* Tailwind: bg-gradient-to-br from-violet-400 to-violet-700 */
```
WHY: The lighter start color creates a highlight on the upper-left edge,
simulating the clay convexity catching light. A solid color button
looks flat and loses the 3D quality.

### Icon Container Gradients (vary per icon — never uniform)
```css
Blue:   bg-gradient-to-br from-blue-400 to-blue-600
Purple: bg-gradient-to-br from-purple-400 to-purple-600
Pink:   bg-gradient-to-br from-pink-400 to-pink-600
Green:  bg-gradient-to-br from-emerald-400 to-emerald-600
Cyan:   bg-gradient-to-br from-cyan-400 to-cyan-600
Amber:  bg-gradient-to-br from-amber-400 to-amber-500
```

### Gradient Text (heroes only — 5xl minimum)
```css
background: linear-gradient(to right, #332F3A 20%, #7C3AED 60%, #DB2777 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```
Never below text-5xl — gradient text at small sizes has legibility issues.

---

## Background Blob Colors

Blobs are accent colors at 10% opacity with heavy blur:
```
Blob 1: bg-[#8B5CF6]/10  (violet) — top-left zone
Blob 2: bg-[#EC4899]/10  (pink) — top-right zone
Blob 3: bg-[#0EA5E9]/10  (sky blue) — middle-left
Blob 4: bg-[#10B981]/10  (emerald, optional) — bottom area
```

---

## Color Rules

1. **Canvas is `#F4F1FA`** — not white, not gray, not transparent.
2. **Text floor is `#635F69`** — accessibility is non-negotiable.
3. **Accent is vivid** — `#7C3AED` is highly saturated. Never muted.
4. **Cards are glass** — `rgba(255,255,255,0.6-0.8)` not fully opaque.
5. **Icon gradients rotate** — never same gradient on adjacent icons.
6. **Blobs at 10% opacity** — visible but not overwhelming the content.
