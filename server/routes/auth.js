import express from 'express';
import { googleAuth, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/google', googleAuth);
router.get('/me', protect, getMe);

export default router;
