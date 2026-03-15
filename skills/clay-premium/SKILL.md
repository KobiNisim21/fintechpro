---
name: clay-premium
version: 1.0.0
stack: React + Tailwind CSS
category: colorful
mood: [playful, tactile, joyful, premium, soft]
---

# CLAY PREMIUM SKILL

High-Fidelity Claymorphism — a design system that simulates tangible, physical objects
made of premium digital clay. Soft-touch matte silicone surfaces, candy-store colors,
multi-layer shadow stacks, and bouncy micro-interactions. Every element has volume,
weight, and depth. Zero sharp corners. Everything breathes and floats.

This is not basic rounded corners with a gradient. It is a complete physics simulation:
objects bulge toward the viewer (convex), inputs press into the surface (concave),
blobs drift in zero-gravity, and buttons physically squish when pressed.

---

## HOW TO USE THIS SKILL

### STEP 1 — Read intent before code
Read these files in order before generating anything:

1. `philosophy.md`           ← The clay physics engine. Read first, always.
2. `tokens/colors.md`        ← Candy shop palette. Every value deliberate.
3. `tokens/shadows.md`       ← THE most important token file. 4-layer stacks.
4. `tokens/typography.md`    ← Nunito Black + DM Sans. Non-negotiable pairing.
5. `tokens/borders.md`       ← Super-rounded everywhere. Min 20px. No exceptions.
6. `tokens/motion.md`        ← Float, breathe, squish. The clay physics in CSS.
7. `tokens/spacing.md`       ← Generous, airy. Cards breathe.
8. `tokens/charts.md`        ← Charts & graphs. Data colors, container, tooltips, motion. Read when styling or adding dashboards and charts.

### STEP 2 — Set up the project
Follow `integration/setup.md` exactly. The shadow utilities and blob animation
keyframes must be in place before components will look correct.

### STEP 3 — Study components as reference patterns
Every component includes WHY annotations explaining the shadow stack,
the border radius decisions, and the interaction physics. Study before building.

### STEP 4 — Use the example as your quality benchmark
Read `examples/LandingPage.jsx` before building any page. The 4-layer
background blob system, bento grid, and button squish effects are the
signature elements — missing any one makes the design look amateur.

---

## WHAT YOU CAN OVERRIDE
- **Accent colors**: The candy palette can shift hue while maintaining saturation.
  Keep colors vivid — muted pastels break the candy-store energy.
- **Font sizes**: Can scale within the defined hierarchy.
- **Blob colors and positions**: Adjust for brand while maintaining blur and opacity.
- **Content and copy**: All placeholder text is replaceable.

## WHAT YOU MUST NEVER OVERRIDE
- **4-layer shadow stacks**: Never reduce to single shadows. The depth simulation
  requires all four layers. A single shadow makes clay look like flat material.
- **Rounded corners**: Minimum `rounded-[20px]` everywhere. Never `rounded-md` or
  `rounded-lg`. Sharp corners shatter the clay world illusion.
- **Button squish**: `active:scale-[0.92]` + `active:shadow-clayPressed`.
  The physical press response is the most important interaction in this system.
- **Background canvas**: `#F4F1FA` — not white, not gray. This slight lavender tint
  is essential for the clay materials to read correctly against it.
- **Animated blobs**: Every page needs 3-4 floating blobs. Without them the
  background becomes flat and the cards lose their glass-clay context.
- **Nunito font on headings**: DM Sans headlines look wrong in this system.
  Nunito's rounded terminals are intrinsic to the clay aesthetic.
- **Hover lift**: All interactive elements lift on hover (`-translate-y-1` min).
  Elements that don't respond feel broken in this physics world.

---

## AGENT BEHAVIOR RULES
- Every card uses the 4-layer shadow stack — never a single Tailwind shadow utility.
- Every button has hover lift + active squish. Both. Always.
- Background always has 3-4 animated blobs — never a flat canvas.
- Icon containers use vivid gradient fills, not flat colors.
- Inputs are RECESSED (inset shadow), buttons are CONVEX (outward shadow).
  This contrast is the core clay physics principle.
- Bento grids: mix card sizes. Never a uniform grid.
- All stat numbers use Nunito Black font-family.
- No text lighter than `#635F69` — WCAG compliance is non-negotiable.
- All interactive elements meet 44px minimum touch target.
- Decorative elements (blob orbits, floating shapes) are `pointer-events-none`.
- **Charts**: Read `tokens/charts.md` before touching any chart. Restyle only — colors, fonts, shadows, tooltips, motion. Never change the chart library, data logic, or component structure.

---

## STACK REQUIREMENTS
- React 18+
- Tailwind CSS 3+
- Nunito (Google Fonts, weights 700/800/900)
- DM Sans (Google Fonts, weights 400/500/700)
- Lucide React (strokeWidth 2, slightly chunky for this aesthetic)
