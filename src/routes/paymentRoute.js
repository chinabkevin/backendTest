import express from 'express';
import {
  createCheckoutSession,
  createDocumentCheckoutSession,
  verifyPaymentSession,
  confirmDocumentPayment,
  handleStripeWebhook,
} from '../controllers/paymentController.js';

const router = express.Router();

// POST /api/payments/create-checkout-session - Create a new checkout session (e.g. consultation)
router.post('/create-checkout-session', createCheckoutSession);

// POST /api/payments/create-document-session - Create checkout for document unlock (paywall)
router.post('/create-document-session', createDocumentCheckoutSession);

// GET /api/payments/verify/:sessionId - Verify a payment session
router.get('/verify/:sessionId', verifyPaymentSession);

// POST /api/payments/confirm-document-session - Mark document paid and generate file (e.g. when webhook didn't run)
router.post('/confirm-document-session', confirmDocumentPayment);

// POST /api/payments/webhook - Handle Stripe webhook
// Note: This endpoint should be raw body, not JSON parsed
// The express.raw middleware MUST be applied specifically to this route
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router;
