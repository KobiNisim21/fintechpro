// Test multiple Israeli fund data sources
// Fund ID: 5131425 (Meitav Dash Kal - money market fund)

async function testSources() {
    console.log('=== Testing Israeli Fund NAV Sources ===\n');

    // 1. Try Funder.co.il
    try {
        const r = await fetch('https://www.funder.co.il/fund/5131425', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' }
        });
        console.log('1. Funder.co.il status:', r.status);
        const t = await r.text();
        // Look for any number patterns in the page
        const priceMatches = t.match(/\d{1,3}(?:,\d{3})*\.\d{2,4}/g);
        console.log('   Price-like numbers found:', priceMatches ? priceMatches.slice(0, 5) : 'none');
        console.log('   Response length:', t.length);
    } catch (e) { console.error('1. Funder error:', e.message); }

    // 2. Try Bizportal with follow redirects
    try {
        const r = await fetch('https://www.bizportal.co.il/mutualfunds/quote/generalview/5131425', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
            redirect: 'follow'
        });
        console.log('2. Bizportal status:', r.status, 'url:', r.url);
        const t = await r.text();
        const priceMatches = t.match(/\d{1,3}(?:,\d{3})*\.\d{2,4}/g);
        console.log('   Price-like numbers found:', priceMatches ? priceMatches.slice(0, 5) : 'none');
        console.log('   Response length:', t.length);
    } catch (e) { console.error('2. Bizportal error:', e.message); }

    // 3. Try the Bank of Israel (BOI) exchange rates API (known to work)
    try {
        const r = await fetch('https://www.boi.org.il/PublicApi/GetExchangeRates?asOf=2026-03-09', {
            headers: { 'Accept': 'application/json' }
        });
        console.log('3. BOI Exchange Rates status:', r.status);
        const t = await r.text();
        console.log('   Response (200 chars):', t.substring(0, 200));
    } catch (e) { console.error('3. BOI error:', e.message); }

    // 4. Try scraping from calcalist
    try {
        const r = await fetch('https://www.calcalist.co.il/mf/?FundId=5131425', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }
        });
        console.log('4. Calcalist status:', r.status);
        const t = await r.text();
        const priceMatches = t.match(/\d{1,3}(?:,\d{3})*\.\d{2,4}/g);
        console.log('   Price-like numbers found:', priceMatches ? priceMatches.slice(0, 5) : 'none');
        console.log('   Response length:', t.length);
    } catch (e) { console.error('4. Calcalist error:', e.message); }

    // 5. Try a known public JSON endpoint from TASE for fund data
    try {
        const r = await fetch('https://openapi.tase.co.il/api/fund/GetFund?FundId=5131425', {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('5. TASE OpenAPI GetFund status:', r.status);
    } catch (e) { console.error('5. TASE OpenAPI error:', e.message); }

    // 6. Haneshek.co.il (comprehensive Israeli financial data)
    try {
        const r = await fetch('https://www.haneshek.co.il/funds/5131425', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }
        });
        console.log('6. Haneshek status:', r.status);
        const t = await r.text();
        console.log('   Response length:', t.length);
    } catch (e) { console.error('6. Haneshek error:', e.message); }
}

testSources().catch(console.error);
