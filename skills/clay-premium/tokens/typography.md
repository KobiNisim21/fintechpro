# TOKENS — TYPOGRAPHY

## The Pairing

**Nunito** headings + **DM Sans** body. This is the only valid combination.

Nunito's rounded letterform terminals (the ends of strokes are circular)
mirror the rounded corners of every shape in this system. Using a geometric
or humanist sans for headings would create a jarring contrast — the text
would look like it belongs to a different design system than the shapes.

DM Sans is clean, readable, and neutral enough at body sizes to let
Nunito lead at display sizes without competing.

---

## Font Import

```html
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
```

---

## Applying Nunito

**Always use inline style for Nunito.** Never rely solely on a class:
```jsx
<h1 style={{ fontFamily: "Nunito, sans-serif" }}>
```

This ensures the font applies even if base CSS is overridden elsewhere.
Apply to: ALL headings (h1–h4), stat numbers, badge labels, card titles.

DM Sans applies globally via body `font-family`. No inline needed.

---

## Type Scale

### Display / Hero Headline
```
Font:      Nunito, font-weight 900 (Black)
Size:      clamp(48px, 8vw, 96px) — or text-5xl → lg:text-8xl
Tracking:  tracking-tight (-0.025em)
Line:      leading-[1.1]
Color:     clay-foreground (#332F3A) or gradient text
```

### Section Title (H2)
```
Font:      Nunito, font-weight 800 (ExtraBold)
Size:      text-3xl → md:text-5xl
Tracking:  tracking-tight
Line:      leading-tight (1.25)
Color:     clay-foreground
```

### Card Title (H3)
```
Font:      Nunito, font-weight 700-800 (Bold/ExtraBold)
Size:      text-xl → text-2xl (hero card: text-3xl)
Tracking:  tracking-tight
Line:      leading-snug
Color:     clay-foreground
```

### Stat Number
```
Font:      Nunito, font-weight 900 (Black)
Size:      text-4xl → text-5xl
Tracking:  tracking-tight
Color:     clay-foreground or accent gradient
```

### Body Text
```
Font:      DM Sans, font-weight 500 (Medium)
Size:      text-base → text-lg (larger in section intros)
Tracking:  normal
Line:      leading-relaxed (1.625)
Color:     clay-muted (#635F69)
```

### Label / Eyebrow
```
Font:      DM Sans or Nunito, font-weight 700 (Bold)
Size:      text-sm → text-xs
Tracking:  tracking-wide (uppercase labels) or tracking-widest
Transform: uppercase
Color:     clay-accent (#7C3AED) or clay-muted
```

---

## Gradient Text Treatment

Only for display headings (text-5xl+). Never smaller — legibility collapses.

```css
background: linear-gradient(to right, #332F3A 20%, #7C3AED 60%, #DB2777 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-clip: text;
```

In JSX:
```jsx
<span style={{
  background: "linear-gradient(to right, #332F3A 20%, #7C3AED 60%, #DB2777 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  fontFamily: "Nunito, sans-serif",
  fontWeight: 900,
}}>
```

---

## Readability Rules

1. **Line length**: Max 60–75 characters — use `max-w-2xl` or `max-w-3xl` on paragraphs.
2. **Body color**: Always `#635F69` on `#F4F1FA` canvas. Never lighter.
3. **Heading color**: `#332F3A` — soft charcoal, not true black.
4. **No all-caps on body text** — only eyebrow labels and small metadata.
5. **Stat numbers** always use Nunito Black — these are graphic elements as much as text.
