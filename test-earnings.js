import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

async function getEarningsCalendar(from, to) {
    const apiKey = process.env.FINNHUB_API_KEY;
    console.log('Using API Key:', apiKey ? 'YES' : 'NO');
    const url = `${FINNHUB_BASE_URL}/calendar/earnings?from=${from}&to=${to}&token=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    return data.earningsCalendar || [];
}

async function run() {
    const today = new Date();
    const from = today.toISOString().split('T')[0];
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const to = nextWeek.toISOString().split('T')[0];

    console.log(`Checking earnings from ${from} to ${to}`);
    const earnings = await getEarningsCalendar(from, to);
    
    const ma = earnings.find(e => e.symbol === 'MA');
    console.log('MA earnings found:', ma ? 'YES' : 'NO', ma);
    
    // Check if IVV is there
    const ivv = earnings.find(e => e.symbol === 'IVV');
    console.log('IVV earnings found:', ivv ? 'YES' : 'NO', ivv);
}

run().catch(console.error);
