import express from 'express';
import {
    getPositions,
    addPosition,
    updatePosition,
    deletePosition
} from '../controllers/positionsController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protect all routes (require authentication)
router.use(protect);

router.route('/')
    .get(getPositions)
    .post(addPosition);

router.route('/:id')
    .put(updatePosition)
    .delete(deletePosition);

export default router;
