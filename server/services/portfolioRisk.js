// A transparent heuristic, not a prediction or a suitability assessment.
export function combinePositions(positions) {
    const grouped = new Map();
    for (const p of positions) {
        if (p.isDeleted || !(p.quantity > 0)) continue;
        const current = grouped.get(p.symbol) || { symbol: p.symbol, quantity: 0, averagePrice: 0, lots: [], activity: [], createdAt: p.createdAt };
        const cost = current.quantity * current.averagePrice + p.quantity * p.averagePrice;
        current.quantity += p.quantity;
        current.averagePrice = cost / current.quantity;
        current.lots.push(...(p.lots?.length ? p.lots : [{ quantity: p.quantity, price: p.averagePrice, date: p.createdAt }]));
        // Legacy lots without an activity baseline cannot prove historical entitlement.
        if (!p.lots?.length) current.activity.push({ type: 'ADJUSTMENT' });
        current.activity.push(...(p.activity || []));
        grouped.set(p.symbol, current);
    }
    return [...grouped.values()];
}

export function calculatePortfolioRisk(rows) {
    const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row.value) || 0), 0);
    const bySymbol = {}, sectors = {}, countries = {}, currencies = {};
    let sectorValue = 0, betaValue = 0, weightedBeta = 0;
    const add = (map, key, value) => { map[key || 'Unknown'] = (map[key || 'Unknown'] || 0) + value; };
    for (const row of rows) {
        const value = Math.max(0, Number(row.value) || 0);
        add(bySymbol, row.symbol, value);
        add(sectors, row.sector, value);
        add(countries, row.country, value);
        add(currencies, row.currency, value);
        if (row.sector) sectorValue += value;
        if (Number.isFinite(row.beta)) { betaValue += value; weightedBeta += row.beta * value; }
    }
    const exposure = map => Object.entries(map).map(([name, value]) => ({ name, value, percent: total ? value / total * 100 : 0 })).sort((a, b) => b.value - a.value);
    const holdings = exposure(bySymbol);
    const sectorCoverage = total ? sectorValue / total : 0;
    const betaCoverage = total ? betaValue / total : 0;
    const maxHoldingPct = holdings[0]?.percent || 0;
    const maxSectorPct = Math.max(0, ...exposure(sectors).filter(row => row.name !== 'Unknown').map(row => row.percent));
    const beta = betaValue ? weightedBeta / betaValue : null;
    const concentration = Math.max(0, 100 - Math.max(0, maxHoldingPct - 10) * 1.5);
    const diversity = sectorCoverage >= 0.8 ? Math.max(0, 100 - Math.max(0, maxSectorPct - 30) * 2) : null;
    const sensitivity = betaCoverage >= 0.8 ? Math.max(0, 100 - Math.max(0, Math.abs(beta) - 1) * 50) : null;
    const available = total > 0 && diversity !== null && sensitivity !== null;
    return {
        healthScore: available ? Math.round(concentration * 0.4 + diversity * 0.4 + sensitivity * 0.2) : null,
        available, portfolioBeta: beta, maxSectorPct, maxHoldingPct,
        components: { concentration: Math.round(concentration), diversification: diversity === null ? null : Math.round(diversity), volatility: sensitivity === null ? null : Math.round(sensitivity), sentiment: null },
        coverage: { sectors: Math.round(sectorCoverage * 100), beta: Math.round(betaCoverage * 100) },
        exposures: { holdings, sectors: exposure(sectors), countries: exposure(countries), currencies: exposure(currencies) },
        methodology: 'v2: 40% holding concentration, 40% sector concentration, 20% absolute beta sensitivity. Requires 80% sector and beta coverage. Current USD market values; excludes cash. No fund look-through or analyst sentiment. Listing currency/country are not underlying economic exposure.',
    };
}

export function alignedCorrelation(a, b) {
    const returns = chart => {
        const map = new Map();
        for (let i = 1; i < (chart?.dates?.length || 0); i++) {
            if (chart.closes[i - 1] > 0 && chart.closes[i] > 0) map.set(`${chart.dates[i - 1]}:${chart.dates[i]}`, chart.closes[i] / chart.closes[i - 1] - 1);
        }
        return map;
    };
    const am = returns(a), bm = returns(b);
    const pairs = [...am].filter(([date]) => bm.has(date)).slice(-30).map(([date, value]) => [value, bm.get(date)]);
    if (pairs.length < 5) return null;
    const mean = index => pairs.reduce((sum, pair) => sum + pair[index], 0) / pairs.length;
    const ma = mean(0), mb = mean(1);
    let numerator = 0, da = 0, db = 0;
    for (const [x, y] of pairs) { numerator += (x - ma) * (y - mb); da += (x - ma) ** 2; db += (y - mb) ** 2; }
    return da && db ? Math.round(numerator / Math.sqrt(da * db) * 100) / 100 : null;
}

export function buildDividendEstimate(symbol, positions, info, now = new Date()) {
    if (!info?.exDate || !Number.isFinite(new Date(info.exDate).getTime())) return null;
    const exDay = new Date(info.exDate).toISOString().slice(0, 10);
    let shares = 0, known = true;
    for (const pos of positions.filter(row => row.symbol === symbol)) {
        // Remaining lots cannot reconstruct past entitlement after sales/corrections.
        if (!pos.lots?.length || (exDay <= now.toISOString().slice(0, 10) && pos.activity?.some(event => ['SELL', 'ADJUSTMENT', 'REMOVE', 'RESTORE'].includes(event.type)))) known = false;
        for (const lot of pos.lots || []) if (new Date(lot.date).toISOString().slice(0, 10) < exDay) shares += Number(lot.quantity);
    }
    const amount = Number.isFinite(info.amount) && info.amount >= 0 ? info.amount : null;
    return { symbol, exDate: info.exDate, paymentDate: info.paymentDate || null, amount,
        estimatedPayout: known && amount !== null ? amount * shares : null,
        eligibleShares: known ? shares : null, currency: info.currency || 'USD',
        source: 'Yahoo Finance', status: amount === null ? 'Amount unavailable' : 'Indicative, before tax',
        eligibility: known ? (new Date(exDay) > now ? 'Projected from current lots' : 'Based on recorded purchase lots') : 'Historical entitlement unknown',
    };
}
