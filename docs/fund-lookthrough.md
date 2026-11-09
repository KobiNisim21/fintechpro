# Broad equity funds and English analysis copy

IVV is a broad equity ETF, not an unclassified company. Supported funds now use
dated underlying holdings in the same sector and issuer concentration model as
direct shares. The app labels them **Broad US equity ETF** and shows the benchmark,
number of covered equity positions, source, date and any proxy status.

## Coverage and sources

- IVV: actual published [iShares IVV holdings](https://www.ishares.com/us/products/239726/ishares-core-s-p-500-etf/latest-holdings.csv).
- ITOT: actual published [iShares ITOT holdings](https://www.ishares.com/us/products/239724/ishares-core-s-p-total-u-s-stock-market-etf/latest-holdings.csv).
- SPY and VOO: an explicit IVV holdings proxy for broad S&P 500 exposure. This is
  an estimate, not a claim that these funds have identical daily holdings.
- VTI: an explicit ITOT broad US total-market proxy. The funds do not have the
  same exact benchmark constituents; the UI identifies this approximation.

The shipped references are dated 2026-11-06: 504 positive-weight supported equity
positions for IVV, 2,423 for ITOT. Market-value ratios retain small holdings whose
displayed percentage rounds to zero. Cash/unidentified positions are not filled
with invented equities: covered equity weight is approximately 99.9404% for IVV
and 99.7852% for ITOT. Consequently, a mixed portfolio may show 99.98% sector
coverage while still having a valid score. This is not a missing IVV classification.

References refresh on demand at most daily per process, with a dated bundled
fallback and a 90-day maximum reference age. `npm run refresh:funds` validates and
refreshes both shipped snapshots for deployment. Invalid/incomplete downloads
fail before writing. This command was run successfully during validation.

Product references:
[IVV](https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf),
[SPY](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-sp-500-etf-trust-spy),
[VOO](https://investor.vanguard.com/investment-products/etfs/profile/voo),
[VTI](https://investor.vanguard.com/investment-products/etfs/profile/vti).

## Score behavior

The 40% concentration component uses the largest combined underlying issuer,
rather than penalizing a supported broad fund as one company. Direct holdings
and holdings through funds are summed. Alphabet GOOG/GOOGL classes are combined.
Two funds tracking the same exposure do not receive an artificial extra benefit
just because there are two fund tickers. The sector component uses actual covered
sector weights. The 20% beta component retains its previous data requirements.
An unknown fund receives no invented diversification credit; its sector data can
remain incomplete. Generic Yahoo fund metadata is identified as a fund even when
underlying exposure is not available.

There is no fixed ETF bonus or guarantee that adding a broad ETF improves every
portfolio's score. A broad fund usually reduces single-issuer concentration when
replacing a concentrated position, but overlaps and sector concentration matter.
The existing score is still a disclosed heuristic, not a suitability assessment
or a guarantee of low risk. Cash balances are excluded, while small unresolved
weights within a fund are retained as unknown. Country and currency views describe
the listed instruments/fund domicile, not underlying economic exposure.

## Language

The new risk/status/explanation text is now English and left-to-right, matching
the site's main language. Existing security names remain data, regardless of
their language. Full site-wide English/Hebrew switching, complete translation and
RTL are a separate requested future feature, tracked as TraderAi-1in. No partial
language-toggle placeholder was added.

## Validation

- 27 regression tests passed, including full IVV coverage/score, mixed direct/fund
  overlap, duplicate S&P 500 funds, explicit proxy status, unknown/focused funds,
  expiry and malformed downloads.
- 22 existing database integration tests passed; TypeScript and production build
  passed.
- Live smoke checks passed for 16 public stocks/funds, including IVV/ITOT actual
  references and SPY/VOO/VTI explicitly marked proxies. No owner portfolio data
  was used.
- Disposable browser QA used a synthetic GOOG/MA/IVV portfolio: score 71/100,
  sector coverage 99.98%, IVV recognized as a broad ETF, underlying/direct overlap
  displayed. This is a test result, not the owner's account score.
- 320px, 390px and 1440px layouts had no horizontal document overflow. English
  copy/LTR and source details were verified. Console: zero errors/warnings.
