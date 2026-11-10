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

## Stage 3: allocation bubbles

The owner supplied the four-circle asset allocation reference and inspector
measurements. AllocationBubbles adds that visual language to Portfolio Allocation:
purple `#5D41EC`, gray `#8A92B2`, near-black ink, orange `#F7931A`, and offset thin
decorative rings. Areas, rather than diameters, are proportional to actual market
values; layout adapts to available width instead of hard-coding the reference's
four percentages or fixed pixel sizes. Orange/green labels use ink for legibility.

The presentation helper combines repeated symbols, keeps every positive-value
holding in the legend and uses a disclosed aggregate for smaller holdings only
when there are more than eight. Percentages and amounts remain visible in the
legend even when a bubble is too small for an internal label. Packing is bounded
to eight circles, deterministic, non-overlapping, and does not mutate source data.

The original donut chart, its original data/props and tooltip remain available
through a native details disclosure. All existing InsightsView hook calls/bodies,
fetching, distribution calculations and handlers were compared with HEAD and
remain identical. No server, schema, financial context or dependency was changed.
New explanatory labels are translated in both languages.

Validation (2026-11-10): 37 offline tests and production build passed. New tests
cover the reference 43/27/18/12 allocation, proportional areas, deterministic
packing, empty/single/duplicate/tiny holdings, 2–8 circles, 100 legend entries,
aggregate totals, invalid values and viewBox bounds. Browser checked English/LTR
and Hebrew/RTL at 320, 768 and 1440px; no horizontal overflow or console warnings
or errors were observed in the application. Native donut opening/closing retained
MA/GOOG/IVV at 40/40/20, matching bubble percentages and USD600/USD600/USD300.
The synthetic financial digest remained unchanged. A separate four-asset preview
was rendered and inspected, then removed; no production portfolio was modified.

## Stage 4: quiet sectors and large-portfolio colors

The owner requested softer sector colors and reliable allocation colors for many
holdings. `chartPalette.ts` now assigns twelve distinct pastel sector backgrounds
by sector identity, with a readable slate foreground. Compact equal-size tiles,
subtle borders and thin percentage bars replace the tall saturated blocks. The
sector percentage calculation is unchanged. The design guide's sector section
has been updated to reflect the owner's newer direction.

Holding colors use a sixteen-color coordinated base with generated fallback
colors and collision resolution. Assignment is deterministic for the same set
of symbols regardless of incoming order or performance ranking. It does not
depend on the symbol's current weight. Label foregrounds are selected for at
least 4.5:1 contrast against their circle fill. Labels and values remain necessary:
hundreds of technically distinct colors are not all perceptually distinguishable.

The proportional overview is bounded to sixteen bubbles: fifteen individual
holdings and an explicitly labeled neutral aggregate for larger portfolios.
Largest circles are packed first. A native all-holdings disclosure additionally
shows every holding as an individual circle with its own color, symbol and
percentage. The full grid scrolls, keeps proportional areas, and does not invent
minimum weights. The complete legend and original donut chart remain available.

Validation (2026-11-10):

- 41 offline tests passed, including twelve distinct readable sector pairs,
  1,000 defined unique holding colors with readable label contrast, stable colors
  under reordered input, proportional geometry, and intact totals for 1,000 rows.
- Production build and whitespace checks passed. Existing hook bodies, fetching
  and event handlers in InsightsView and AllocationBubbles match the previous
  revision exactly. Only presentation calculations and styling were extended.
- Local browser exercised 100 and 1,000 synthetic holdings, full-grid disclosure,
  one defined color per holding, scrollable lists and Hebrew/English labels.
  Desktop, 768px and 320px layouts had no horizontal overflow; all twelve sector
  names fit. Application console had no warnings/errors in these checks.
- The three seeded holdings' financial digest was unchanged; sector percentages
  still read 42.5/41.8/7.2/... and the donut retained GOOG/MA/IVV at 40/40/20.
- Screenshots of the soft sector card and a synthetic 100-holding preview were
  inspected. Preview roots were removed after checking, without editing any
  production holdings.

Remaining visual migration (`TraderAi-7dj`): health-panel information hierarchy,
holding-card consistency, forms/dialog details and navigation/sidebar styling.
Owner-authenticated production and physical iPhone checks remain `TraderAi-cz1`.
