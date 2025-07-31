import express from 'express';
import { getUserPaymentHistory, getUserPaymentStats } from '../controllers/paymentHistoryController.js';

const router = express.Router();

// GET /api/payment-history - Get user's payment history
router.get('/', getUserPaymentHistory);

// GET /api/payment-history/stats - Get user's payment statistics
router.get('/stats', getUserPaymentStats);

export default router; 