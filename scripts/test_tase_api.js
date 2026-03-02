import { fetchFundNAV } from '../server/services/israeliSecuritiesService.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    console.log('Testing TASE API (Mock or Real depends on env var)');
    console.log('API Key present?', !!process.env.TASE_API_KEY);

    try {
        const nav = await fetchFundNAV('5131417'); // מיטב כספית שקלית
        console.log('Result:', nav);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

test();
