# TOKENS — BORDERS & RADIUS

## The Super-Rounded Rule

There are zero sharp corners in this universe.
This is not a preference — it is a law.

Rounded corners subconsciously signal safety, approachability, and softness.
Every element in this skill, from the largest container to the smallest badge,
communicates "friendly" through its radius. A single sharp corner reads
as an error, not a design choice.

---

## Radius Scale

| Element | Value | Tailwind | Reason |
|---|---|---|---|
| Large containers / hero panels | `48px–60px` | `rounded-[48px]` to `rounded-[60px]` | Maximum softness — wraps content generously |
| Standard cards | `32px` | `rounded-[32px]` | Default for all content cards |
| Medium cards / benefit pills | `24px` | `rounded-[24px]` | One step inward from card |
| Buttons | `20px` | `rounded-[20px]` | Substantial rounding — not fully oval |
| Inputs | `16px` | `rounded-2xl` | Recessed but still very soft |
| Icon containers (square) | `16px` | `rounded-2xl` | Matches input softness |
| Icon containers (circle) | `50%` | `rounded-full` | Perfect circle |
| Stat orbs | `50%` | `rounded-full` | Always circular |
| Small badges / tags | `9999px` | `rounded-full` | Pill shape preferred |
| Tooltip | `12px` | `rounded-xl` | Smaller but still soft |

**Absolute minimum: `rounded-[20px]`** on any visible interactive element.
`rounded-lg` (8px) and `rounded-md` (6px) are forbidden. They look generic.

---

## Nested Radius Rule

When a card contains an image or another surface,
the inner element's radius is 8px LESS than the outer:

```
Outer card:  rounded-[32px]  →  Inner image: rounded-[24px]
Outer panel: rounded-[48px]  →  Inner card:  rounded-[40px] or rounded-[32px]
```

This creates visual hierarchy and prevents the "box within a box"
feeling where nested elements look copy-pasted.

---

## Border Usage

Borders are used SPARINGLY in this system. The multi-layer shadow
stack defines element edges — a border on top of that creates visual noise.

**When to use borders:**
- Outline button variant: `border-2 border-violet-400/30`
- Input focus state: adds subtle `ring-4 ring-violet-400/20`
- Badge/tag outlines: `border border-violet-400/20`

**When NOT to use borders:**
- Primary and secondary buttons (shadow handles this)
- Cards (shadow handles this)
- Stat orbs (shadow handles this)

---

## Focus Ring System

All interactive elements use a focus ring that matches the canvas color:
```css
focus-visible:outline-none
focus-visible:ring-4
focus-visible:ring-violet-400/30
focus-visible:ring-offset-2
focus-visible:ring-offset-[#F4F1FA]
```

The ring-offset color MUST match the canvas (`#F4F1FA`).
Using `ring-offset-white` would create a harsh white gap.

---

## Rules

1. **`rounded-[32px]` is the card default** — use this when unsure.
2. **Never below `rounded-[20px]`** on interactive elements.
3. **Nested elements reduce by 8px** from their container.
4. **Stat orbs and icon circles: `rounded-full`** — always perfect circles.
5. **Pills and badges: `rounded-full`** — the fully rounded pill reads as "tag."
