// Deep analysis of Funder.co.il page to find NAV data
// Fund ID: 5131425 (Meitav Dash Kal)

async function analyzeFunder() {
    const r = await fetch('https://www.funder.co.il/fund/5131425', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html',
            'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7'
        }
    });
    console.log('Status:', r.status);
    const html = await r.text();

    // Look for fund-specific patterns
    // Hebrew patterns for NAV: שע"נ, שער
    // Look for structured data or specific CSS classes

    // Pattern 1: Look for JSON-LD or structured data
    const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
    if (jsonLd) console.log('Found JSON-LD:', jsonLd.length, 'blocks');

    // Pattern 2: Look for data attributes
    const dataAttrs = html.match(/data-(?:value|price|nav|rate|yield)[^"]*="([^"]+)"/gi);
    if (dataAttrs) console.log('Data attributes:', dataAttrs.slice(0, 10));

    // Pattern 3: Look for specific class names containing price/nav
    const navClasses = html.match(/class="[^"]*(?:price|nav|value|rate)[^"]*"[^>]*>([^<]+)/gi);
    if (navClasses) console.log('NAV classes:', navClasses.slice(0, 10));

    // Pattern 4: Look for the word 'שענ' or 'שער' nearby numbers
    const hebrewNav = html.match(/[\u05E9][\u05E2][\u0022\u05F4]?[\u05E0][^<]{0,50}\d[\d,.]+/g);
    if (hebrewNav) console.log('Hebrew NAV patterns:', hebrewNav);

    // Pattern 5: Search for fund name and nearby values
    const fundName = html.match(/5131425[^<]{0,200}/g);
    if (fundName) console.log('Fund ID context:', fundName.slice(0, 3));

    // Pattern 6: Look for any JavaScript objects containing fund data
    const jsData = html.match(/fundData|fundInfo|navValue|currentPrice/gi);
    if (jsData) console.log('JS data references:', jsData);

    // Pattern 7: Look for Angular/React state data
    const stateData = html.match(/window\.__[A-Z_]+__\s*=\s*(\{[\s\S]{0,200})/g);
    if (stateData) console.log('State data:', stateData.slice(0, 2));

    // Pattern 8: Look for meta tags with fund data
    const metaContent = html.match(/<meta[^>]*(?:price|nav|fund|value)[^>]*>/gi);
    if (metaContent) console.log('Meta tags:', metaContent);

    // Pattern 9: Raw search for decimal numbers in context
    // Let's find ALL numbers between 100 and 1200 (typical NAV range in agorot)
    const allBigNums = html.match(/>\s*(\d{3,4}\.\d{2,4})\s*</g);
    if (allBigNums) console.log('Big numbers in tags:', allBigNums.slice(0, 10));

    // Pattern 10: Try looking at the page title for useful info
    const title = html.match(/<title[^>]*>([^<]+)/i);
    if (title) console.log('Page title:', title[1].trim());

    // Extra: Dump a section of HTML around common fund data areas
    const idx1 = html.indexOf('5131425');
    if (idx1 > -1) {
        console.log('\n--- Context around fund ID ---');
        console.log(html.substring(Math.max(0, idx1 - 200), idx1 + 300));
    }

    // Look for any internal API calls or XHR URLs
    const apiUrls = html.match(/(?:api|ajax|json)[^"'\s]+/gi);
    if (apiUrls) {
        const unique = [...new Set(apiUrls)].slice(0, 15);
        console.log('\nAPI/AJAX URLs found:', unique);
    }
}

analyzeFunder().catch(console.error);
