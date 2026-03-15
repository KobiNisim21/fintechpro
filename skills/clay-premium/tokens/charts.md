# CHARTS & GRAPHS — CLAY PREMIUM
## Token file: `tokens/charts.md`

This file defines how charts and graphs should look and behave inside the
Clay Premium design system. Every visual decision here must be derived from
the existing skill tokens — colors, typography, shadows, borders, and motion.
Charts are not a separate design system. They are surfaces that belong to the
same world as every other component.

---

## 0. AGENT RULES FOR EXISTING CHARTS

**Read this before touching any chart code.**

If the project already contains charts or graphs, your job is to restyle
them — not rewrite them. The data logic, the chart type, the data structure,
the props, and the component architecture are all off-limits.

**What you MAY change:**
- Colors (fills, strokes, gradients)
- Fonts and font sizes on axis labels, tooltips, legends
- Border radius on bars, tooltips, containers
- Shadow and background on the chart container card
- Grid line color, opacity, and style
- Animation duration and easing (if the library supports it)
- Tooltip background, border, and text styling
- Dot/point size and color on line charts
- Legend layout, spacing, and text styling

**What you MUST NOT change:**
- The chart library itself (do not swap Recharts for Chart.js or vice versa)
- Data fetching, data transformation, or data props
- The chart type (do not turn a bar chart into a line chart)
- Component file names or export names
- Any business logic inside the chart component
- The structure of the JSX — only add or change style-related props

**How to approach an existing chart:**
1. Read the component first — understand what library and chart type it uses
2. Identify which props accept style values (colors, fonts, sizes)
3. Apply the skill's tokens to those props only
4. Do not refactor, simplify, or "improve" the code structure
5. If a style cannot be applied without restructuring the component — leave it and note what couldn't be changed

**If the chart has inline styles or a separate styles file:**
Update the style values only. Do not reorganize how styles are applied.

**If the chart uses a config object:**
Update only the visual properties inside the config. Leave data and options
that affect chart behavior untouched.

---

## 1. LIBRARY

**Recommended:** Recharts (React)
**Why:** Recharts fits Clay Premium's personality — smooth, declarative, and
animatable. Chart entry animations (bars growing, lines drawing) align with
the skill's motion tokens (smooth 300ms, standard 500ms). The React-first API
keeps styling consistent with the rest of the component system.

```bash
npm install recharts
```

---

## 2. COLOR PALETTE FOR DATA

Charts need a dedicated set of sequential data colors derived from the
skill's accent palette. Never use arbitrary colors — every data color
should trace back to the skill's token system.

| Token | Hex | Usage |
|---|---|---|
| `data-1` | `#7C3AED` | First series / most important (accent) |
| `data-2` | `#DB2777` | Second series (accent-alt) |
| `data-3` | `#0EA5E9` | Third series (sky) |
| `data-4` | `#8B5CF6` | Fourth series (violet-500) |
| `data-5` | `#A78BFA` | Fifth series / least emphasis (violet-400) |
| `data-positive` | `#10B981` | Gains, up trends, good states (success) |
| `data-negative` | `#F59E0B` | Losses, down trends, alerts (warning) |
| `data-neutral`  | `#635F69` | Flat/unchanged, zero baseline (muted) |

**Rules:**
- [x] Define your color sequence — data-1 → data-5 in order of emphasis
- [x] Fills use 20–30% opacity; strokes use 100% for clarity
- [x] On hover: slight brighten or outline; no harsh contrast
- [x] Zero baseline / reference line: `data-neutral` (#635F69) at low opacity

---

## 3. CHART CONTAINER

The outer wrapper that holds any chart. Should match the skill's card style.

```
Background:   rgba(255,255,255,0.70) — card-bg (glass-clay hybrid)
Border radius: 32px (rounded-[32px])
Shadow:       shadow-clayCard (4-layer clay card stack)
Padding:      p-8 (32px) — standard card padding
```

**Questions to answer:**
- [x] Chart container uses the glass-clay card style (card-bg), not solid
- [x] Same hover lift as other cards: `-translate-y-2` + shadow-clayCardHover, 500ms ease-out
- [x] Optional header area: title (Nunito) + time filter (DM Sans, small), same padding

---

## 4. TYPOGRAPHY IN CHARTS

All text inside charts must use the skill's font system (Nunito + DM Sans).

| Element | Font | Size | Weight | Color |
|---|---|---|---|---|
| Chart title | Nunito | text-xl → text-2xl | 700–800 | #332F3A (foreground) |
| Axis labels | DM Sans | text-sm | 500 | #635F69 (muted) |
| Tick values | DM Sans | text-xs | 500 | #635F69 (muted) |
| Legend labels | DM Sans | text-sm | 500 | #332F3A (foreground) |
| Tooltip values | Nunito | text-base | 700–800 | #332F3A (foreground) |
| Tooltip labels | DM Sans | text-sm | 500 | #635F69 (muted) |

**Questions to answer:**
- [x] Numeric values in tooltips and stat cards use Nunito (graphic, consistent with stat numbers)
- [x] Body/axis text uses DM Sans; no monospace unless the skill adds it later
- [x] Minimum readable size: text-xs (12px) at smallest breakpoint; never smaller

---

## 5. GRID & AXES

The structural skeleton of the chart. Should feel like it belongs to the skill's
visual language — soft, not default browser stylesheet.

```
Grid lines:
  Color:    #635F69 at 12–15% opacity (muted, very subtle)
  Style:    solid
  Width:    1px

Axis lines:
  Color:    #635F69 at 25% opacity (slightly more visible than grid)
  Width:    1px
  Show X?   yes
  Show Y?   yes

Tick marks:
  Show?     optional; if yes, minimal length (4px)
  Color:    #635F69 (muted)
```

**Questions to answer:**
- [x] Minimal grid lines — visible but subtle so the candy-store colors lead
- [x] Axis labels: left for Y, bottom for X (standard)
- [x] Horizontal reference line at zero when relevant, using data-neutral

---

## 6. CHART TYPES & THEIR SPECIFIC RULES

### Line Chart
```
Line stroke:    2px, rounded linecap
Area fill:      gradient from accent to transparent; top opacity ~30%, bottom 0%
Data point dot: show on hover (default); or always for sparse data
Dot size:       6px
Dot border:     card-bg (rgba(255,255,255,0.70)) — floating dot effect
```

### Bar Chart
```
Bar fill:       data color at 70–80% opacity (vivid but not flat)
Bar radius:     top corners rounded-[12px] (nested radius rule: softer than card)
Bar gap:        gap between bars in group: 4–8px
Hover state:    brighten fill slightly + shadow-clayCard if bar is clickable
```

### Area Chart
```
Fill:           gradient: accent at top (~25% opacity) → transparent at bottom
Stroke:         accent at full opacity, 2px
Gradient stops: top 0.25 → bottom 0
```

### Donut / Pie Chart
```
Segment gap:    2px between segments (subtle separation)
Center label:   total value or primary metric; Nunito, text-2xl, font-weight 800
Center font:    Nunito
Hover:          segment brightens slightly; no heavy lift (keep chart stable)
Radius:         inner ~55% / outer 100% (donut ratio)
```

### Stat Card (single number)
```
Value font:     Nunito, font-weight 900, text-4xl → text-5xl
Delta display:  arrow + percentage; positive #10B981, negative #F59E0B
Sparkline:      mini line chart below, same data-1 color, stroke 1.5px
```

---

## 7. TOOLTIP

The most important interactive element in charts. Must feel native to the skill.

```
Background:   rgba(255,255,255,0.85) — slightly more opaque than card for legibility
Shadow:       shadow-clayCard (same 4-layer stack as cards)
Border radius: 12px (rounded-xl) — tooltip token from borders
Padding:      16px (p-4)
Border:       none (shadow defines edge)

Label:        DM Sans, #635F69, text-sm
Value:        Nunito, #332F3A, font-weight 700–800, text-base
Color dot:    6px circle, matching data series color
```

**Questions to answer:**
- [x] Tooltip follows cursor or anchors to data point (library default); prefer anchor for stability
- [x] Vertical cursor line on hover: optional; if present, use #635F69 at 20% opacity
- [x] Animate in: fade + slight scale (200ms ease-out) to match fast/smooth tokens
- [x] Show all series at that x-position when multiple series (Recharts default)

---

## 8. LEGEND

```
Position:     bottom (below chart) or inline with chart title (right)
Layout:       horizontal row, gap-4 (16px)
Item spacing: 16px between legend items
Color swatch: circle, 8px; or short line stroke 3px for line charts
Font:         DM Sans, text-sm, #332F3A (foreground)
```

---

## 9. MOTION & ANIMATION

Chart animations must match the skill's motion token system (clay physics).

```
Entry animation:    bars grow from zero; lines draw left to right (Recharts default)
Duration:           500ms (standard) for card-sized charts; 300ms (smooth) for small
Easing:             ease-out (lift)
Stagger:            series animate together; no stagger (keeps chart readable)
Hover transition:   200ms (fast) for tooltip appear / data point highlight
```

**Questions to answer:**
- [x] Personality supports smooth entry (bars grow, lines draw) — premium and deliberate
- [x] Bars grow from zero; do not fade in only
- [x] Line draws left to right when library supports it; otherwise appear with 300ms fade

**Reduced motion:** Respect `prefers-reduced-motion`; set duration to 0 or minimal (see motion.md).

---

## 10. EMPTY & LOADING STATES

```
Loading:      Skeleton matching skill — rounded-[32px], shadow-clayPressed (recessed),
              subtle #635F69 pulse or shimmer; same padding as chart container
Empty:        Centered message + icon; DM Sans, #635F69; optional Nunito for short title
Error:        #F59E0B (warning) for message; retry button uses accent + shadow-clayButton
```

---

## 11. RESPONSIVE BEHAVIOR

```
Mobile (< 640px):
  - Hide Y-axis labels? no — keep but reduce tick count
  - Reduce tick count? yes (e.g. 3–4 ticks per axis)
  - Simplify tooltip? no — keep full content, ensure touch targets
  - Minimum chart height: 240px

Tablet (640–1024px):
  - Standard tick count; full legend
  - Chart container padding: p-6 (24px) if needed

Desktop (> 1024px):
  - Full feature set; p-8 container padding
```

---

## 12. ACCESSIBILITY

- [ ] All data colors meet 3:1 contrast against the chart background (card-bg #FFF at 70% → use full-opacity strokes and sufficient fill contrast)
- [ ] Charts have `role="img"` and `aria-label` describing the data
- [ ] Tooltips are keyboard accessible (tab through data points where supported)
- [ ] Color is never the only differentiator — legend labels and (where possible) pattern or stroke style support
- [ ] Animations respect `prefers-reduced-motion` (see motion.md)

---

## 13. QUICK REFERENCE — THE NON-NEGOTIABLES

| Property | Value |
|---|---|
| Data color 1 | #7C3AED |
| Data color 2 | #DB2777 |
| Data color 3 | #0EA5E9 |
| Positive/up color | #10B981 |
| Negative/down color | #F59E0B |
| Grid line color | #635F69 at 12–15% opacity |
| Tooltip background | rgba(255,255,255,0.85) |
| Chart card shadow | shadow-clayCard (4-layer clay stack) |
