# CHANGELOG — CLAY PREMIUM SKILL

## v1.0.0 — Initial Release

**Tokens (6 files):**
- `colors.md` — Candy-store palette, 10 tokens, gradient strategies, blob color specs
- `typography.md` — Nunito Black + DM Sans pairing, gradient text treatment (5xl+ only), inline style rules
- `shadows.md` — 8-member shadow library (clayDeep, clayCard, clayCardHover, clayButton, clayButtonHover, clayPressed, clayOrb, clayInset), 4-layer architecture
- `borders.md` — Super-rounded scale (20px → 60px), nested radius rule, focus ring system
- `motion.md` — 5 clay keyframes (float, float-delayed, float-slow, breathe, fade-up), squish interaction specs, blob desynchronization
- `spacing.md` — 8px base unit, generous padding rules, bento grid gap specs

**Integration (3 files):**
- `tailwind.config.js` — `clay.*` color tokens, full `boxShadow` library, animation utilities, extended border-radius scale
- `globals.css` — CSS variables, all shadow utilities as classes, keyframe library, gradient text utility, blob background system
- `setup.md` — Font wiring, background blob system setup, verification snippet

**Components (7 files):**
- `Button.jsx` — Primary gradient squish, secondary glass, outline, ghost. Hover lift + active squish (scale-[0.92]). Loading state.
- `Input.jsx` — Concave recessed surface, focus transforms to raised white, error/hint states + Badge (pill-shaped, 7 variants)
- `Card.jsx` — 4-layer shadow, glass/solid/frosted/accent variants, hover lift. StatOrb (breathe + clay shadow). Alert (semantic glass panels).
- `Navbar.jsx` — Floating island pill, gradient orb logo, mobile hamburger panel
- `Spinner.jsx` — SVG arc spinner, ProgressBar (concave track + convex fill with glow), Skeleton shimmer

**Examples (2 files):**
- `LandingPage.jsx` — Complete north star: Blobs, Hero with orbiting orbs, Stats orbs, Asymmetric bento features, Elevated pricing, Deep clay CTA banner
- `README.md` — Section-by-section guide, pre-ship checklist (18 items)

**Responsive + Meta:**
- `breakpoints.md` — Typography scaling, layout transformations, "what must not change on mobile" rules
- `changelog.md` — This file

---

## Design System Differentiators vs. Siblings

| Aspect | Clay Premium | Linear Modern | Minimalist Monochrome |
|---|---|---|---|
| Background | `#F4F1FA` + blob ambience | `#050506` + animated blobs | `#FFFFFF` + texture |
| Surface | Glass `rgba(255,255,255,0.7)` + blur | Dark translucent glass | Pure white |
| Shadow | 4-layer clay stack (outer + highlight + inner) | 3-layer (border + diffuse + glow) | None |
| Button press | `scale(0.92)` squish + inset shadow | `scale(0.98)` subtle | N/A |
| Radius | 32px–60px — super-rounded | 8px–16px — precise | 0px — zero radius |
| Typography | Nunito Black (rounded terminals) | Inter (clean geometric) | Playfair Display (editorial serif) |
| Color | Candy-store: violet, pink, sky, emerald | Single indigo accent | Black only |
| Motion | Bouncy float + breathe + squish | Expo-out precision | 100ms instant |
| Personality | Joyful, tactile, playful | Cinematic, premium, precise | Austere, editorial |
