# Watchlist extended hours (2026-11-12)

Watchlist cards retain the existing batch extended-quote response and expose both
pre-market and after-hours prices with reported percentage changes. These values
remain separate from the regular-session price and historical performance badges.
No additional quote endpoint or polling timer was added. Only positive finite
prices are shown; missing prices have a localized unavailable label. Missing
percentage changes stay absent, while a reported zero remains visible. A note
explains that quotes may be delayed or belong to an earlier session: the current
provider response does not expose a timestamp for each extended-hours session.

The portfolio Performance History section now mounts only in the Holdings view.
Watchlist per-stock charts and the Insights benchmark remain available.

Validation: typecheck/production build and 50 offline tests passed. Disposable
local browser QA used synthetic watchlist/quote/history responses for three
symbols: both session prices, missing session data and zero percent change.
English/Hebrew, light/dark, 320/390px mobile and 1440px desktop layouts were
checked without horizontal overflow. The watchlist header also reserves space
for its delete control so the main quote does not clip. Navigation confirmed one
portfolio-growth chart in Holdings and zero in Insights, Watchlist and Calendar.
No production account was changed; live provider availability was not asserted.

## Refresh fix (2026-11-12)

The watchlist previously fetched only on mount/add/remove. Dashboard pull refresh
called fetchPositions only, so it never refreshed a mounted watchlist. Its fetch
also reset existing prices, delayed quotes until chart history completed and
silently replaced failed quotes with zero.

The watchlist now exposes an awaited refresh handle to the dashboard, has a local
Refresh button, refreshes every 60 seconds while visible and refreshes on window
focus/visibility restoration. Concurrent refreshes share one promise; unmounted
requests cannot commit results. Chart history is reused for 15 minutes to keep
minute quote refreshes inexpensive. Received quotes appear before chart history
completes. Quote source, provider timestamp and stale/cache state are visible.
Failures retain the previous quote, display a retry message and mark it stale.
Without a prior quote, the UI reports missing data instead of a zero-dollar price.
Daily percentage uses the reported regular-session percentage when available.
Missing performance values remain absent instead of being replaced by zero.

Validation: production build/typecheck and 50 offline tests passed. Disposable
browser QA used changing NVDA responses to verify manual refresh, actual simulated
pull gestures, focus recovery, a virtual-clock minute tick and visibility resume.
An intentional 503 retained the last price and exposed the stale/retry state.
Five concurrent focus events produced one watchlist request; hidden tabs and
unmounted watchlist views produced zero watchlist requests on a minute tick.
The existing server quote cache is 30 seconds; this change does not promise
tick-by-tick quotes or override exchange/provider delays. Production NVDA quote
accuracy was not independently verified.
