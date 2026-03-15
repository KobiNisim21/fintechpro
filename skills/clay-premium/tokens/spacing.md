# TOKENS — SPACING

## Philosophy: Airy and Generous

The clay aesthetic breathes. Elements need room around them
for their shadows to spread and for their rounded forms to read clearly.
Cramped spacing makes the shadows look clipped and the roundness look squished.

Never pack clay elements tight. The negative space is part of the material.

---

## Base Unit: 8px

Tailwind's default 4px base is used, but clay layouts trend toward the
larger end of the scale. The minimum meaningful spacing between elements
is 16px. Most inter-element spacing is 24–32px.

---

## Spacing Scale

| Token | Value | Tailwind | Usage |
|---|---|---|---|
| `space-1` | 4px | `gap-1` | Micro — icon/text inline spacing |
| `space-2` | 8px | `gap-2` | Tight — badge internals |
| `space-3` | 12px | `gap-3` | Compact — adjacent labels |
| `space-4` | 16px | `gap-4` | Minimum meaningful gap |
| `space-6` | 24px | `gap-6` | Standard gap between UI elements |
| `space-8` | 32px | `gap-8` | Generous — card grids |
| `space-10` | 40px | `gap-10` | Extra — stat grid on desktop |
| `space-12` | 48px | `p-12` | Section inner padding |
| `space-16` | 64px | `py-16` | Mobile section vertical rhythm |
| `space-24` | 96px | `py-24` | Standard section padding |
| `space-32` | 128px | `py-32` | Hero and large section padding |
| `space-40` | 160px | `py-40` | Maximum hero generosity |

---

## Card Padding

Cards require generous internal padding so content doesn't crowd the rounded edges:
```
Standard card: p-8 (32px) — minimum
Large feature card: p-10 or p-12 (40–48px)
Mobile: p-6 (24px) — reduce, never below this
Small badge card: p-4 (16px)
```

Shadows spread well beyond the card edge — factor in ~30–40px on all sides
when calculating layout widths. Overflow visible is required on containers.

---

## Section Spacing

| Context | Value |
|---|---|
| Between page sections | `py-24` (96px) standard, `py-32` (128px) for major breaks |
| Hero section | `py-32` to `py-40` — maximum drama |
| Between card grid heading and grid | `mt-16` (64px) |
| Between section label and heading | `mb-4` (16px) |
| Between heading and body text | `mt-6` (24px) |
| Between body text and CTA | `mt-10` (40px) |

---

## Bento Grid Gap

The bento grid uses a slightly larger gap to give shadows room to breathe:
```
gap-6 (24px) on mobile
gap-8 (32px) on desktop
```

Never `gap-4` or less — the card shadows will overlap and create mud.

---

## Container Max-Widths

| Context | Max Width | Tailwind |
|---|---|---|
| Full layout | 1280px | `max-w-6xl` to `max-w-7xl` |
| Centered content | 1024px | `max-w-5xl` |
| Section headline | 768px | `max-w-3xl` |
| Section subtext | 600px | `max-w-2xl` |
| Body paragraphs | 560px | `max-w-xl` |

Constrain body text width for optimal readability (60–75 chars per line).
