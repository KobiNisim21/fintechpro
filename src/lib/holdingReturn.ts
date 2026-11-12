/** Unrealized return on the remaining shares at the displayed regular price. */
export function holdingReturn(stock: { quantity: number; averagePrice: number; price: number; priceStatus?: string }) {
    const { quantity, averagePrice, price, priceStatus } = stock;
    if (priceStatus === 'estimated' || ![quantity, averagePrice, price].every(Number.isFinite)
        || quantity <= 0 || averagePrice < 0 || price <= 0) return null;
    const costBasis = quantity * averagePrice;
    const marketValue = quantity * price;
    const amount = marketValue - costBasis;
    const percent = costBasis > 0 ? amount / costBasis * 100 : null;
    if (![costBasis, marketValue, amount].every(Number.isFinite) || (percent !== null && !Number.isFinite(percent))) return null;
    return { costBasis, marketValue, amount, percent };
}
