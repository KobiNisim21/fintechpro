# RESPONSIVE — BREAKPOINTS

## Core Principle: Keep the Clay on Mobile

The most common mistake when adapting clay designs to mobile is
"simplifying" by removing the depth. Don't. The 4-layer shadows,
rounded corners, and vivid colors must survive on every screen size.

What changes is scale and layout. What never changes is the material.

---

## Breakpoints

| Name | Min Width | Tailwind | Description |
|---|---|---|---|
| Mobile | 0px | base | Single column, stacked layouts |
| sm | 640px | `sm:` | Large phones, landscape |
| md | 768px | `md:` | Tablet portrait |
| lg | 1024px | `lg:` | Desktop |
| xl | 1280px | `xl:` | Wide desktop |

---

## Typography Scaling

All these sizes use Nunito Black (font-weight 900):
```
Hero headline: text-5xl (48px) → sm:text-6xl → md:text-7xl → lg:text-8xl
Section title: text-3xl (30px) → sm:text-4xl → md:text-5xl
Card title:    text-xl (20px)  → text-2xl (hero card)
Body text:     text-base       → sm:text-lg → md:text-xl
```

Use `clamp()` for smooth scaling:
```css
font-size: clamp(48px, 8vw, 96px);  /* hero headline */
font-size: clamp(30px, 4vw, 52px);  /* section title */
```

---

## Layout Transformations

### Navigation
- Mobile: Compact island (`height: 60px, borderRadius: 28px, padding: 0 16px`)
- Desktop: Full island (`height: 72px, borderRadius: 40px, padding: 0 28px`)
- Mobile: Hide nav links, show hamburger button + CTA only
- Menu panel: Absolutely positioned glass-clay card below nav

### Hero
- Mobile: CTAs stacked (`flex-direction: column, gap: 12px, width: 100%`)
- Desktop: CTAs side by side (`flex-direction: row, width: auto`)
- Mobile: Decorative orbs reduced in size and fewer visible (hide some with `display: none`)
- Mobile: Headline at `text-5xl` with `clamp()` for fluid scaling

### Stats Grid
- Mobile: 2 columns (`grid-template-columns: repeat(2, 1fr)`)
- Desktop: 4 columns (`grid-template-columns: repeat(4, 1fr)`)
- Orb size: 80px mobile → 110px desktop

### Features Bento
- Mobile: Single column — all cards `col-span-1 row-span-1`
- Tablet: 2-column, hero card `col-span-2 row-span-1`
- Desktop: Full asymmetric bento with `col-span-2 row-span-2` hero card
- Never force asymmetric bento on mobile — it breaks the layout

### Benefits / Split Sections
- Mobile: Stack vertically (`grid-cols-1`)
- Desktop: Side-by-side (`grid-cols-2`, `lg:grid-cols-2`)
- Icon description list stacks gracefully — no layout change needed

### Pricing
- Mobile: Single column, cards full width
- Tablet: 2 columns (Free + Pro, Team below)
- Desktop: 3 columns with featured card `scale(1.04)` elevation
- Mobile: Remove scale elevation from featured card (use border highlight instead)

### CTA Banner
- Mobile: `padding: 40px 24px, borderRadius: 40px`
- Desktop: `padding: 64px 48px, borderRadius: 60px`
- Keep deep shadow on all sizes — never reduce to single shadow

---

## Component Adjustments

### Cards
- Mobile: `padding: 24px` → Desktop: `padding: 32px`
- `border-radius` stays at `32px` on mobile — never reduce
- Shadow stays full 4-layer — shadows don't need responsive reduction

### Buttons
- Mobile primary CTAs: `width: 100%` for maximum tap target
- Secondary actions: auto width on all sizes
- Height: Always `44px+` — accessibility minimum

### Stat Orbs
- Mobile: `width: 80px, height: 80px` — reduces gracefully
- Desktop: `width: 110px, height: 110px`
- Shadow stays proportional — no mobile shadow reduction

---

## What MUST NOT Change on Mobile

- **Shadow stacks** — never reduce to single shadow on mobile
- **Border radii** — minimum `20px` stays on every screen
- **Canvas color** `#F4F1FA` — never white or gray on mobile
- **Blob animations** — blobs still float on mobile (they're fixed/positioned)
- **Button squish** `scale(0.92)` — critical for mobile tap feedback
- **Nunito Black** on headings — font still loads on mobile
- **Vivid accent colors** — never desaturate for "mobile readability"

---

## Performance on Mobile

Blobs use `filter: blur(80px)` which is GPU-accelerated — generally fine.
If older devices show jank, reduce blur to `blur(60px)` and opacity to 8%.

Shadows render in the GPU compositing layer — no performance concern.
`backdrop-filter: blur(20px)` is the only potential issue — if it causes
jank on specific older devices, fall back to `background: rgba(255,255,255,0.92)`.

Blob animations use `will-change: transform` implicitly via animation — fine.
If battery or performance is a major concern, detect `prefers-reduced-motion`
and disable blob animations (blobs become static colored circles).
