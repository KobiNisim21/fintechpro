/**
 * Vercel Cron Job: Refresh Israeli Fund Prices
 * 
 * Runs daily at 16:00 Israel Time (14:00 UTC) after TASE trading ends.
 * TASE trades Sunday–Thursday only.
 * 
 * Fetches all user positions with FUND: prefix, 
 * then tries both proxy and a direct TASE API call per fund.
 */
import { dbConnection } from '../../server/app.js';
import Position from '../../server/models/Position.js';
import CachedPrice from '../../server/models/CachedPrice.js';
import { refreshFundPriceViaProxy, setCachedPrice } from '../../server/services/israeliSecuritiesService.js';
import { getForexRate } from '../../server/services/stockDataService.js';

export default async function handler(req, res) {
    const startTime = Date.now();

    // Security: Verify Vercel Cron secret (if configured)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Ensure DB is connected
        if (dbConnection) {
            await dbConnection;
        }

        console.log('[Cron] Daily Israeli price refresh starting...');

        // 1. Find all unique FUND: symbols from user positions
        const positions = await Position.find({ symbol: /^FUND:/i }).select('symbol').lean();
        const fundIds = [...new Set(positions.map(p => p.symbol.split(':')[1]))];

        // Also include any funds already in the cache (in case user removed position but we still track)
        const cachedFunds = await CachedPrice.find({}).select('fundId').lean();
        const cachedFundIds = cachedFunds.map(f => f.fundId);
        const allFundIds = [...new Set([...fundIds, ...cachedFundIds])];

        if (allFundIds.length === 0) {
            return res.json({
                success: true,
                message: 'No Israeli funds to refresh',
                elapsed_ms: Date.now() - startTime
            });
        }

        console.log(`[Cron] Found ${allFundIds.length} funds to refresh: ${allFundIds.join(', ')}`);

        // 2. Get live USD/ILS rate from Yahoo Finance (same source as the dashboard)
        let exchangeRate = 3.65;
        try {
            const forexData = await getForexRate();
            if (forexData && forexData.rate) {
                exchangeRate = forexData.rate;
            }
        } catch (e) {
            console.warn('[Cron] Forex fetch failed, using fallback rate 3.65');
        }
        console.log(`[Cron] Using USD/ILS rate: ${exchangeRate}`);

        // 3. Refresh each fund sequentially (ScrapingAnt concurrency = 1)
        const results = [];
        for (const fundId of allFundIds) {
            try {
                console.log(`[Cron] Refreshing fund ${fundId}...`);
                const result = await refreshFundPriceViaProxy(fundId, exchangeRate);
                results.push({ fundId, status: 'success', priceILS: result.priceILS, priceUSD: result.priceUSD });

                // Wait 3s between funds to avoid ScrapingAnt concurrency issues
                if (allFundIds.indexOf(fundId) < allFundIds.length - 1) {
                    console.log('[Cron] Waiting 3s before next fund...');
                    await new Promise(r => setTimeout(r, 3000));
                }
            } catch (err) {
                console.error(`[Cron] Failed to refresh fund ${fundId}:`, err.message);
                results.push({ fundId, status: 'failed', error: err.message });
            }
        }

        const successCount = results.filter(r => r.status === 'success').length;
        console.log(`[Cron] Refresh complete: ${successCount}/${allFundIds.length} succeeded`);

        return res.json({
            success: true,
            elapsed_ms: Date.now() - startTime,
            exchange_rate: exchangeRate,
            total_funds: allFundIds.length,
            success_count: successCount,
            results
        });

    } catch (err) {
        console.error('[Cron] Fatal error:', err);
        return res.status(500).json({
            error: err.message,
            elapsed_ms: Date.now() - startTime
        });
    }
}
