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
