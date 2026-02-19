
console.log('Script starting (dynamic import)...');
import dotenv from 'dotenv';
dotenv.config();

console.log('Env loaded.');

async function testRegressionV2() {
    console.log('Attempting to import stockDataService...');
    try {
        const { getPortfolioHealthAndBenchmark } = await import('../server/services/stockDataService.js');
        console.log('Import successful.');

        console.log('\n=== Regression Test V2: Absolute Earliest Date & Diversity ===');

        // Scenario:
        // 1. AAPL: Bought in 2020 (Legacy/Lot mixed?)
        // 2. MSFT: Bought recently
        // 3. KO: Bought in 2022

        // We strictly want TWR start date to be 2020-01-01.
        // We strictly want Diversity > 0.

        const positions = [
            {
                symbol: 'AAPL',
                quantity: 10, // Top level might be used if logic falls back
                averagePrice: 150,
                lots: [
                    { quantity: 10, price: 100, date: '2020-01-01' }
                ]
            },
            {
                symbol: 'MSFT',
                quantity: 5,
                averagePrice: 300,
                lots: [
                    { quantity: 5, price: 300, date: '2026-02-01' }
                ]
            },
            {
                symbol: 'KO',
                quantity: 20,
                averagePrice: 60,
                lots: [
                    { quantity: 20, price: 60, date: '2022-06-01' }
                ]
            }
        ];

        try {
            console.time('ExecutionTime');
            const result = await getPortfolioHealthAndBenchmark(positions);
            console.timeEnd('ExecutionTime');

            console.log('\n--- Health Score Inputs ---');
            // We can't see internal variables, but we can see the output components
            console.log('Diversity Score:', result.components?.diversification);
            console.log('Volatility Score:', result.components?.volatility);
            console.log('Beta:', result.portfolioBeta);

            if (result.components?.diversification === 0) {
                console.error('ג Œ FAIL: Diversity is 0.');
            } else {
                console.log('גœ… PASS: Diversity > 0');
            }

            console.log('\n--- TWR Benchmark ---');
            const bench = result.benchmarkData || [];
            console.log(`Points: ${bench.length}`);

            if (bench.length > 0) {
                const firstDate = bench[0].date;
                console.log(`First Date: ${firstDate}`);
                console.log(`Last Date:  ${bench[bench.length - 1].date}`);

                const firstYear = parseInt(firstDate.split('-')[0]);
                // We expect ~2020
                if (firstYear > 2020) {
                    console.error(`ג Œ FAIL: Graph starts in ${firstYear}, expected 2020.`);
                } else {
                    console.log('גœ… PASS: Graph starts correctly in 2020.');
                }
            } else {
                console.warn('גš  WARNING: No benchmark data returned.');
            }

        } catch (error) {
            console.error('CRITICAL ERROR in inner block:', error);
        }
    } catch (e) {
        console.error('Failed to import or run:', e);
    }
}

testRegressionV2();
