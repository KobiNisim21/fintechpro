# TOKENS — MOTION

## Clay Physics in CSS

Every animation in this system simulates a physical behavior:
float, breathe, squish, lift. Nothing is purely decorative.
The motion communicates that this interface has mass, weight, and presence.

---

## Duration Scale

| Token | Value | Usage |
|---|---|---|
| `instant` | 100ms | State color changes, text transitions |
| `fast` | 200ms | Button press/squish — must feel immediate |
| `smooth` | 300ms | Scale transforms, hover scale effects |
| `standard` | 500ms | Card hover lift — premium, unhurried |
| `blob-short` | 8s | Primary blob animation |
| `blob-medium` | 10s | Secondary blob animation |
| `blob-slow` | 12s | Tertiary blob / slow-orbit elements |
| `breathe` | 6s | Stat orb breathing pulse |

---

## Easing

| Name | Value | Usage |
|---|---|---|
| Standard | `ease-in-out` | All blob animations |
| Lift | `ease-out` | Card and button hover lifts |
| Squish | `ease-in-out` | Button press scale |
| Scale | `ease-in-out` | Orb hover scale |

All hover transitions: `transition-all duration-200` (button) or `transition-all duration-500` (card).

---

## Keyframe Library

### Clay Float — background blobs
```css
@keyframes clay-float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50%       { transform: translateY(-20px) rotate(2deg); }
}
/* Duration: 8s, ease-in-out, infinite */
```

### Clay Float Delayed — alternative blob
```css
@keyframes clay-float-delayed {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50%       { transform: translateY(-15px) rotate(-2deg); }
}
/* Duration: 10s, ease-in-out, infinite */
```

### Clay Float Slow — hero decorative elements
```css
@keyframes clay-float-slow {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50%       { transform: translateY(-30px) rotate(5deg); }
}
/* Duration: 12s, ease-in-out, infinite */
```

### Clay Breathe — stat orbs
```css
@keyframes clay-breathe {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.02); }
}
/* Duration: 6s, ease-in-out, infinite */
```

### Fade Up — entrance animation
```css
@keyframes clay-fade-up {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Duration: 0.6s, ease-out, both */
```

---

## Interaction Patterns

### Button Hover Lift
```css
/* Rest state: translateY(0) shadow-clayButton */
/* Hover: -translate-y-1 (4px up) + shadow-clayButtonHover */
transition: all 200ms ease-out;
```

### Button Active Squish (THE KEY INTERACTION)
```css
/* Active: scale(0.92) + shadow-clayPressed */
/* This is the physical press simulation */
/* 200ms is critical — slower feels laggy, faster feels abrupt */
active:scale-[0.92]
active:shadow-clayPressed
transition: all 200ms ease-in-out;
```

### Card Hover Lift
```css
/* Rest: translateY(0) shadow-clayCard */
/* Hover: -translate-y-2 (8px up) + shadow-clayCardHover */
transition: all 500ms ease-out;
```
WHY 500ms: Cards are larger and slower than buttons. A fast lift
feels jittery on large elements. 500ms feels premium and deliberate.

### Stat Orb Hover
```css
/* Continuous breathe + hover scale-110 */
/* The scale amplifies the breathing animation on hover */
hover:scale-110
transition: transform 300ms ease-in-out;
```

### Blog Post Hover (Most Dramatic)
```css
/* Hover: -translate-y-3 (12px) — most dramatic lift */
/* WHY: Blog posts benefit from pronounced lift to invite clicking */
hover:-translate-y-3
transition: all 500ms ease-out;
```

---

## Animation Delay Utilities

For staggering entrance animations and blob desynchronization:
```css
.animation-delay-2000 { animation-delay: 2s; }
.animation-delay-4000 { animation-delay: 4s; }
.animation-delay-1000 { animation-delay: 1s; }
.animation-delay-3000 { animation-delay: 3s; }
```

---

## Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

In React, check before applying blob animations:
```jsx
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const animClass = prefersReduced ? "" : "animate-clay-float";
```
