import express from 'express';
import { handleStripeBarristerWebhook } from '../controllers/stripeWebhookController.js';

const router = express.Router();

router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeBarristerWebhook);

export default router;
