# FinTechPro — Design System Guide

> **Purpose:** This document is the single source of truth for visual styling of the FinTechPro web application. It is designed to be consumed by AI coding agents (Codex, Cursor, Gemini, Claude) during visual refactoring tasks.

---

> [!CAUTION]
> ## 🔴 CRITICAL: Code Logic Protection Rule
>
> **DO NOT modify, refactor, rename, move, or delete any:**
> - React state (`useState`, `useReducer`, context values)
> - React hooks (`useEffect`, `useMemo`, `useCallback`, `useRef`, custom hooks)
> - Event handlers (`onClick`, `onChange`, `onSubmit`, form logic)
> - API calls, data fetching, or service layer code
> - Context providers or consumers
> - Route definitions or lazy-loaded imports
> - TypeScript interfaces, types, or props
> - Business logic, calculations, or data transformations
> - i18n/translation function calls (`t()`, `useLanguage()`, `locale()`)
>
> **You may ONLY change:**
> - CSS class names (Tailwind utilities)
> - Inline `style` attributes (visual only)
> - `className` props
> - CSS custom properties (visual tokens only)
> - CSS/SCSS files
> - Static wrapper `<div>` elements for layout purposes (no logic attached)
>
> **If a component's visual structure requires a new wrapper `<div>`**, you may add one — but it must have **zero event handlers, zero state, zero hooks**. It exists only for styling/layout.

---

## 1. Design Philosophy

This system follows a **modern FinTech dashboard** aesthetic inspired by premium crypto/trading platforms:

- **Light mode first** — clean off-white canvas with white elevated cards
- **Soft depth** — multi-layer box shadows instead of hard borders
- **Generous whitespace** — 24px card padding, 20px grid gaps
- **Pill-shaped badges** — rounded-full for status indicators and trend tags
- **Neutral typography** — Inter font family, tight letter-spacing on headings
- **Restrained color** — only trend colors (green/red) carry semantic meaning

---

## 2. Global Tokens (from `tailwind.config.js`)

### 2.1 Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `canvas` | `#F5F5F7` | Page background (body, main content area) |
| `surface` | `#FFFFFF` | Card backgrounds, modals, sidebar |
| `surface-alt` | `#FAFAFA` | Hover states, alternating table rows |
| `ink` | `#0A101F` | Primary text: headings, monetary values |
| `ink-soft` | `#1A1A2E` | Slightly softer primary text |
| `secondary` | `#8A92B2` | Labels, meta info, column headers |
| `tertiary` | `#B0B5C9` | Disabled text, placeholders |
| `accent` | `#5D41EC` | Primary CTA buttons, active tab indicator |
| `accent-hover` | `#4C33D4` | Accent hover state |
| `accent-soft` | `#EDE9FC` | Accent-tinted backgrounds |
| `positive` | `#07AB81` | Gains, buy actions, upward trends |
| `positive-soft` | `#DEF8F1` | Green badge backgrounds |
| `negative` | `#E5484D` | Losses, sell actions, downward trends |
| `negative-soft` | `#FFEAEB` | Red badge backgrounds |
| `warning` | `#F7931A` | Bitcoin orange, caution states |
| `line` | `#E8E8ED` | Borders, dividers, card outlines |
| `line-strong` | `#D1D1D9` | Emphasized dividers |

### 2.2 Typography Scale

| Name | Size | Weight | Use |
|------|------|--------|-----|
| `text-hero` | 2.75rem / 44px | 700 | Portfolio total value |
| `text-heading` | 1.5rem / 24px | 600 | Section titles ("Watchlist", "Holdings") |
| `text-subhead` | 1.125rem / 18px | 600 | Card titles, stock symbols |
| `text-body` | 0.9375rem / 15px | 400 | Body text, descriptions |
| `text-caption` | 0.8125rem / 13px | 500 | Labels, timestamps, meta |
| `text-micro` | 0.6875rem / 11px | 500 | Tiny badges, chart annotations |

### 2.3 Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `rounded-xl` | 12px | **Primary card radius** (all data cards) |
| `rounded-2xl` | 16px | Hero card, large feature panels |
| `rounded-lg` | 10px | Input fields, small cards |
| `rounded-md` | 8px | Buttons, dropdowns |
| `rounded-pill` | 9999px | Pill badges, toggle switches |

### 2.4 Box Shadows

| Token | Use |
|-------|-----|
| `shadow-card` | Default card elevation |
| `shadow-card-hover` | Card on hover |
| `shadow-sidebar` | Left sidebar rail |
| `shadow-input` | Inset input fields |
| `shadow-modal` | Dialogs / overlays |
| `shadow-badge` | Floating pill badges |
| `shadow-button` | Action buttons |

---

## 3. Component Specifications

### 3.1 Page Canvas / Layout Shell

```
┌─────────────────────────────────────────────────┐
│  Sidebar (280px)  │     Main Content Area       │
│  bg-surface       │     bg-canvas               │
│  shadow-sidebar   │     px-6 py-6               │
│  border-r line    │     space-y-6               │
│                   │     overflow-y-auto          │
└─────────────────────────────────────────────────┘
```

**Classes:**
```
Dashboard shell:   "flex h-screen w-full bg-canvas"
Main content:      "flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-canvas"
```

**Rules:**
- Body background: `bg-canvas` (`#F5F5F7`)
- No gradient backgrounds — flat solid canvas
- Content constrained to `max-w-[1400px] mx-auto` on xl screens
- Minimum `gap-5` (20px) between all card-level elements

---

### 3.2 Sidebar (Navigation Rail)

**Target appearance:** White panel, fixed left, full height with subtle right shadow.

```
Container:     "w-[280px] h-full bg-surface border-r border-line shadow-sidebar
                flex flex-col shrink-0 overflow-hidden"
```

| Element | Classes |
|---------|---------|
| Brand block | `"flex items-center gap-3 px-6 pt-6 pb-4"` |
| Logo image | `"w-11 h-11 rounded-xl"` |
| Brand name | `"text-subhead text-ink font-semibold tracking-tight"` |
| Subtitle | `"text-caption text-secondary"` |
| Section label | `"text-micro text-secondary uppercase tracking-wider px-6 pt-6 pb-2"` |
| Nav items | `"flex items-center gap-3 px-6 py-3 rounded-lg text-body text-secondary hover:bg-surface-alt hover:text-ink transition-colors duration-fast"` |
| Active nav item | Add: `"bg-accent-soft text-accent font-medium"` |
| Footer | `"mt-auto px-6 py-5 border-t border-line space-y-3"` |
| Logout button | `"flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-surface border border-line text-ink font-semibold text-caption hover:shadow-button transition-all duration-base"` |

**Sidebar news/alerts cards:**
```
"bg-surface-alt rounded-lg p-3 text-caption text-secondary space-y-1"
```

**Live badge:** `"inline-flex items-center gap-1.5 px-2 py-0.5 rounded-pill bg-positive-soft text-positive text-micro font-semibold"`

**"New" count badge:** `"inline-flex items-center justify-center px-1.5 py-0.5 rounded-pill bg-accent text-white text-micro font-semibold min-w-[20px]"`

---

### 3.3 Bento Cards (Data Panels)

Every data card in the app follows this base pattern:

```
Base card:  "bg-surface rounded-xl shadow-card p-card
             border border-line/50
             transition-shadow duration-base
             hover:shadow-card-hover"
```

> [!IMPORTANT]
> **Border:** Use `border border-line/50` (50% opacity) for a barely-visible structural outline. The depth comes from `shadow-card`, not from borders.

**Card header row:**
```
"flex items-center justify-between mb-4"
```

**Card title:**
```
"text-subhead text-ink font-semibold"
```

**Card subtitle / meta:**
```
"text-caption text-secondary"
```

---

### 3.4 Portfolio Hero Card

The top-level summary card. Larger padding and bigger typography.

```
Container:    "bg-surface rounded-2xl shadow-card p-card-lg"
```

| Element | Classes |
|---------|---------|
| Total value (ILS) | `"text-hero text-ink"` |
| Total value (USD) | `"text-heading text-ink-soft font-semibold"` |
| Currency label | `"text-caption text-secondary"` |
| Daily change (positive) | `"text-body text-positive font-semibold"` |
| Daily change (negative) | `"text-body text-negative font-semibold"` |
| Change badge (positive) | `"inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-positive-soft text-positive text-caption font-semibold"` |
| Change badge (negative) | `"inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-negative-soft text-negative text-caption font-semibold"` |
| Period return labels | `"text-micro text-secondary uppercase tracking-wider"` |
| Period return values | `"text-body font-semibold tabular-nums"` — inherit positive/negative color |
| Exchange rate line | `"text-caption text-secondary flex items-center gap-2"` |
| Status badge ("Market data") | `"text-micro text-secondary px-2 py-0.5 rounded-pill border border-line"` |

---

### 3.5 Stock / Holding Cards

Individual position cards inside the bento grid.

```
Container:    "bg-surface rounded-xl shadow-card p-card
               border border-line/50
               hover:shadow-card-hover transition-shadow duration-base"
```

| Element | Classes |
|---------|---------|
| Ticker symbol | `"text-subhead text-ink font-bold tracking-tight"` |
| Company name | `"text-caption text-secondary truncate"` |
| Change badge (positive) | `"inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-positive-soft text-positive text-micro font-semibold"` |
| Change badge (negative) | `"inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-negative-soft text-negative text-micro font-semibold"` |
| Price value | `"text-heading text-ink font-bold tabular-nums"` |
| Detail labels (Shares, Total Value) | `"text-caption text-secondary"` |
| Detail values | `"text-body text-ink font-medium tabular-nums"` |
| Action icons (edit, delete) | `"p-2 rounded-lg text-secondary hover:text-ink hover:bg-surface-alt transition-colors"` — min 44px touch target |
| Sparkline chart | Container: `"h-16 w-full"` — line color inherits positive/negative |
| Period tabs (Day/Week/Month/Year) | `"flex gap-1 bg-canvas rounded-lg p-1"` |
| Active period tab | `"px-3 py-1.5 rounded-md bg-surface shadow-subtle text-ink text-caption font-semibold"` |
| Inactive period tab | `"px-3 py-1.5 rounded-md text-secondary text-caption hover:text-ink transition-colors"` |
| Period change value (negative) | `"text-caption text-negative font-medium"` |

**Grid layout for stock cards:**
```
Desktop (≥1280px): "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-gap"
Tablet (768-1279px): "grid grid-cols-2 gap-gap"
Mobile (<768px):    "grid grid-cols-1 gap-4"
```

---

### 3.6 Metric / KPI Displays

Used for standalone numeric displays (portfolio value, returns, counts).

**Large metric (hero-level):**
```
Value:   "text-hero text-ink tabular-nums"
Label:   "text-caption text-secondary block mb-1"
```

**Medium metric (in-card):**
```
Value:   "text-heading text-ink font-bold tabular-nums"
Label:   "text-caption text-secondary block mb-0.5"
```

**Small metric (inline):**
```
Value:   "text-body text-ink font-semibold tabular-nums"
Label:   "text-micro text-secondary"
```

**Trend indicator pattern:**
```jsx
// Positive
<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-positive-soft text-positive text-caption font-semibold">
  ▲ +$107.06
</span>

// Negative
<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-negative-soft text-negative text-caption font-semibold">
  ▼ -$23.50
</span>
```

> [!TIP]
> Always use `tabular-nums` (`font-variant-numeric: tabular-nums`) on monetary values and percentages. This prevents layout shifts when numbers change.

---

### 3.7 Data Tables

Used for transactions, holdings lists, watchlist items.

```
Table container: "bg-surface rounded-xl shadow-card overflow-hidden border border-line/50"
```

| Element | Classes |
|---------|---------|
| Table header row | `"bg-canvas border-b border-line"` |
| Header cell | `"px-card py-3 text-caption text-secondary font-medium uppercase tracking-wider text-left"` |
| Body row | `"border-b border-line/50 hover:bg-surface-alt transition-colors duration-fast"` |
| Body cell | `"px-card py-4 text-body text-ink"` |
| Numeric cell | Add: `"tabular-nums text-right"` |
| Row with action | `"cursor-pointer"` |

**Table type badges:**
```
Buy:    "px-3 py-1 rounded-pill bg-positive-soft text-positive text-caption font-semibold"
Sell:   "px-3 py-1 rounded-pill bg-negative-soft text-negative text-caption font-semibold"
```

**Empty state inside table:**
```
"py-12 text-center text-body text-secondary"
```

**Table toolbar / filter row:**
```
"flex items-center justify-between px-card py-3 border-b border-line"
```

**Dropdown inside toolbar:**
```
"px-3 py-1.5 rounded-md border border-line bg-surface text-caption text-secondary
 hover:border-line-strong focus:ring-2 focus:ring-accent/30 transition-all"
```

---

### 3.8 Forms & Input Fields

Used in the Trade form, Add Position dialog, Personal Alerts.

**Input fields:**
```
"w-full px-4 py-3 rounded-lg bg-canvas border border-line text-body text-ink
 placeholder:text-tertiary
 shadow-input
 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
 transition-all duration-base"
```

**Labels:**
```
"block text-caption text-secondary font-medium mb-1.5"
```

**Select / Dropdown:**
```
"w-full px-4 py-3 rounded-lg bg-canvas border border-line text-body text-ink
 shadow-input appearance-none
 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
```

**Checkbox / Toggle:**
```
Track:       "w-10 h-5 rounded-pill bg-line transition-colors peer-checked:bg-accent"
Thumb:       "w-4 h-4 rounded-full bg-surface shadow-badge"
```

**Form section dividers:**
```
"border-t border-line my-4"
```

**Summary row in forms (e.g., Trade summary):**
```
Row:    "flex justify-between py-2 text-caption"
Label:  "text-secondary"
Value:  "text-ink font-medium tabular-nums"
```

**Dialog / Modal container:**
```
"bg-surface rounded-2xl shadow-modal p-0 max-w-lg w-full mx-auto overflow-hidden"
```

**Dialog header:**
```
"flex items-center justify-between px-card py-4 border-b border-line"
Title:  "text-subhead text-ink font-semibold"
Close:  "p-2 rounded-lg text-secondary hover:text-ink hover:bg-surface-alt"
```

**Dialog body:**
```
"px-card py-5 space-y-4"
```

**Dialog footer:**
```
"flex justify-end gap-3 px-card py-4 border-t border-line bg-canvas"
```

---

### 3.9 Action Buttons

**Primary (filled accent):**
```
"inline-flex items-center justify-center gap-2
 px-5 py-3 rounded-xl
 bg-accent text-white font-semibold text-body
 shadow-button
 hover:bg-accent-hover hover:shadow-button-hover
 active:scale-[0.98]
 transition-all duration-base
 disabled:opacity-50 disabled:cursor-not-allowed"
```

**Secondary (outlined):**
```
"inline-flex items-center justify-center gap-2
 px-5 py-3 rounded-xl
 bg-surface text-ink font-semibold text-body
 border border-line
 shadow-subtle
 hover:border-line-strong hover:shadow-button
 active:bg-surface-alt
 transition-all duration-base"
```

**Ghost (no background):**
```
"inline-flex items-center justify-center gap-2
 px-3 py-2 rounded-lg
 text-secondary text-caption font-medium
 hover:text-ink hover:bg-surface-alt
 transition-colors duration-fast"
```

**Danger / Destructive:**
```
"inline-flex items-center justify-center gap-2
 px-5 py-3 rounded-xl
 bg-negative text-white font-semibold text-body
 hover:bg-[#D03E43]
 transition-all duration-base"
```

**Icon-only button:**
```
"inline-flex items-center justify-center
 w-10 h-10 rounded-lg
 text-secondary
 hover:text-ink hover:bg-surface-alt
 transition-colors duration-fast"
```

**Tab / Segmented Control:**
```
Container:    "flex bg-canvas rounded-xl p-1 border border-line/50"
Active tab:   "px-4 py-2 rounded-lg bg-surface shadow-badge text-ink text-caption font-semibold"
Inactive tab: "px-4 py-2 rounded-lg text-secondary text-caption hover:text-ink transition-colors"
```

> [!IMPORTANT]
> All interactive elements must have a minimum touch target of **44×44px** (min-h-11 min-w-11).

---

### 3.10 Charts & Data Visualization

**Chart container card:**
```
"bg-surface rounded-xl shadow-card p-card border border-line/50"
```

**Chart area:**
```
"w-full h-[300px] md:h-[380px]"
```

**Recharts color mapping:**
| Semantic | Tailwind Token | Hex |
|----------|---------------|-----|
| Line/Bar 1 | `chart-1` | `#5D41EC` |
| Line/Bar 2 | `chart-2` | `#07AB81` |
| Line/Bar 3 | `chart-3` | `#F7931A` |
| Line/Bar 4 | `chart-4` | `#3B82F6` |
| Line/Bar 5 | `chart-5` | `#E5484D` |

**Chart tooltip:**
```
"bg-surface rounded-lg shadow-card p-3 border border-line text-caption"
Tooltip label:  "text-secondary text-micro mb-1"
Tooltip value:  "text-ink font-semibold tabular-nums"
```

**Chart axis labels:**
```
font-size: 11px, color: #8A92B2 (secondary)
```

**Donut / Pie chart labels:**
```
"text-caption text-secondary"
Value:  "text-body text-ink font-semibold"
```

---

### 3.11 Sector Distribution (Treemap / Grid blocks)

```
Container:  "bg-surface rounded-xl shadow-card p-card border border-line/50"
```

**Sector blocks retain their semantic colors** (green, blue, yellow, purple, red, etc.) — do not change those. Style adjustments:

```
Block:       "rounded-lg p-4 text-white"
Block label: "text-caption font-medium opacity-90"
Block value: "text-heading font-bold"
```

---

### 3.12 Correlation Matrix / Heatmap

```
Container:  "bg-surface rounded-xl shadow-card p-card border border-line/50"
```

| Element | Classes |
|---------|---------|
| Header cell | `"text-caption text-secondary font-medium"` |
| Value cell | `"text-caption font-mono tabular-nums text-center p-2"` |
| Positive correlation | Background gradient from `positive-soft` to `positive` based on value |
| Negative correlation | Background gradient from `negative-soft` to `negative` based on value |
| Neutral (1.00) | `"bg-accent-soft text-accent"` |

---

### 3.13 Badges & Status Indicators

**Pill badge (generic):**
```
"inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-micro font-semibold"
```

**Variants:**

| Type | Background | Text |
|------|-----------|------|
| Positive | `bg-positive-soft` | `text-positive` |
| Negative | `bg-negative-soft` | `text-negative` |
| Warning | `bg-warning-soft` | `text-warning` |
| Neutral | `bg-canvas` | `text-secondary` |
| Accent | `bg-accent-soft` | `text-accent` |
| Live | `bg-positive-soft` | `text-positive` + pulsing dot |

**Pulsing live dot:**
```
"w-2 h-2 rounded-full bg-positive animate-pulse"
```

**Ticker symbol badge (e.g., $GOOG):**
```
"inline-flex px-2 py-0.5 rounded-pill bg-accent-soft text-accent text-micro font-semibold"
```

---

### 3.14 Loading & Skeleton States

**Skeleton placeholder:**
```
"bg-canvas rounded-lg animate-pulse"
```

**Skeleton card:**
```
"bg-surface rounded-xl shadow-card p-card border border-line/50"
Inner blocks: "h-4 bg-canvas rounded-md animate-pulse mb-3"
```

**Spinner (if used):**
```
"w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin"
```

---

### 3.15 Scrollbar Styling

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #D1D1D9; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #8A92B2; }
* { scrollbar-width: thin; scrollbar-color: #D1D1D9 transparent; }
```

---

## 4. Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 768px | Single column, bottom tab bar, no sidebar |
| Tablet | 768px – 1279px | Sidebar visible, 2-column card grid |
| Desktop | ≥ 1280px | Sidebar, auto-fill grid (min 280px columns) |
| Wide | ≥ 1440px | Content max-width 1400px, centered |

**Mobile-specific overrides:**
- Bottom tab bar: `"fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-line"`
- Mobile header: `"fixed top-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-b border-line z-50"`
- Cards get `rounded-xl` (no change), `p-card-sm` (16px padding on mobile)
- Hero value scales down: `text-[2rem]` on mobile

---

## 5. Transition & Animation Rules

1. **Shadow transitions:** `transition-shadow duration-base` on all cards
2. **Color transitions:** `transition-colors duration-fast` on interactive elements
3. **Scale on press:** `active:scale-[0.98]` on primary buttons only
4. **No vertical translate hovers** — Remove any `hover:-translate-y-*` classes
5. **Respect `prefers-reduced-motion`** — animations auto-disable via Tailwind

---

## 6. Accessibility Checklist

- All interactive elements: minimum **44×44px** touch target
- Focus visible: `focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2`
- Contrast ratios: `ink` on `surface` = 15.8:1 ✓, `secondary` on `surface` = 4.6:1 ✓
- Trend colors: never rely on color alone — pair with ▲/▼ arrows or +/- signs
- Skip-to-content link preserved
- `aria-label`, `aria-expanded`, `aria-current` attributes must not be removed

---

## 7. Migration Checklist

When applying this design system to existing components, follow this order:

1. **`globals.css`** — Update CSS custom properties to match new tokens
2. **`apple-design.css`** — Update `--app-*` variables to new palette
3. **Layout shell** (`Dashboard.tsx`) — Canvas background, flex structure
4. **Sidebar** (`Sidebar.tsx`, `SidebarContent.tsx`) — Surface bg, shadow-sidebar
5. **PortfolioHero** — Hero card with new shadow, typography, badges
6. **StockCard** — Card styling, badges, sparkline colors
7. **StockGrid** — Grid layout gaps
8. **PortfolioTools** — Button styles (secondary/ghost)
9. **WatchlistView** — Table and tab styles
10. **InsightsView** — Chart cards, sector blocks
11. **PortfolioChart** — Chart container and tooltip
12. **AddPositionDialog** — Form inputs, dialog shell
13. **LoginForm** — Form styling
14. **MobileNav / BottomTabBar** — Mobile-specific header/footer
15. **LiveAlerts / LiveMarketNews** — Sidebar card variants

> [!WARNING]
> Do **NOT** refactor multiple components simultaneously. Apply to one component, verify it renders correctly, then proceed to the next.

---

## 8. Quick Reference: Class Mapping Cheat Sheet

| Old Pattern | New Pattern |
|-------------|-------------|
| `bg-[#0f0f12]` | `bg-canvas` |
| `bg-white/5`, `bg-white/10` | `bg-surface-alt` |
| `border-white/10`, `border-white/20` | `border-line` or `border-line/50` |
| `text-slate-800`, `text-slate-900` | `text-ink` |
| `text-slate-500`, `text-slate-600` | `text-secondary` |
| `text-emerald-*` (gain context) | `text-positive` |
| `text-rose-*`, `text-red-*` (loss context) | `text-negative` |
| `text-cyan-*`, `text-blue-*` (accent) | `text-accent` |
| `bg-emerald-500/20` | `bg-positive-soft` |
| `rounded-2xl` (on cards) | `rounded-xl` |
| `glass-card`, `glass-card-solid` | `bg-surface rounded-xl shadow-card border border-line/50` |
| `data-panel` | `bg-surface rounded-xl shadow-card p-card border border-line/50` |
| `hover:-translate-y-*` | Remove — use `hover:shadow-card-hover` instead |
| `backdrop-blur-xl` (on cards) | Remove — cards are opaque `bg-surface` |
| `shadow-ios-card` (inline style) | `shadow-card` (Tailwind class) |

---

## 9. File Locations

| File | Path | Purpose |
|------|------|---------|
| Tailwind Config | `tailwind.config.js` | Theme extension with all tokens |
| Global Styles | `src/styles/globals.css` | CSS custom properties, @theme |
| Apple Design CSS | `src/styles/apple-design.css` | Component-level CSS rules |
| Desktop Overrides | `src/styles/desktop.css` | Responsive desktop tweaks |
| Mobile Overrides | `src/styles/mobile.css` | Mobile-specific styles |
| Generated CSS | `src/index.css` | Tailwind output (auto-generated) |

---

*Last updated: November 2026 — Extracted from Figma design kit reference*
