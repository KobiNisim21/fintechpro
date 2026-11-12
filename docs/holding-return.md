# Per-holding unrealized return (2026-11-12)

Each holding now shows an explicitly labeled unrealized total dollar gain/loss
and return percentage, separate from its labeled daily per-share price change.
The details also expose average purchase price and remaining purchase cost.

- Cost basis = remaining quantity × average purchase price.
- Unrealized amount = remaining quantity × displayed regular-session price − cost basis.
- Return percent = unrealized amount / cost basis × 100.

The calculation uses the existing position's weighted average and remaining
quantity; no lots, holdings, sale records or provider values are changed. These
are unrealized price returns, excluding dividends, fees, taxes and realized sale
profits. When an extended-hours quote is also visible, a note identifies the
regular-session price as the calculation basis, consistent with the card value.

Invalid/missing prices and purchase-cost estimates do not fabricate a zero
return. A valid zero purchase cost permits a dollar gain but has no defined
percentage, shown as a dash. Stale/cached received prices retain their existing
freshness indication. Zero dollar return displays with neutral color.

Validation: production build/typecheck and 52 offline tests passed. New tests
cover gains, losses, break-even, fractional remaining quantities, zero cost,
invalid/estimated quotes and stale received values. Disposable browser fixtures
showed +$200/+50%, -$80/-20% and $0/0%; all had a negative daily movement to verify
that daily and purchase-based returns remain independent. English/Hebrew,
light/dark and 320/390/1440px layouts were checked without block overflow.
No production portfolio was modified and physical iPhone rendering was not
directly inspected.
