// Deep analysis of Funder.co.il HTML for fund 5131425
// Goal: find the NAV price pattern we can reliably extract

async function analyze() {
    const r = await fetch('https://funder.co.il/fund/5131425', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await r.text();

    console.log('Page length:', html.length);
    console.log('');

    // 1. Look for structured data
    const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
        console.log('JSON-LD blocks found:', jsonLdMatches.length);
        jsonLdMatches.forEach((m, i) => console.log(`  Block ${i}:`, m.substring(0, 200)));
    }

    // 2. Find all data attributes with numeric values
    const dataAttrs = html.match(/data-[\w-]+="[\d.]+"/g);
    if (dataAttrs) {
        console.log('\nData attributes with numbers:', dataAttrs.slice(0, 20));
    }

    // 3. Find context around key numbers - look for 112 (the ~11200 agorot NAV value / 100)
    // Meitav fund 5131425 NAV is approximately 112 ILS / 11200 agorot
    const contexts = [];
    const patterns = [/(.{0,60})(1[01]\d\.\d{1,4})(.{0,40})/g];
    for (const pat of patterns) {
        let m;
        while ((m = pat.exec(html)) !== null) {
            contexts.push({ before: m[1].replace(/\s+/g, ' ').trim(), value: m[2], after: m[3].replace(/\s+/g, ' ').trim() });
        }
    }
    console.log('\nNumbers ~100-119 (potential NAV in ILS):', contexts.length);
    contexts.forEach(c => console.log(`  ${c.before} [${c.value}] ${c.after}`));

    // 4. Search for key Hebrew terms and their surrounding numbers
    const hebrewTerms = ['שע"י', 'שער', 'נכסי', 'NAV', 'nav', 'מחיר', 'ערך'];
    for (const term of hebrewTerms) {
        const idx = html.indexOf(term);
        if (idx > -1) {
            const context = html.substring(Math.max(0, idx - 50), idx + 100).replace(/\s+/g, ' ');
            console.log(`\nTerm "${term}" found at ${idx}:`);
            console.log(`  Context: ${context}`);
        }
    }

    // 5. Look for Vue/React data bindings or JS variables with price data
    const jsVarMatch = html.match(/(?:nav|price|value|fund_data|chart_data)\s*[=:]\s*[{\["][\s\S]{0,200}/gi);
    if (jsVarMatch) {
        console.log('\nJS variable patterns:', jsVarMatch.slice(0, 5));
    }

    // 6. Look for any API URLs embedded in the page
    const apiUrls = html.match(/https?:\/\/[^\s"'<>]+api[^\s"'<>]*/gi);
    if (apiUrls) {
        console.log('\nAPI URLs in page:', [...new Set(apiUrls)].slice(0, 10));
    }
}

analyze().catch(console.error);
