// Test internal APIs used by Israeli financial sites

async function testApis() {
    console.log('=== Testing Internal APIs ===\n');

    // 1. maya.tase.co.il internal API (XHR calls)
    try {
        const r = await fetch('https://maya.tase.co.il/api/fund/details?FundId=5131425', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Referer': 'https://maya.tase.co.il/fund/5131425',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        console.log('1a. maya API fund/details:', r.status);
        if (r.status === 200) {
            const t = await r.text();
            console.log('   Response:', t.substring(0, 500));
        }
    } catch (e) { console.error('1a. maya error:', e.message); }

    // 1b. Another maya endpoint
    try {
        const r = await fetch('https://maya.tase.co.il/api/fund/tradesdata?FundId=5131425', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
        });
        console.log('1b. maya API fund/tradesdata:', r.status);
        if (r.status === 200) {
            const t = await r.text();
            console.log('   Response:', t.substring(0, 500));
        }
    } catch (e) { console.error('1b. error:', e.message); }

    // 2. Try funder.co.il XHR API
    try {
        const r = await fetch('https://www.funder.co.il/api/fund/5131425', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
        });
        console.log('2. funder API:', r.status);
        if (r.status === 200) {
            const t = await r.text();
            console.log('   Response:', t.substring(0, 500));
        }
    } catch (e) { console.error('2. error:', e.message); }

    // 3. Direct approach: Fetch the TASE openapi token endpoint WITHOUT proxy
    try {
        const r = await fetch('https://openapigw.tase.co.il/tase/prod/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            body: 'grant_type=client_credentials'
        });
        console.log('3. TASE token (no auth):', r.status);
        if (r.status !== 200) {
            const t = await r.text();
            const isIncapsula = t.includes('Incapsula') || t.includes('incapsula');
            console.log('   Is Incapsula block:', isIncapsula);
            console.log('   Response type:', t.startsWith('<') ? 'HTML' : 'JSON/Other');
        }
    } catch (e) { console.error('3. error:', e.message); }

    // 4. Try the ScrapingAnt API directly (if key exists)
    const proxyKey = process.env.PROXY_API_KEY;
    if (proxyKey) {
        try {
            console.log('\n4. Testing ScrapingAnt directly...');
            const targetUrl = 'https://httpbin.org/ip';
            const url = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(targetUrl)}&x-api-key=${proxyKey}`;
            const r = await fetch(url);
            console.log('   ScrapingAnt status:', r.status);
            const t = await r.text();
            console.log('   Response:', t.substring(0, 300));
        } catch (e) { console.error('4. ScrapingAnt error:', e.message); }
    } else {
        console.log('\n4. PROXY_API_KEY not set locally (expected - it should be on Vercel)');
    }

    // 5. Try the FMP (Financial Modeling Prep) free API
    try {
        const r = await fetch('https://financialmodelingprep.com/api/v3/search?query=5131425&exchange=TASE&apikey=demo', {
            headers: { 'Accept': 'application/json' }
        });
        console.log('\n5. FMP search:', r.status);
        const t = await r.text();
        console.log('   Response:', t.substring(0, 300));
    } catch (e) { console.error('5. FMP error:', e.message); }
}

testApis().catch(console.error);
