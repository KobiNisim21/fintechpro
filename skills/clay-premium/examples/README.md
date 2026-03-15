# EXAMPLES — README

## LandingPage.jsx — THE NORTH STAR

Study this file before building any page with the clay-premium skill.
Every major clay pattern is demonstrated working together as a complete system.

---

## What to Notice in Each Section

**Background (Blobs):**
Three colored blobs — violet (top-left), pink (top-right), sky blue (left-center).
Each uses a different animation duration (8s, 10s, 12s) and delay to desynchronize.
`filter: blur(80px)` with 10% opacity color. On `#F4F1FA` canvas these create
soft ambient light — not garish, not invisible. Remove them and the page looks flat.

**Navbar:**
Floating island pill with `borderRadius: 40` — NOT a full-width bar.
The nav is a clay object sitting on the canvas, casting its own shadow.
Logo orb has the breathe animation (`clay-breathe`) — a living brand mark.
Links use background pill on hover, not underline.

**Hero:**
Nunito Black at `clamp(48px, 8vw, 96px)`. Gradient text on key phrase.
THREE decorative orbs orbit the headline — amber (top-left), emerald (top-right),
blue square (bottom-left). Each has a different float animation and delay.
These are positioned absolutely with `pointer-events: none`.
Command pill uses the split design: accent-background `$` + white panel for the command.

**Stats:**
Circular stat orbs with vivid gradient fills + `clay-breathe` animation.
Four different gradient colors — never the same gradient twice adjacent.
Each orb has `shadow-clayOrb` — the 4-layer orb shadow stack.

**Features Bento:**
Hero card is `col-span: 2, row-span: 2` — takes top-left 2×2 position.
Five smaller cards fill the remaining spaces.
Icon containers use rotating gradients from the 6-color icon gradient library.
Cards hover with `translateY(-8px) scale(1.01)` — combined lift + slight scale.
Asymmetric grid is non-negotiable. Uniform 3-column grid looks template-made.

**Pricing:**
Featured card uses `scale(1.04)` at rest — slightly elevated even before hover.
"Most Popular" badge FLOATS above the card (`position: absolute, top: -16px`).
Featured card hover: `translateY(-10px) scale(1.03)` — most dramatic lift.
Check icons are in small emerald circles with their own mini clay shadow.
All prices use Nunito Black 52px — stat-number treatment.

**CTA Banner:**
`shadow-clayDeep` — the largest, most dramatic shadow.
`borderRadius: 60` — maximum softness.
Internal decorative blobs inside the panel add secondary depth.

**Footer:**
Floating island matching nav style — consistent visual language top and bottom.
Mini gradient orb matches nav logo.

---

## Pre-Ship Checklist

- [ ] Canvas is `#F4F1FA` — not white, not gray
- [ ] Three+ animated blobs in background — never flat canvas
- [ ] Navbar is a floating island pill — not a full-width bar
- [ ] All headings use Nunito Black (font-weight 900) via inline style
- [ ] Hero headline uses gradient text treatment
- [ ] All buttons have hover lift (`translateY(-4px)`) + active squish (`scale(0.92)`)
- [ ] All active states switch to `shadow-clayPressed` (inset)
- [ ] Cards have 4-layer shadow — never single shadow
- [ ] Inputs have INSET shadow only — never outward convex shadow
- [ ] Icon containers use rotating vivid gradients — never same twice adjacent
- [ ] Bento grid has asymmetric card sizes — hero card spans 2×2 minimum
- [ ] Pricing featured card floats above others at rest (`scale(1.04)`)
- [ ] "Popular" badge sits ABOVE the card, absolutely positioned (`top: -16px`)
- [ ] Stat numbers use Nunito Black — same as headings
- [ ] No text lighter than `#635F69` — WCAG compliance
- [ ] All interactive elements minimum 44px height (touch target)
- [ ] Decorative elements are `pointer-events: none`
- [ ] `border-radius` minimum `rounded-[20px]` — never `rounded-md`
