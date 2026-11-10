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

## Stage 5: health hierarchy, holdings, forms and navigation

The remaining agreed visual pass was applied sequentially: PortfolioRiskPanel,
StockCard/StockGrid, then shared dialogs, AddPositionDialog and navigation.
Health keeps all information visible, with a grouped title/refresh header,
prominent score, separate coverage cells, a quiet fund section and consistent
native disclosure rows. The wide first row now uses two balanced columns.

Holding cards use the shared white surface, 12px corners, consistent padding,
24px tabular prices, soft change pills, 64px sparklines and separated position
values. Grids fit available content width with a 280px minimum where possible.
Edit/delete controls retain 44px targets and their original handlers.

Dialogs retain the visualViewport implementation, portal stacking, safe areas,
focus restoration and independently scrolling body. They now share 16px outer
corners, a soft modal shadow, regular-weight readable fields and uniform actions.
Lot editors retain their date/quantity/price fields and mobile stacking. The
symbol-search popover is bounded to the viewport. Navigation uses an opaque white
sidebar, quieter alert/news cards, uniform footer controls and a soft active tab.
Mobile More, language, MCP and logout callbacks are unchanged.

Validation (2026-11-10):

- The entire non-visual TypeScript AST of all 12 edited components matches HEAD
  after excluding only class/style attributes and static div layout wrappers.
  This includes imports, types, hook bodies, API calls, handlers, props, conditionals
  and translated text. No business calculation or server code was changed.
- 41 offline tests, 23 disposable Mongo integration tests, typecheck, production
  build and whitespace checks passed (64 tests total).
- Browser on synthetic data: pre-write health score remained 71/100, sector
  coverage 99.98%, beta coverage 100%, weighted beta 1.00. Draft GOOG quantity
  7.5 survived switching Hebrew to English; closing the expanded lot editor
  restored focus and left the financial digest unchanged.
- Actual browser writes in the disposable fixture: added AAPL quantity 2 at
  cost 100, refreshed and verified 2 shares/value 300; edited to 3 shares,
  refreshed and verified value 450. The activity view retained both the buy
  and correction entries. These writes never used a production portfolio.
- Tested all four views, More, language switching, personal-alert screen,
  activity/Record activity and opening/closing the MCP dialog from More.
  No MCP key was created and logout was not invoked.
- At 320x500, edit/Add/Record activity/MCP bodies had no horizontal overflow;
  long content scrolled and close controls remained visible. Record activity
  also passed at 200% root text size. Drawer footer controls stayed in view.
  At 768 and 1440px, the sidebar measured 280px with no root/content overflow.
  The tested application console reported zero warnings/errors.

This closes the agreed component pass in `TraderAi-7dj`. The separate final
owner-authenticated production and physical iPhone validation remains open in
`TraderAi-cz1`; browser viewport checks do not constitute a physical Safari test.

## Mobile regression: populated news pagination and MCP tabs

Owner screenshots revealed two conflicts that empty-news checks did not expose:
the global 44px minimum touch size was applied directly to 10px pagination dots,
and shared dialog button wrapping compressed five MCP labels into character-wide
columns. The trigger label was also truncated beside its status badge.

Pagination now uses native 44px buttons around separate 10px indicators (28px
for the active indicator). The existing click callback, page slicing and automatic
rotation are unchanged. Native buttons additionally activate with Enter/Space.
The compact count sits beneath the indicators, hover fill is mouse-only, and the
focus outline remains available for keyboard navigation.

MCP navigation uses two readable columns on phones and five columns on larger
screens, with word wrapping instead of character breaking. The final phone tab
spans the row. The sidebar trigger keeps its complete label and puts the status
badge on a second line. Existing tab handlers, key actions, hooks and API calls
were retained; no key was created during QA.

Reproduction fixture: run `npm run qa:server -- --seed-fund --localization
--seed-market-news` and open the fixture login route. The added flag supplies
twenty synthetic news items over five pages through the real local socket.

Validation (2026-11-10): 41 offline tests, typecheck and production build passed;
original hooks and all event callback bodies in both edited components match
HEAD. Browser verified all five populated news pages, page-five headlines 17–20,
keyboard activation of page two, and normal automatic advancement. Each visible
button measured 44x44px with 10px-high indicators. All five MCP tabs opened, with
no body/label overflow at 320x568, 390x844 and desktop width. Hebrew/RTL and
English/LTR labels, visible close controls, the complete trigger label and footer
fit were checked. The synthetic financial digest was unchanged.

The reduced-motion run intentionally produced Framer Motion's development notice;
after restoring normal media preferences and reloading, application console
reported zero errors and warnings. Screenshots were inspected for the compact
indicators and readable mobile MCP tabs. Physical iPhone verification remains
tracked separately in `TraderAi-cz1`.

## Native date control containment (2026-11-10)

The add-position date input now sits inside a shrinkable, 48px-high wrapper.
Explicit physical/logical dimensions and zero vertical input padding contain
native date sizing within the same bounds as the other form controls. WebKit
date text is vertically aligned; the wrapper retains a visible focus outline.
The native date type, required validation, state, handlers and submit path are
unchanged (verified by comparing the component AST excluding visual markup).

Validation: 41 offline tests, typecheck and production build passed. In Chromium,
Hebrew/RTL at 320, 390, 768 and 1440px and English/LTR at 320px measured the date
and broker controls at identical horizontal bounds and 48px height, without
horizontal page overflow. The close control remained visible on the short phone
viewport. Required validation rejected an empty date. A synthetic AAPL holding
with date 2024-02-29 was saved through the UI and retained its exact date after
reload. A mobile screenshot was inspected. These checks used disposable QA data;
physical iPhone/Safari rendering and the native picker remain a device follow-up
under `TraderAi-cz1`.
