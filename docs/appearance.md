# Appearance

The sun/moon button beside device push settings switches the whole application
between light and dark appearances. It is also available beside the language
selector in sidebar preferences. Controls remain 44px touch targets; on phones
narrower than 380px, the header retains the brand icon and hides the wordmark to
keep all actions accessible.

The existing next-themes dependency owns the document data-theme attribute,
native color-scheme, initial appearance script and cross-tab synchronization.
Before an explicit selection, appearance follows prefers-color-scheme changes.
Explicit choices persist in fintechpro.theme.v1. This setting is device/browser
local and independent of authentication, portfolio data and push subscriptions.
The browser/PWA theme-color metadata follows the resolved appearance.

Shared app tokens in apple-design.css now replace literal neutral light paints.
appearance.css defines dark surfaces, legible foregrounds, muted text, borders
and semantic status backgrounds. Filled action buttons use a separate accent
from accent-colored text for readable white labels. SVG axes/tooltips, allocation
outlines, sector tiles, native fields and portal dialogs adapt without altering
financial calculations, chart values, category identities or event handlers.

Validation on 2026-11-12:

- Typecheck/production build and all 50 offline tests passed.
- Disposable local browser QA covered Hebrew/English at 320px and 390px, plus
  1440px desktop; header controls fit without horizontal overflow.
- Switching, persistence after navigation/reload, simulated OS dark/light changes
  and explicit override of the OS preference were verified.
- Holdings, Insights, allocation bubbles/sector tiles, Watchlist, Calendar,
  personal alerts/activity views, add-position, push and AI settings were opened.
  Dark dialog/input paints and native color-scheme were inspected. Light mode
  restored the original canvas color.
- Sampled dark-mode risk/legend text contrast was 14.79:1, neutral actions 7.48:1,
  and white filled-button labels 5.57:1. These samples are not a full WCAG audit.
- No production portfolio or subscription data was modified. Native iPhone/PWA
  chrome appearance and physical-device rendering were not directly tested.
