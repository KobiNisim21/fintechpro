import express from 'express';
import { getQuote, getNews, getMarketNews, getForexRate, getStockCandles, getExtendedQuote, getBatchExtendedQuote, searchStocks, listAllIsraeli, testTaseRaw, setIsraeliPrice, getIsraeliPrices, refreshIsraeliPrices, adminFixPosition, getAnalystRecommendations, getPriceTarget, getCompanyProfile, getBatchInsights, getPortfolioAnalytics, getMarketCalendar, getBatchHistory, getPortfolioSnapshot } from '../controllers/stocksController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes (No auth required)
router.get('/list-all', listAllIsraeli);
router.get('/tase-raw-test', testTaseRaw);
router.get('/israeli-prices', getIsraeliPrices);
router.post('/set-israeli-price', setIsraeliPrice);
router.post('/refresh-israeli-prices', refreshIsraeliPrices);
router.post('/admin-fix-position', adminFixPosition);

// Protect all routes (require authentication)
router.use(protect);

// Batch endpoints MUST come before :symbol routes
router.get('/batch-history', getBatchHistory);
router.get('/portfolio-snapshot', getPortfolioSnapshot);
router.get('/batch-extended-quote', getBatchExtendedQuote);
router.get('/batch-insights', getBatchInsights);
router.get('/portfolio-analytics', getPortfolioAnalytics);
router.get('/market-calendar', getMarketCalendar);
router.get('/market/news', getMarketNews);
router.get('/forex/usd-ils', getForexRate);
router.get('/search', searchStocks); // Add Search Route

router.get('/:symbol/quote', getQuote);
router.get('/:symbol/news', getNews);
router.get('/:symbol/extended-quote', getExtendedQuote);
router.get('/:symbol/history', getStockCandles);
router.get('/:symbol/recommendation', getAnalystRecommendations);
router.get('/:symbol/price-target', getPriceTarget);
router.get('/:symbol/profile', getCompanyProfile);

export default router;
