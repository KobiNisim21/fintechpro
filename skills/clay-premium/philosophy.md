# PHILOSOPHY — CLAY PREMIUM

## The Reference World

Hold a high-quality vinyl toy from a premium designer. Matte-finish silicone.
Smooth but dense. Light catches the top edges. Shadows gather beneath.
Press it — it gives slightly, then springs back.

Now imagine building an entire interface from that material.
That is this skill.

---

## The Clay Physics Engine

This design system is governed by three physical laws. Every component,
every shadow decision, every interaction must obey them.

### Law 1: Convexity vs. Concavity

Objects in this world either bulge OUT or press IN. Nothing is flat.

**Convex (bulging toward the viewer):**
Buttons, cards, stat orbs, icon containers. These elements sit above the surface.
Their shadow architecture simulates light from top-left: strong highlight on
the upper-left edge, soft colored drop shadow below, inner rim light for depth.

**Concave (pressed into the surface):**
Input fields, active button states, FAQ accordions when open. These elements
are recessed INTO the clay canvas. Inset shadows simulate the cavity:
dark on the top-left interior, light on the bottom-right lip.

The visual contrast between a convex button and a concave input field
is what makes this system feel genuinely physical. Never use the same
shadow stack for both — it collapses the illusion.

### Law 2: Buoyancy

Everything in this interface exists in a low-gravity environment.
Background blobs drift slowly. Cards lift when approached.
Buttons float upward on hover. Nothing is stuck to the grid.

The floating behavior is not decoration — it communicates that
the interface is alive and responsive. An element that doesn't
move on hover feels broken in this world.

Specific lifts:
- Buttons: `hover:-translate-y-1` (4px)
- Cards: `hover:-translate-y-2` (8px)
- Stat orbs: `hover:scale-110` (grow slightly)
- Blog posts: `hover:-translate-y-3` (12px — most dramatic)
- Background blobs: continuous `translateY` loop, 8–12s

### Law 3: Physical Press Response

When the user presses a button, it squishes.
Not subtly. Not barely. It squishes.

`active:scale-[0.92]` combined with `active:shadow-clayPressed`.

The element compresses to 92% of its size and switches from
convex shadow (bulging) to concave shadow (pressed in).
This 8% scale reduction is precisely calibrated — enough to feel
satisfying and physical, not so much it looks broken.

Duration: 200ms. Fast. Immediate feedback.

---

## The Candy-Store Color Strategy

The palette is "candy shop." Vivid violet, hot pink, sky blue,
emerald green, amber. These are not pastels. They are saturated,
confident, joyful.

This color strategy communicates:
- Safety (rounded forms + friendly colors signal approachability)
- Premium (the colors are deliberate and harmonious, not random)
- Joy (you can't be anxious in a well-designed candy store)

**The accent (vivid violet `#7C3AED`) is used for:**
- Primary button gradients
- Focus rings
- Checkmarks and success states
- Brand moments

**The supporting cast:**
- Hot pink for gradients and secondary highlights
- Sky blue for informational elements
- Emerald for success/benefit signals
- Amber for ratings and warnings

---

## The Shadow Stack is the Skill

If there is one thing to study, it is the 4-layer shadow architecture.

Every element in this system uses a minimum of 4 shadow values:
1. A soft colored DROP shadow (defines separation from canvas)
2. A TOP-LEFT HIGHLIGHT shadow (simulates ambient light catch)
3. An INNER COLOR reflection (deep bounce light inside the clay)
4. An INNER RIM LIGHT (the glossy bottom-right edge inside the surface)

Together these four layers create the sensation of a three-dimensional
object with physical mass. Remove any one of them and the object flattens.

This is the hard work of the skill. Most dark-mode systems use single shadows.
This system requires four per element, tuned for each context.

---

## Font Pairing

**Nunito** (headings) was chosen because its letterforms have rounded terminals —
the ends of each stroke are circular, not flat. This means the typography
itself communicates the same "softness" as the shapes. A harsh geometric
sans-serif like Inter would fight the aesthetic. Nunito belongs here.

**DM Sans** (body) is a geometric sans with excellent small-size readability.
It is neutral enough to not compete with Nunito at large sizes.

This pairing is non-negotiable. Both fonts are free from Google Fonts.
Apply Nunito via inline style on ALL headings and numbers — never rely
on CSS classes alone for this, as it must override any base styles.

---

## What Breaks This Aesthetic

| ❌ WRONG | ✓ RIGHT |
|---|---|
| Single shadow on cards | 4-layer shadow stack |
| `rounded-md` or `rounded-lg` | `rounded-[32px]` minimum for cards |
| Muted, desaturated palette | Vivid candy-store colors |
| Flat white or gray background | `#F4F1FA` canvas + animated blobs |
| Buttons that don't squish | `active:scale-[0.92]` + `shadow-clayPressed` |
| No hover lift effect | `hover:-translate-y-1` minimum |
| Light gray text | `#635F69` minimum — never lighter |
| Geometric sans headings | Nunito Black — always |
| Inputs with outward shadows | Inputs are CONCAVE — inset shadows only |
| Uniform bento grid | Mix spans — `col-span-2`, `row-span-2` |
| DM Sans on display headings | Nunito on all headings and stats |
