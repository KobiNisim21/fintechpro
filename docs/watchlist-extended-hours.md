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
