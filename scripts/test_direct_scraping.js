// Test DIRECT scraping of Israeli fund data from various free sources
// These are tested WITHOUT proxy — must work from a serverless function directly

async function testDirectScraping() {
    console.log('=== Testing DIRECT Scraping (No Proxy) ===\n');

    // 1. Bizportal Internal API (XHR behind the SPA)
    try {
        const r = await fetch('https://www.bizportal.co.il/forex/quote/ajaxrequests/paperdatagraphs?PaperId=5131425&Res=D', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://www.bizportal.co.il/mutualfunds/quote/generalview/5131425'
            }
        });
        console.log('1a. Bizportal AJAX paperdatagraphs:', r.status);
        if (r.ok) { const t = await r.text(); console.log('   Response:', t.substring(0, 300)); }
    } catch (e) { console.error('1a. Error:', e.message); }

    // 1b. Bizportal fund API
    try {
        const r = await fetch('https://www.bizportal.co.il/mutualfunds/quote/ajaxrequests/papergeneralinfo?PaperId=5131425', {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://www.bizportal.co.il/mutualfunds/quote/generalview/5131425'
            }
        });
        console.log('1b. Bizportal papergeneralinfo:', r.status);
        if (r.ok) { const t = await r.text(); console.log('   Response:', t.substring(0, 500)); }
    } catch (e) { console.error('1b. Error:', e.message); }

    // 2. Gemel-net.mof.gov.il (Ministry of Finance - mutual funds)
    try {
        const r = await fetch('https://gefrnetworksite.mof.gov.il/api/productDetails/fundDetails?fundNumber=5131425', {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('2. MOF gemel-net:', r.status);
        if (r.ok) { const t = await r.text(); console.log('   Response:', t.substring(0, 300)); }
    } catch (e) { console.error('2. Error:', e.message); }

    // 3. Try the Tachlit API (Israeli mutual fund direct data)
    try {
        const r = await fetch('https://www.tachlit.com/api/MutualFund/GetFundData/5131425', {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('3. Tachlit API:', r.status);
        if (r.ok) { const t = await r.text(); console.log('   Response:', t.substring(0, 300)); }
    } catch (e) { console.error('3. Error:', e.message); }

    // 4. Try the NANA finance endpoint
    try {
        const r = await fetch('https://finance.nana10.co.il/json/mutualfund.aspx?fundid=5131425', {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('4. Nana10 Finance:', r.status);
        if (r.ok) { const t = await r.text(); console.log('   Response:', t.substring(0, 300)); }
    } catch (e) { console.error('4. Error:', e.message); }

    // 5. Try a different Bizportal endpoint
    try {
        const r = await fetch('https://www.bizportal.co.il/mutualfunds/quote/ajaxrequests/paperstockgraph?PaperId=5131425&NumOfDays=1', {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': '*/*',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://www.bizportal.co.il/'
            }
        });
        console.log('5. Bizportal paperstockgraph:', r.status);
        if (r.ok) { const t = await r.text(); console.log('   Response:', t.substring(0, 300)); }
    } catch (e) { console.error('5. Error:', e.message); }

    // 6. Try the TASE maya internal API (Angular XHR endpoint)
    try {
        const r = await fetch('https://maya.tase.co.il/api/fund/details?FundId=5131425&lang=0', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                'X-Maya-With': 'allow',
                'Referer': 'https://maya.tase.co.il/fund/5131425'
            }
        });
        console.log('6. Maya internal API:', r.status);
        if (r.ok) { const t = await r.text(); console.log('   Response:', t.substring(0, 500)); }
    } catch (e) { console.error('6. Error:', e.message); }

    // 7. Try the ISA (Israel Securities Authority) daily data
    try {
        const r = await fetch('https://www.isa.gov.il/api/NavFund?FundId=5131425', {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('7. ISA NavFund:', r.status);
        if (r.ok) { const t = await r.text(); console.log('   Response:', t.substring(0, 300)); }
    } catch (e) { console.error('7. ISA Error:', e.message); }
}

testDirectScraping().catch(console.error);
