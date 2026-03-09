// Test alternative data sources for Israeli fund 5131425
async function test() {
    console.log('=== Testing Alternative Sources ===\n');

    // 1. Funder.co.il - scrape price from HTML
    try {
        const r = await fetch('https://funder.co.il/fund/5131425', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = await r.text();
        console.log('1. Funder.co.il:', r.status, 'HTML length:', html.length);

        // Look for numeric values near price-related terms
        const priceMatch = html.match(/(\d{2,6}[.,]\d{1,4})/g);
        if (priceMatch) console.log('   Numbers found:', priceMatch.slice(0, 10));

        // Check if page has meaningful content
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        console.log('   Title:', titleMatch ? titleMatch[1] : 'none');
    } catch (e) { console.error('1. Error:', e.message); }

    // 2. BOI mutual fund API
    try {
        const r = await fetch('https://api.boi.org.il/api/mutualfunds/prices?fundid=5131425', {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('\n2. BOI mutual funds:', r.status);
        if (r.status < 500) {
            const t = await r.text();
            console.log('   Response:', t.substring(0, 300));
        }
    } catch (e) { console.error('2. Error:', e.message); }

    // 3. Yahoo Finance with .TA suffix
    try {
        const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/5131425.TA?interval=1d&range=5d', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('\n3. Yahoo .TA:', r.status);
        if (r.ok) {
            const data = await r.json();
            const meta = data?.chart?.result?.[0]?.meta;
            console.log('   Price:', meta?.regularMarketPrice);
        }
    } catch (e) { console.error('3. Error:', e.message); }

    // 4. Try a simple scraping of the TASE public site (non-API, just HTML)
    try {
        const r = await fetch('https://www.tase.co.il/en/market_data/fund/5131425/major_data', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('\n4. TASE public page:', r.status);
        const html = await r.text();
        const isIncapsula = html.includes('incapsula') || html.includes('_Incapsula_');
        console.log('   Incapsula:', isIncapsula);
    } catch (e) { console.error('4. Error:', e.message); }

    // 5. Try Investing.com
    try {
        const r = await fetch('https://api.investing.com/api/financialdata/5131425/historical/chart/?period=P1W&interval=P1D&pointscount=5', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'application/json',
                'Origin': 'https://www.investing.com'
            }
        });
        console.log('\n5. Investing.com API:', r.status);
        if (r.ok) {
            const t = await r.text();
            console.log('   Response:', t.substring(0, 300));
        }
    } catch (e) { console.error('5. Error:', e.message); }
}

test().catch(console.error);
