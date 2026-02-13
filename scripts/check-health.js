const https = require('https');

const url = 'https://fintechpro-backend.onrender.com/api/health';

https.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        try {
            console.log('Response:', JSON.parse(data));
        } catch (e) {
            console.log('Response (raw):', data);
        }
    });

}).on('error', (err) => {
    console.error('Error:', err.message);
});
