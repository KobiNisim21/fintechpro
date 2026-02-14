import express from 'express';
import { getQuote, getNews, getMarketNews, getForexRate, getStockCandles, getExtendedQuote, getBatchExtendedQuote, searchStocks } from '../controllers/stocksController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protect all routes (require authentication)
router.use(protect);

// Batch endpoint MUST come before :symbol routes to avoid matching "batch-extended-quote" as a symbol
router.get('/batch-extended-quote', getBatchExtendedQuote);
router.get('/market/news', getMarketNews);
router.get('/forex/usd-ils', getForexRate);
router.get('/search', searchStocks); // Add Search Route

router.get('/:symbol/quote', getQuote);
router.get('/:symbol/news', getNews);
router.get('/:symbol/extended-quote', getExtendedQuote);
router.get('/:symbol/history', getStockCandles);

export default router;
