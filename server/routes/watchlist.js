import express from 'express';
import {
    getWatchlist,
    addToWatchlist,
    removeFromWatchlist
} from '../controllers/watchlistController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protect all routes (require authentication)
router.use(protect);

router.route('/')
    .get(getWatchlist)
    .post(addToWatchlist);

router.route('/:id')
    .delete(removeFromWatchlist);

export default router;
