# Portfolio activity, personal alerts and transparent analysis

## Using the features

The toolbar below Portfolio Overview opens **Activity**, **Personal alerts**,
and **Export Excel** on desktop and mobile.

- Activity shows purchases, sales, corrections, removals, restorations, dividend
  receipts and fees. Record a sale with actual normalized USD execution price,
  quantity and sale fee. FIFO consumes the oldest recorded purchase lots first.
  A full sale archives the holding; removing a holding is a separate tracking
  action and is never assigned fabricated proceeds.
- Record dividend receipts as net USD amounts actually received, and standalone
  fees as payments. These records do not automatically update CashBalance.
- Personal rules support USD price above/below, absolute daily percentage moves,
  and combined ticker weight across brokers. Price rules pause after triggering;
  percentage rules have a persisted 24-hour cooldown. Rearm resets that cooldown.
  The toolbar shows the number of rules with a recorded trigger. Rules and their
  most recent trigger persist across server restarts. This is in-app delivery;
  email, push notifications and Telegram delivery are not implemented.
- Export downloads a real `.xlsx` workbook with Read me, Holdings, Lots, Activity
  and Cash sheets. It includes archived holdings and correction snapshots,
  explicit numeric cells, and strings that cannot become spreadsheet formulas.
  It is a data archive, not an automatic restore feature. Quotes, API keys,
  alert settings and external provider data are not included.

## Activity integrity and history boundaries

Activity is appended in the same MongoDB document write as the holding mutation,
with optimistic concurrency. A stale simultaneous sale cannot overwrite a
successful sale or duplicate its successful ledger entry. The activity form also
reuses a request identifier on retry, preventing duplicate financial entries when
an already-committed request is retried. Normal trade snapshots
are compact; corrections preserve before/after lot snapshots. No history is
silently truncated. MongoDB document-size limits still apply to very large
single-holding ledgers; a collection-based transactional ledger is appropriate
before scaling to institutional transaction volumes.

Existing holdings are not migrated with a bulk production write. Until their
first change, remaining lots appear as reconstructed Opening entries. The first
write preserves these entries once. Earlier sales, deleted records, fees and
dividends cannot be reconstructed from remaining lots; the UI and export state
this explicitly. No historical market price is substituted for an unknown
execution price. Existing MCP changes and undo operations append ledger events.

Realized results are FIFO cost basis less the recorded sale fee. Other fees,
taxes, currency conversion at trade time, corporate actions and historical
corrections are not a tax accounting engine. Costs follow the application's
existing normalized USD convention; this does not establish local tax basis.
Backdated sales before recorded purchases/prior holding changes are rejected
instead of retrospectively changing FIFO allocations.

## Portfolio Health v2

The previous score used purchase-cost weights, invented missing beta/analyst
values, rejected legitimate zero diversification scores and shared cached
results across identical symbol lists. The revised calculation:

- uses current USD market values and aggregates the same ticker across brokers;
- has 40% holding concentration, 40% known-sector concentration and 20% absolute
  beta sensitivity; analyst sentiment is not part of the score;
- requires at least 80% sector and beta coverage and quotes for every holding;
  otherwise the score is unavailable, rather than an invented neutral value;
- preserves zero and negative beta and displays data coverage;
- identifies itself as a heuristic, never a Low Risk guarantee;
- excludes cash and does not look through fund holdings. Country and currency
  views describe the issuer/listing metadata, not underlying economic exposure;
- keys backend cache by holding IDs, quantities, costs, lots and update times;
  frontend cache includes lot history and is scoped to the signed-in user;
- aligns return intervals by dates for correlations instead of array offsets.

Thresholds are product heuristics: concentration scores decline above 10% for
the largest ticker and 30% for the largest known sector. They are not a validated
investment-risk model. Beta is market sensitivity, not total volatility.

Hebrew explanations are deterministic calculations from the displayed holdings,
including concentration, daily price contribution and stale/estimated quote
coverage. They do not call a language model or transmit portfolio data.

## Dividend accuracy

Ex-date and payment date are displayed separately. Annual dividend rates are no
longer divided by four, since payment frequency is not universal. A per-payment
amount is shown only when the provider's last dividend value matches its ex-date;
otherwise it is unknown. Future amounts are not extrapolated as confirmed.
Remaining purchase lots before the ex-date inform indicative eligibility; after
sales/corrections, past entitlement is unknown. Forecasts cover current holdings
only, not closed holdings that might still have a receivable. Actual receipts can
be recorded against archived holdings in Activity. Payment dates are issuer dates,
not guaranteed broker-credit dates. The existing benchmark is labeled as an
estimate from remaining lots, excluding closed holdings/cash/payments.

References: [SEC ex-dividend dates](https://www.investor.gov/introduction-investing/investing-basics/glossary/ex-dividend-dates-when-are-you-entitled-stock-and),
[NSE beta definition](https://www.nseindia.com/static/products-services/indices-beta).

## API and operations

All new endpoints require normal JWT authentication and scope reads/writes to
the authenticated user's records:

- `GET /api/activity?offset=0&limit=50&type=SELL&symbol=AAPL`
- `POST /api/activity/:positionId` with `type: SELL | DIVIDEND | FEE`
- `GET /api/activity/export`
- `GET /api/alerts`, `POST /api/alerts`, `PUT /api/alerts/:id`, `DELETE /api/alerts/:id`
- `POST /api/alerts/check`

Automatic personal-rule checks run every minute in the persistent backend,
guarded against overlapping poll cycles. A sleeping/unavailable backend delays
checks. Missing or explicitly stale quotes do not trigger rules; concentration
rules require usable quotes for all active holdings. Vercel requests alone do
not provide a persistent background scheduler. User-triggered checks are also
available in the UI. Rules are not added to the scope of existing MCP keys.

Run `npm test`, `npm run test:integration`, and `npm run build`.
For local browser QA, `npm run qa:server -- --seed` starts a disposable database
with a synthetic AAPL holding. No production records or environment are used.

## Next phase: optional portfolio chat

Tracked as TraderAi-spw. The user requested conversational Hebrew questions and
explanations after this release. Use a server-side configurable Gemini provider,
read-only portfolio snapshots, and no position/trading write tools. Keep API keys
outside browser bundles; do not request credentials in Telegram. Show explicit
opt-in for transmitting a minimized snapshot without names, email or account
identifiers. Rate-limit by authenticated user and handle quota failures and
timeouts. Calculations should come from code; distinguish them from model opinion.

Google's [pricing documentation](https://ai.google.dev/gemini-api/docs/pricing)
lists free tiers for selected models, with model-specific limits and data-usage
terms. Availability, current model IDs, quotas and privacy terms must be checked
again at activation. Do not promise unlimited free operation. This release does
not configure Gemini or send external AI requests.

## Validation — 2026-11-09

17 offline tests and 22 integration tests passed, including actual MongoDB
persistence, ownership, simultaneous sales, idempotent retries, legacy backfill,
MCP sale/undo, alert cooldowns and Excel structure. TypeScript and production
build passed; npm audit reported zero vulnerabilities.

Browser checks used only the disposable loopback server. Verified purchase,
mobile sale (1 share at USD 180, fee 2, basis 100 -> realized USD 78), dividend
receipt/save/reload, one-time personal alert and duplicate-trigger prevention,
actual Excel download, health breakdown, dividend dates and Hebrew explanations.
1440, 390 and 320 CSS-pixel viewports had no document horizontal overflow.
Final browser console: zero errors/warnings. Initial empty profile-fixture
responses produced three retry warnings; the fixture was updated to provide
deterministic profile data and the final check was clean.

The downloaded workbook's nine XML parts parsed successfully. A warm local
development navigation measured TTFB 9.9 ms, load 63.2 ms, FCP 100 ms; these are
fixture/dev measurements, not production performance or real-provider latency.
Screenshots and the synthetic workbook are in the configured browser-output
directory, including `element-2026-11-09T13-15-07-258Z.png` (health) and
`page-2026-11-09T13-08-49-584Z.png` (mobile sale).
