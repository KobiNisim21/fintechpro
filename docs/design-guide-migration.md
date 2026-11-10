# Design guide migration: stage 1

The Dashboard shell is the first migrated component, following `DESIGN_GUIDE.md`
sections 3.1, 3.9, 3.14 and 8. Its page canvas, headings, segmented controls and
local loading placeholders use the supplied tokens. A static wrapper caps content
at 1400px. Mobile safe-area spacing, navigation and pull-to-refresh are retained.

Tailwind 4 now explicitly loads the supplied `tailwind.config.js`. Legacy
`--app-*` CSS aliases use the guide's light palette, radii, shadows and font stack,
so old semantic CSS does not override the new colors. The existing generated CSS
contains a later font utility; the `--font-sans` alias keeps its font consistent.
Other component files have not been refactored in this stage.

Validation (2026-11-10):

- The complete TypeScript AST, excluding class/style attributes and static div
  layout wrappers, matches the previous Dashboard exactly. Hooks, props, handlers,
  imports, API callbacks and translated content are unchanged.
- 34 existing offline tests passed; production build and whitespace checks passed.
- Browser: all four desktop views switched correctly; Hebrew/RTL and English/LTR
  worked. At 320, 390, 768, 1440 and 1920px, the tested main content had no
  horizontal overflow. Wide content measured 1400px, headings 24px, desktop
  padding 24px, tabs 13px text with 44px minimum targets. Canvas measured
  `rgb(245,245,247)`, ink `rgb(10,16,31)`, muted tab text `rgb(138,146,178)`.
- Three synthetic holdings and their financial digest remained unchanged;
  no console warnings or errors were observed. No real portfolio was modified.

Next stage: Sidebar / SidebarContent, followed by each component in section 7,
with a separate rendering and behavior check after each component. Tracked in
`TraderAi-7dj`. The owner's untracked `design-system-summary.md` was read and left
unchanged.

## Stage 2: charts and sector distribution

The owner's dashboard reference was applied sequentially to InsightsView,
PortfolioChart, then PortfolioBenchmarkChart. White cards use 12px corners,
the guide's soft shadows, 20px gaps and 16/24px responsive padding. Sector blocks
keep their existing colors and percentage formula, with 10px corners, caption
labels and prominent tabular percentages. Analyst cards and pill badges follow
the same surface and color tokens. Allocation uses the guide's chart palette.

Growth keeps its original line chart and historical series, with a 2px stroke,
subtle grid, 11px axes and a white tooltip. Benchmark retains its date slicing,
comparison series and range handlers; the portfolio line/fill is accent purple,
the comparison stays dashed, and tooltip colors match the lines. Chart areas are
300px on mobile and 380px from tablet upward. The benchmark card no longer
stretches a large empty white area to match the taller health panel. Legacy
generated utilities required scoped grid and radius rules to render the exact
specified measurements. Narrow allocation labels are centered without changing
their data or chart geometry.

Stage 2 validation (2026-11-10):

- All three components' complete non-visual TypeScript ASTs match HEAD, excluding
  only class/style attributes and Recharts tooltip style objects. Hooks, API
  calls, data transformations, props, event handlers and formatters are identical.
- 34 offline tests and the production build passed; whitespace checks passed.
- Browser checked 320/390/768/1440px, Hebrew RTL and English LTR, all three range
  buttons (44px targets), sector labels, allocation labels and both chart series.
  No main-content horizontal overflow or console warnings/errors were observed.
- At 320px all allocation labels remain inside the card; all sector labels fit.
  Rendered sector/card radii are 10/12px, desktop chart height is 380px, and
  desktop chart columns render side by side.
- Synthetic financial digest, sector values/percentages and benchmark points
  matched the captured pre-styling baseline exactly. Growth statistics remained
  +1.35%, +ILS1,750 and +ILS35. No real holdings were modified.
- Screenshots were inspected for sector blocks and benchmark rendering after
  responsive chart resizing settled. Reference styling changes presentation;
  it does not add a new chart type or change the financial meaning of a series.

Continue the remaining component migration in `TraderAi-7dj`, including the
health panel's content hierarchy and the remaining navigation/cards.
