# Resilient equity classification

## Sources and precedence

Both the health calculation and sector distribution now use the same normalized
`sector` field, rather than treating a provider's raw industry as a broad sector.

1. **iShares ITOT equity holdings**: the issuer's published broad-sector data for
   US-listed equities. The shipped snapshot has 2,413 unambiguous, supported
   symbols, dated **2026-11-06**. Cash, futures, non-USD listings, invalid symbols
   and ambiguous duplicate tickers are excluded. For example, GOOG/GOOGL/META are
   Communication Services, AMZN/TSLA Consumer Discretionary, and AAPL/MSFT/NVDA
   Technology. This is company-sector classification, not a claim about fund
   underlying exposure or investment suitability.
2. **Yahoo Finance company profiles**: assetProfile/price/quoteType for equities
   absent from the issuer reference, including international listings. Country,
   currency and company name supplement missing Finnhub metadata.
3. **Finnhub industry mapping**: explicit recognized industry aliases map to
   the same eleven broad sectors. Unknown/Other and unrecognized labels do not
   count as classified. This mapping is a product normalization, not a licensed
   official GICS classification assertion.

Sources: [iShares ITOT](https://www.ishares.com/us/products/239724/ishares-core-s-p-total-u-s-stock-market-etf),
[issuer holdings CSV](https://www.ishares.com/us/products/239724/ishares-core-s-p-total-u-s-stock-market-etf/latest-holdings.csv),
[Yahoo Finance library](https://github.com/gadicc/yahoo-finance2),
[Finnhub profile documentation](https://finnhub.io/docs/api/company-profile2).

The reference takes priority for covered equities to keep a consistent taxonomy
when a vendor describes a media/internet company broadly as Technology.
BRK B / BRK.B / BRK-B share-class spelling is normalized explicitly. Listing
suffixes such as `.TA` or `.L` are preserved; no foreign listing is matched to a
US ticker just because the issuer name looks similar.

## Reliability and boundaries

- The issuer CSV has a best-effort refresh at most once a day per running server
  process. Concurrent portfolios share a refresh; download failures retry after
  five minutes. A dated shipped snapshot avoids a cold-start dependency on that
  download. References older than 90 days are not used. Refreshes in serverless
  requests can be frozen after a response; the shipped snapshot and explicit
  maintenance command remain the fallback.
- Run `npm run refresh:classifications` to refresh the bundled reference for the
  next deployment. A malformed, stale, incomplete or HTML response fails before
  writing the snapshot. No prices, weights or portfolio holdings are copied into
  this reference: only public ticker/name/sector/location/currency/exchange data.
- Provider calls have bounded deadlines; Yahoo and Finnhub lookups run in
  parallel when Yahoo is needed. There is no dependency on a new API key.
- Resolved profiles cache for 24 hours, unavailable results for two minutes.
  Concurrent symbol requests share work. Prior good live classifications can
  remain available for up to 30 days on provider failure, explicitly marked stale.
- Industry/sector aliases collapse equivalent names; they do not infer sectors
  from arbitrary company names. ETFs, mutual funds, indices and Israeli fund
  identifiers are not assigned a single company sector. Fund look-through is
  separate work. No source can guarantee classification of every security.
- Provider metadata includes sector, source, URL, as-of/retrieval time and status.
  The UI lists classified and missing tickers, sources and dates. Reference dates
  are holdings-as-of dates; Yahoo/Finnhub dates are retrieval dates, not a promise
  about when the company changed its classification.
- Partial results say why a score is unavailable and require no investment action
  from the user. A refresh button is available. Partial classification analytics
  expire after two minutes; complete analytics retain their existing cache TTL.
  Frontend profile/analytics caches and backend analytics keys are versioned so
  old unclassified results are not retained after this deployment.

## Validation (2026-11-09)

`npm test`: 23 passed. `npm run test:integration`: 22 passed.
`npm run build`: TypeScript and production build passed.

Tests cover provider denial/empty responses, total outage with the issuer
reference, international Yahoo fallback, explicit industry mapping, unknown
securities/funds, class-share aliases, deduplication, negative-cache recovery,
reference expiry, stale data, CSV escaping/HTML rejection and duplicate symbols.
An offline sample portfolio of fourteen familiar tickers reached 100% sector
coverage without working live providers.

`node scripts/smoke-classification.js` passed live lookups for eleven predefined
public symbols (not the owner's portfolio). Ten used the issuer reference; NVO
used Yahoo company profile. Only ticker/sector/provenance were logged, no keys.

Disposable browser QA at 390px and 320px verified the Hebrew explanation for 75%
coverage, the explicit missing symbol QAUNKNOWN, source/date details, Refresh
analysis, and transition to 100% coverage with a real score after removing only
the synthetic unknown holding. Console had zero errors/warnings and no horizontal
document overflow. No production holdings were read or modified.
