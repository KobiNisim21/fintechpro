# Live price alert identity

The live sidebar is a current notification feed, not a price observation history.
Previously its duplicate key included the full message. After the two-hour
cooldown, a different percentage (for example IVV +2.3%, +2.6%, +2.4%) produced
another card for the same movement. Both server and client accepted these cards.

`shared/liveAlerts.js` now keeps the latest timestamp for each normalized ticker's
price movement, combining gain and loss into one identity. Other categories keep
separate identities by ticker, type and message, preserving distinct headlines,
earnings and annual-low events. The server deduplicates before its five-event cap;
the client also handles duplicate initial and update payloads from older servers.
The existing two-hour notification cooldown and personal alert rules are unchanged.

Validation on 2026-11-10:

- 34 offline tests, 23 disposable Mongo integration tests, production build and
  whitespace checks passed.
- Backend regression: three eligible IVV updates become one price event; a later
  loss replaces the gain; another user's feed remains empty; cooldown still
  suppresses an immediate repeat; four distinct headlines survive a price update
  at the five-event cap.
- Local browser with actual sockets: replayed all three legacy IVV cards and a
  separate headline, then sent a loss update. Only one price card and the headline
  remained, including after refresh and reconnect, in Hebrew/mobile (390px) and
  English/desktop (1440px). No horizontal overflow or console warnings/errors;
  inspected API/socket requests succeeded. Financial digest and all three fixture
  holdings remained unchanged. Only synthetic data was used.

Reproduce the browser scenario with
`npm run qa:server -- --seed-fund --localization --seed-live-alerts`, then visit
`http://127.0.0.1:4175/__qa/login/one`. The optional QA socket event
`__qa-next-live-alert` sends the synthetic loss update. This helper is only in
the disposable QA script, never in the production server.
