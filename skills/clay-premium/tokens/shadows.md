# TOKENS — SHADOWS
## THE MOST IMPORTANT FILE IN THIS SKILL

The shadow system IS the clay aesthetic. Reduce any layer and the material
collapses into flat UI. These are not decorative — they are structural.

Every element in this system has exactly the right shadow for its
physical state: convex (bulging out) or concave (pressed in).

---

## The Four-Layer Architecture

Every shadow stack uses four values with distinct jobs:

```
Layer 1: Outer drop shadow     — defines distance from the canvas surface
Layer 2: Top-left highlight    — catches ambient light from overhead-left
Layer 3: Inner color bounce    — subtle colored light reflecting inside
Layer 4: Inner rim light       — the edge highlight inside the surface
```

Remove Layer 1 and the element loses depth.
Remove Layer 2 and the top-left looks wrong — shadow only, no light.
Remove Layer 3 and the material looks dull, not clay-like.
Remove Layer 4 and the object loses its three-dimensional interior quality.

All four layers are required. Always.

---

## The Full Shadow Library

### 1. Deep Clay (Large Surfaces / Canvas Background)
For the main background container or hero section surfaces.
```css
box-shadow:
  30px 30px 60px #CDC6D9,                        /* L1: Deep ambient occlusion */
  -30px -30px 60px #FFFFFF,                      /* L2: Strong top-left ambient light */
  inset 10px 10px 20px rgba(139,92,246,0.05),   /* L3: Subtle violet bounce */
  inset -10px -10px 20px rgba(255,255,255,0.8); /* L4: Surface specularity */
```
`shadow-clayDeep`

### 2. Clay Card (Standard Floating Card)
For all content cards, feature panels, blog posts.
```css
box-shadow:
  16px 16px 32px rgba(160,150,180,0.20),         /* L1: Soft purple-gray drop */
  -10px -10px 24px rgba(255,255,255,0.90),       /* L2: Strong highlight */
  inset 6px 6px 12px rgba(139,92,246,0.03),     /* L3: Subtle color bounce */
  inset -6px -6px 12px rgba(255,255,255,1.00);  /* L4: Full white rim */
```
`shadow-clayCard`

### 3. Clay Card Hover (Enhanced Float)
```css
box-shadow:
  20px 20px 40px rgba(160,150,180,0.30),
  -12px -12px 28px rgba(255,255,255,0.95),
  inset 6px 6px 12px rgba(139,92,246,0.05),
  inset -6px -6px 12px rgba(255,255,255,1.00);
```
`shadow-clayCardHover`

### 4. Clay Button (High Convexity — Primary CTA)
For gradient violet buttons. Colored glow in the drop shadow.
```css
box-shadow:
  12px 12px 24px rgba(139,92,246,0.30),          /* L1: Violet-colored glow shadow */
  -8px -8px 16px rgba(255,255,255,0.40),         /* L2: Top-left highlight */
  inset 4px 4px 8px rgba(255,255,255,0.40),     /* L3: Inner rim top */
  inset -4px -4px 8px rgba(0,0,0,0.10);         /* L4: Inner bottom shading */
```
`shadow-clayButton`

### 5. Clay Button Hover (Elevated CTA)
```css
box-shadow:
  16px 16px 32px rgba(139,92,246,0.40),
  -8px -8px 20px rgba(255,255,255,0.50),
  inset 4px 4px 8px rgba(255,255,255,0.40),
  inset -4px -4px 8px rgba(0,0,0,0.10);
```
`shadow-clayButtonHover`

### 6. Clay Pressed (Concave — Inputs & Active State)
For all INPUT FIELDS and ACTIVE BUTTON STATES.
Inset only — no outward shadows. The element is INSIDE the clay.
```css
box-shadow:
  inset 10px 10px 20px #D9D4E3,                  /* L1: Deep inner shadow top-left */
  inset -10px -10px 20px #FFFFFF;               /* L2: Inner highlight bottom-right */
```
`shadow-clayPressed`

Note: Only 2 layers for pressed state — the element has no outward glow
because it is recessed, not floating.

### 7. Clay Orb (Stat Circles / Floating Elements)
For stat orbs and icon circles.
```css
box-shadow:
  10px 10px 20px rgba(139,92,246,0.25),
  -8px -8px 16px rgba(255,255,255,0.90),
  inset 4px 4px 8px rgba(255,255,255,0.50),
  inset -4px -4px 8px rgba(0,0,0,0.08);
```
`shadow-clayOrb`

### 8. Clay Inset (Decorative Recessed Areas)
For decorative panels that should appear sunken.
```css
box-shadow:
  inset 8px 8px 16px #D5CFE2,
  inset -8px -8px 16px #FFFFFF;
```
`shadow-clayInset`

---

## Context Guide: Which Shadow for What

| Element | Shadow | Why |
|---|---|---|
| Feature card | `shadow-clayCard` | Floating glass surface |
| Feature card (hover) | `shadow-clayCardHover` | Enhanced float |
| Primary button | `shadow-clayButton` | Convex clay CTA |
| Primary button (hover) | `shadow-clayButtonHover` | More elevated |
| Primary button (active) | `shadow-clayPressed` | Physical squish |
| Input field | `shadow-clayPressed` | Recessed typing area |
| Stat orb | `shadow-clayOrb` | Circular floating object |
| Hero background panels | `shadow-clayDeep` | Large surface depth |
| Testimonial card | `shadow-clayCard` | Same as feature card |
| Blog card | `shadow-clayCard` | Same |
| Pricing card | `shadow-clayCard` | Standard |
| Pricing featured card | `shadow-clayButton` | Extra convex = premium |

---

## Rules

1. **No single shadows** — minimum 2 layers (pressed), max 4 (all others).
2. **Convex and concave never share a shadow** — inputs use `clayPressed` only.
3. **Colored drop shadows** — the drop shadow for buttons uses the accent color
   at 30% opacity, not gray. This "tints" the shadow with the button's hue.
4. **White highlights** — the top-left outer shadow is always white, never light gray.
   `rgba(255,255,255,0.9)` minimum. Full white creates the most convincing highlight.
5. **Inner shadows** — always present on cards and buttons. Without inner shadows
   the surface looks like a flat div with a drop shadow, not a clay object.
