
import dotenv from 'dotenv';
dotenv.config();

const loadService = async () => {
    try {
        const { getPortfolioHealthAndBenchmark } = await import('../server/services/stockDataService.js');
        return { getPortfolioHealthAndBenchmark };
    } catch (error) {
        console.error('Failed to import service:', error);
        process.exit(1);
    }
};

const runTest = async () => {
    console.log('--- Reproducing "Graph Start" Issue ---');
    const { getPortfolioHealthAndBenchmark } = await loadService();

    // Mock position with a NULL date (simulating a bad migration or bug)
    // new Date(null) = 1970.
    const badPositions = [
        {
            symbol: 'MSFT',
            quantity: 1,
            lots: [
                { quantity: 1, price: 400, date: null } // BAD DATE
            ]
        }
    ];

    try {
        const result = await getPortfolioHealthAndBenchmark(badPositions);
        const benchmarkData = result.benchmarkData || [];

        console.log(`Total Points: ${benchmarkData.length}`);
        if (benchmarkData.length > 0) {
            const first = benchmarkData[0];
            const firstDate = new Date(first.date);
            const now = new Date();
            const daysDiff = (now - firstDate) / (1000 * 60 * 60 * 24);

            console.log(`First Date: ${first.date}`);
            console.log(`Days covered: ${Math.round(daysDiff)}`);

            if (daysDiff > 300) {
                console.log('✅ REPRODUCED: Graph starts ~1 year ago due to "null" date -> 1970 Inception.');
            } else {
                console.log('❌ FAILED TO REPRODUCE: Graph starts recently.');
            }
        }
    } catch (e) {
        console.error(e);
    }
};

runTest();
