import https from 'https';

function testScrape() {
    return new Promise((resolve) => {
        https.get('https://www.bizportal.co.il/mutualfunds/quote/generalview/5131417', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const match = data.match(/<span[^>]*class="[^"]*statistics-val[^"]*"[^>]*>([\d,]+\.?\d*)<\/span>/i);
                console.log('Bizportal status:', res.statusCode);
                console.log('Bizportal match:', match ? match[1].trim() : 'no match');
                resolve();
            });
        }).on('error', e => {
            console.error('Error:', e);
            resolve();
        });
    });
}

testScrape();
