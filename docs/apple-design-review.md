# Design review: FinTechPro

Review and implementation: November 9–10, 2026. Baseline: `1165846`.
Skill: [apple-design](../.agents/skills/apple-design/SKILL.md).

## Summary

Rating: **Good after the changes**, from a baseline needing work on readability
and hierarchy. This is a React web application for monitoring investments, with
USD holdings valued in ILS. Its defining element is now a two-currency ledger:
the balance, daily move, unrealized gain/loss, and exchange rate are grouped with
their labels. This direction follows the product's actual currency needs rather
than a decorative finance template (design judgment).

Apple's accessibility, typography, color, layout and motion principles apply.
This is not a native iOS/macOS implementation or a claim of complete HIG/WCAG
certification. Browser measurements, source review and synthetic data flows were
used; no production holdings were changed.

## Critical findings resolved

- **Text contrast.** The selected benchmark range used white text on a bright
  green surface, measured at about **2.47:1**. It now uses the accent and its
  contrasting foreground: **5.47:1** in light appearance and **11.44:1** in dark.
  Source: [apple-design.css:171](../src/styles/apple-design.css#L171), range buttons.
  [accessibility.md › Vision](../.agents/skills/apple-design/references/hig/accessibility.md#vision):
  “Strive to meet color contrast minimum standards.”
- **Enlarged text.** At 320 CSS pixels and a 200% root text size, the Edit dialog
  initially had a 317-pixel scrolling body in 294 pixels of space. Wrapping
  action labels and allowing button height to grow brought both widths to 294;
  the close button stayed visible. Source:
  [apple-design.css:126](../src/styles/apple-design.css#L126).
  [typography.md › Supporting Dynamic Type](../.agents/skills/apple-design/references/hig/typography.md#supporting-dynamic-type):
  “Make sure your app’s layout adapts to all font sizes.” Web translation: rem
  text, wrapping controls, flexible rows and independent dialog scrolling.

## Improvements implemented

- **High — small investment data.** Stock-card metadata and change percentages
  measured 9–10px in the baseline; the core metadata now measures **13px**, with
  14px security names and 15px prices. Important names wrap and retain a title
  instead of being restricted to a 120-pixel single line. Source:
  [apple-design.css:95](../src/styles/apple-design.css#L95) and
  [apple-design.css:159](../src/styles/apple-design.css#L159).
  [typography.md › Ensuring legibility](../.agents/skills/apple-design/references/hig/typography.md#ensuring-legibility).
- **High — content competing with controls.** Stacked blur, inset highlights,
  large shadows and repeated card movement obscured hierarchy. Content cards
  are opaque, lightly bordered surfaces; restrained translucency belongs to the
  header/tab bar. Source: [apple-design.css:73](../src/styles/apple-design.css#L73).
  [liquid-glass.md › The two layers](../.agents/skills/apple-design/references/hig/liquid-glass.md#the-two-layers):
  “Functional layer.” CSS blur is a web material, not Apple's native Liquid Glass.
- **Medium — unlabeled totals.** Both currencies, daily changes, total unrealized
  gains/percentages, FX provenance and period returns remain present. Labels and
  grouping distinguish daily change from unrealized gains. The overview measured
  563px high before and 411px after at 390px width with the same fixture.
  Source: [PortfolioHero.tsx:77](../src/components/PortfolioHero.tsx#L77).
  [layout.md › Visual hierarchy](../.agents/skills/apple-design/references/hig/layout.md#visual-hierarchy).
- **Medium — navigation and action visibility.** Retained all four main views
  and More, the language switch, Add/Edit/Remove, tools, AI connections and logout.
  Selected desktop views now expose `aria-pressed`. Watchlist removal and search
  result actions remain visible without hover. Stock-card actions have explicit
  44px hit regions; cards no longer imply a whole-card click action. Source:
  [Dashboard.tsx:82](../src/components/Dashboard.tsx#L82).
  [buttons.md › Best practices](../.agents/skills/apple-design/references/hig/buttons.md#best-practices)
  and [tab-bars.md › Best practices](../.agents/skills/apple-design/references/hig/tab-bars.md#best-practices).
- **Medium — chart accessibility.** Semantic portfolio/benchmark strokes, solid
  sector tiles with readable foregrounds, labeled analyst badges, and low-tint
  correlation cells preserve meaning in both appearances. Correlation values
  retain their numerical labels; cells are keyboard reachable, have accessible
  pair/value labels, a visible focus ring and focus-revealed details. Matrix
  indentation uses logical positioning for Hebrew. Values/formulas were not
  changed. Source:
  [CorrelationMatrix.tsx:70](../src/components/Analytics/CorrelationMatrix.tsx#L70).
- **Medium — user preferences.** Automatic light/dark appearances follow the
  device. Reduced motion applies to CSS and Framer Motion; automatic news page
  rotation pauses when reduced motion is requested, with manual pagination
  retained. Increased contrast strengthens borders and removes bar blur.
  Reduced-transparency and forced-colors branches remove blur too. Source:
  [LiveMarketNews.tsx:23](../src/components/LiveMarketNews.tsx#L23) and
  [apple-design.css:210](../src/styles/apple-design.css#L210).
  [motion.md › Best practices](../.agents/skills/apple-design/references/hig/motion.md#best-practices).

## Craft notes and tokens

The proposal uses one quiet signature — the currency ledger — rather than
spending emphasis on every card. The original shield/chart icon and FinTechPro
name are retained, using the existing icon asset with legible adjacent text.
The large blurred logo backing and decorative heartbeat icon were removed;
neither had an action or carried portfolio data. Navigation keeps familiar
Lucide icons and the original view order. This is a product-specific choice,
not a change to investment behavior.

Six core roles have light/dark variants. Canvas, borders and tints are derived
by mixing surface with content/accent; warning text has a separate status role.
Contrast below is measured against the corresponding opaque surface.
Neutral control borders use a stronger mix than decorative card separators:
3.16:1 in light appearance and 5.55:1 in dark appearance. Refresh helper text
uses the same readable secondary-text role as the rest of the interface.

| Role | Light | Ratio | Dark | Ratio |
| --- | --- | --- | --- | --- |
| Surface | `#FFFFFF` | — | `#111D29` | — |
| Content | `#172B3A` | 14.55 | `#EDF3F8` | 15.25 |
| Secondary | `#526476` | 6.10 | `#BAC8D5` | 10.00 |
| Accent | `#0F766E` | 5.47 | `#6EE7D8` | 11.44 |
| Positive | `#15803D` | 5.02 | `#86EFAC` | 12.14 |
| Negative | `#BE123C` | 6.29 | `#FDA4AF` | 9.02 |

Typography uses the platform UI font stack, 16px body base, 15px supporting UI,
13px core captions, a 12px minimum utility floor, and a fluid 32–44px primary
balance. Tabular numerals and bidi isolation preserve readable financial values.
No display font download was added. All new copy is in the existing bilingual
catalog. Content is quiet; motion supplies brief feedback rather than decoration.

Layout: a single column at compact widths becomes a ledger plus results and
a sidebar at regular widths, while retaining the same actions.

```text
Compact                       Regular
Brand   Language  Add         Sidebar | Balance ILS/USD | Today | Unrealized
Balance ILS / USD                     | FX + period returns
Today | Unrealized                    | Activity / Alerts / Export
FX + period returns                   | Views + Add
Tools                                 | Holdings / Insights / Watchlist / Calendar
Content                               | Performance history
Four views + More
```

## What works and was preserved

- Existing quote provenance, stale/estimated labels and refresh/retry behavior.
- English/Hebrew switching, persisted preference, logical RTL layout, LTR numbers.
- Radix dialog focus handling, close/cancel, scrolling and viewport safeguards.
- Holdings/lots CRUD and soft deletion; FIFO activity and realized-gain logic.
- Health formula, fund look-through/overlap, source dates, dividend eligibility,
  analyst and benchmark calculations, correlation interval alignment.
- Personal alerts, activity ledger, Excel export, AI key tools and logout.

No production server, API-client, context or database schema changes were made.
The overview's calculation block was retained; changes there are presentation.
The test fixture adds a financial-data digest and synthetic matrix data only.
There is no migration, and reverting the UI commit does not require data rollback.

## Validation

- **31 unit/regression tests** and **22 disposable MongoDB integration tests**
  passed; TypeScript and production build passed; `git diff --check` passed.
- Dedicated browser, `npm run qa:server -- --seed-fund --localization`.
  Synthetic GOOG/MA/IVV data kept USD value 1,500, ILS value 5,250, score 71,
  and sector coverage 99.98% through presentation changes.
- Financial digest and holding count matched before/after draft editing,
  language/appearance changes and cancel. Quantity 7.5 remained in the draft
  after language/appearance switching; cancel preserved the stored quantity 4.
- Added AAPL with 2 shares, refreshed, edited to 3, saved and refreshed again:
  the displayed quantity persisted. Created a 140-USD alert against a 150-USD
  fixture quote: it triggered once and paused.
- Recorded a fee of 1.25, refreshed and verified its activity note persisted
  while the share quantity stayed 4. Downloaded Excel contained nine OOXML parts
  and Read me/Holdings/Lots/Activity/Cash sheets, including the fee note.
- Checked main navigation, data tools, Edit/Add/Record dialogs and the nested
  mobile menu/AI tool list. AI key creation was not submitted.
- Checked 320×740, 390×844, short-height dialogs, 768×1000, 844×390 and
  1440×1000; RTL/LTR, light/dark, 200% root text, reduced motion and higher
  contrast. Main scroll/client widths matched in sampled layouts. Short-height
  dialog and large-text close controls remained visible. Keyboard Tab reached
  the next matrix cell with a 3px outline and visible details.
- Final local console inspection: no errors or warnings. During implementation
  a local syntax error was caught and corrected before build/deployment; expired
  fixture sessions were renewed. Those development events are not production QA.
- An intentional one-request 503 outage retained three holdings and the ILS
  balance, displayed a retry action, and recovered on retry. The expected HTTP
  and fetch-error console messages from that negative test were distinguished
  from the clean, fresh-navigation inspection.

## Platform notes and limits

These are desktop browser viewport/preference checks, not a physical iPhone,
VoiceOver, native keyboard, or complete accessibility certification. The
reduced-transparency branch was reviewed in source; higher contrast exercised
its shared no-blur treatment. Public sign-in can be smoke-tested after deployment;
authenticated production portfolio testing needs the owner's separate login.
No production account data or external AI provider was used in this review.
