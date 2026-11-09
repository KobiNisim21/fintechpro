import express from 'express';
import { protect } from '../middleware/auth.js';
import { getActivity, recordActivity, exportPortfolio } from '../controllers/activityController.js';
const router = express.Router();
router.use(protect);
router.get('/', getActivity);
router.get('/export', exportPortfolio);
router.post('/:id', recordActivity);
export default router;
