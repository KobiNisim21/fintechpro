
import dotenv from 'dotenv';
dotenv.config();

// Dynamic import to handle ESM
const loadService = async () => {
    try {
        const { getPortfolioHealthAndBenchmark } = await import('../server/services/stockDataService.js');
        return { getPortfolioHealthAndBenchmark };
    } catch (error) {
        console.error('Failed to import service:', error);
        process.exit(1);
    }
};

const runVerification = async () => {
    console.log('--- Starting Verification ---');
    const { getPortfolioHealthAndBenchmark } = await loadService();

    // 1. Verify Graph Range Fix
    console.log('\n[Test 1] Verifying Graph Range (TWR)...');
    // Scenario: User bought stock recently (Feb 2026). Graph should still show 1 year history (from Feb 2025).
    const recentPositions = [
        {
            symbol: 'MSFT',
            quantity: 1,
            averagePrice: 400,
            parts: [], // Legacy format support
            lots: [
                { quantity: 1, price: 400, date: '2026-02-01' } // Bought Recently
            ]
        }
    ];

    try {
        const resultRec = await getPortfolioHealthAndBenchmark(recentPositions);
        const benchmarkData = resultRec.benchmarkData || [];

        if (benchmarkData.length > 0) {
            const firstPoint = benchmarkData[0];
            const firstDate = new Date(firstPoint.date);
            const now = new Date();
            const monthsDiff = (now.getFullYear() - firstDate.getFullYear()) * 12 + (now.getMonth() - firstDate.getMonth());

            console.log(`First Graph Date: ${firstPoint.date}`);
            console.log(`History Length (months): ~${monthsDiff}`);

            if (monthsDiff >= 11) {
                console.log('✅ PASS: Graph shows at least 1 year of history despite recent purchase.');
            } else {
                console.error('❌ FAIL: Graph is truncated (less than 11 months history).');
            }
        } else {
            console.warn('⚠️ WARNING: No benchmark data returned (API might be down).');
        }

    } catch (error) {
        console.error('Error in Test 1:', error);
    }

    // 2. Verify Dividend Payout Fix
    console.log('\n[Test 2] Verifying Quarterly Dividend Payout...');
    // Scenario: 6 MSFT shares. Annual rate ~3.64. Quarterly ~0.91. Payout ~5.46.
    const divPositions = [
        {
            symbol: 'MSFT',
            quantity: 6,
            averagePrice: 400,
            lots: []
        }
    ];

    try {
        const resultDiv = await getPortfolioHealthAndBenchmark(divPositions);
        const dividends = resultDiv.dividends || [];
        const msftDiv = dividends.find(d => d.symbol === 'MSFT');

        if (msftDiv) {
            console.log(`Symbol: ${msftDiv.symbol}`);
            console.log(`Amount (Quarterly): $${msftDiv.amount}`);
            console.log(`Quantity: 6`);
            console.log(`Est. Payout: $${msftDiv.estimatedPayout}`);

            // MSFT annual dividend is historically > $2.00. Quarterly should be < $1.50.
            if (msftDiv.amount < 1.50) {
                console.log('✅ PASS: Dividend Amount appears to be quarterly (< $1.50).');
            } else {
                console.error('❌ FAIL: Dividend Amount appears to be annual (> $1.50).');
            }

            // Check math: Payout should be Amount * Quantity
            const expected = Math.round(msftDiv.amount * 6 * 100) / 100;
            if (Math.abs(msftDiv.estimatedPayout - expected) < 0.02) {
                console.log(`✅ PASS: Payout calculation matches (Amount * Qty). Got ${msftDiv.estimatedPayout}, Expected ${expected}`);
            } else {
                console.error(`❌ FAIL: Payout calculation mismatch. Got ${msftDiv.estimatedPayout}, Expected ${expected}`);
            }

            // Specific Check for User's "5.46" expectation (approximate)
            // If rate is 3.64 -> 0.91 -> 5.46
            if (msftDiv.estimatedPayout >= 5.0 && msftDiv.estimatedPayout <= 6.0) {
                console.log('✅ PASS: Payout is within expected range (~$5.46).');
            } else {
                console.warn(`⚠️ NOTE: Payout ${msftDiv.estimatedPayout} is outside expected range ($5.00-$6.00). Rate might have changed.`);
            }

        } else {
            console.warn('⚠️ WARNING: No dividend data found for MSFT (maybe no upcoming dividend in range?)');
        }

    } catch (error) {
        console.error('Error in Test 2:', error);
    }
};

runVerification();
