# English and Hebrew interface

The language button is available on sign-in, in the desktop sidebar, in the
mobile header/menu, and in dialog headers. English remains the initial default.
The choice is stored under `fintechpro.language.v1`, survives refresh/sign-out,
and synchronizes between same-origin tabs. Storage failures do not prevent a
session language change. No portfolio data is sent to a translation service.

`src/i18n/messages.json` holds reviewed English/Hebrew messages. Use `t(message,
values)` for interface copy and `useLanguage()` in rendered components, including
memoized ones. Changing language updates the existing component tree, not its
keys, so draft fields and view selections remain intact. Store message data,
not already-translated strings, in state. Format dates at render time with
`locale()`; retain ISO dates in chart data. Google sign-in is the exception:
its isolated provider/widget remounts with its supported locale property.

The document's `lang`, `dir`, and title follow the selection. Layout uses logical
spacing/alignment; the desktop sidebar and mobile menu change sides. Charts,
dates, and numeric fields retain mathematical LTR direction. Interpolated
identifiers/numbers are bidi-isolated in Hebrew. Tickers, broker/security names,
user notes, technical connection identifiers, and original news headlines are
preserved. Known sector/fund labels, calendar labels, eligibility messages and
generated price alerts are translated locally. News timestamps use the chosen
locale, and a notice explains that external headlines keep their source language.
Excel backup columns retain their established machine-readable names.

The MCP screens now use the shared accessible dialog, including focus handling,
Escape and nested modal layers. This fixes mobile menu interception of clicks
on AI-connection tabs. The mobile menu overlay forwards its Radix ref correctly.
No API keys were created during browser QA.

## Validation, 2026-11-09

- `npm test`: 31 passing tests, including interpolation/bidi isolation, matching
  bilingual parameters, known provider labels, preservation of original news,
  persistent language changes, cross-tab notification and blocked storage.
- `npm run test:integration`: 22 passing tests against disposable MongoDB.
- `npm run build`: TypeScript and production Vite build.
- Dedicated browser, disposable synthetic GOOG/MA/IVV portfolio:
  `npm run qa:server -- --seed-fund --localization`.
- Hebrew/English holdings, insights, analyst recommendation labels, dividend
  eligibility, calendar events/holidays, empty watchlist, personal alert creation
  and result messages, activity form, Add/Edit dialogs, mobile menu and MCP
  tools/access-key form. No external key creation or production data changes.
- A filled activity draft retained quantity 1.5, price 160 and its note when
  switching language inside the dialog. A personal-alert result also changed
  language without rerunning its action.
- Language persisted after navigation/reload. A measured language toggle made
  zero additional portfolio API requests.
- Viewports 320×740, 390×844, 390×340, 768×1000 and 1440×1000. The 768-pixel
  holdings layout was corrected to avoid clipped action buttons; main scroll
  width equaled its client width after the fix. Both desktop sidebar directions
  were checked. The short-height Edit dialog kept its header/close accessible.
- Final local browser console inspection reported zero errors/warnings.

These are desktop browser viewport checks, not physical iPhone keyboard tests.
Authenticated production portfolio QA requires the owner's separate browser
login; the development fixture never reads production credentials or databases.
