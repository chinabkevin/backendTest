import express from 'express';
import { 
  createCheckoutSession, 
  verifyPaymentSession, 
  handleStripeWebhook 
} from '../controllers/paymentController.js';

const router = express.Router();

// POST /api/payments/create-checkout-session - Create a new checkout session
router.post('/create-checkout-session', createCheckoutSession);

// GET /api/payments/verify/:sessionId - Verify a payment session
router.get('/verify/:sessionId', verifyPaymentSession);

// POST /api/payments/webhook - Handle Stripe webhook
// Note: This endpoint should be raw body, not JSON parsed
// The express.raw middleware MUST be applied specifically to this route
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router;
