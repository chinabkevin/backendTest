import stripe from '../config/stripe.js';
import { sql } from '../config/db.js';
import logger from '../utils/logger.js';
import { sendSubscriptionThankYouEmail } from '../utils/emailService.js';

const PLAN_DAYS = {
  '3_months': 90,
  '6_months': 180,
  '12_months': 365
};

const PLAN_DISPLAY_NAMES = {
  '3_months': 'Basic (3 Months)',
  '6_months': 'Professional (6 Months)',
  '12_months': 'Premium (12 Months)'
};

/**
 * Handle checkout.session.completed for barrister subscription (one-time payment).
 * Updates barrister_subscription with plan, status, started_at, expires_at.
 * Exported so it can be called from the main payments webhook (/api/payments/webhook) too.
 */
export async function handleBarristerCheckoutCompleted(session) {
  const { planId, userId } = session.metadata || {};
  if (!planId || !userId) {
    logger.log('Stripe barrister webhook: missing planId or userId in metadata', { sessionId: session.id });
    return;
  }

  const days = PLAN_DAYS[planId];
  if (!days) {
    logger.error('Stripe barrister webhook: invalid planId', { planId, sessionId: session.id });
    return;
  }

  const dbUserId = parseInt(userId, 10);
  if (Number.isNaN(dbUserId)) {
    logger.error('Stripe barrister webhook: invalid userId', { userId, sessionId: session.id });
    return;
  }

  const startedAt = new Date();
  const expiresAt = new Date(startedAt);
  expiresAt.setDate(expiresAt.getDate() + days);

  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;

  const existing = await sql`
    SELECT id FROM barrister_subscription WHERE user_id = ${dbUserId}
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE barrister_subscription
      SET
        plan_type = ${planId},
        stripe_customer_id = ${stripeCustomerId},
        status = 'active',
        started_at = ${startedAt},
        expires_at = ${expiresAt},
        updated_at = NOW()
      WHERE user_id = ${dbUserId}
    `;
  } else {
    await sql`
      INSERT INTO barrister_subscription (
        user_id, plan_type, stripe_customer_id, status,
        auto_renewal, started_at, expires_at
      )
      VALUES (
        ${dbUserId}, ${planId}, ${stripeCustomerId}, 'active',
        false, ${startedAt}, ${expiresAt}
      )
    `;
  }

  const expiryDateDisplay = expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  logger.log('Barrister subscription updated via Stripe webhook', {
    userId: dbUserId,
    planId,
    expiresAt: expiresAt.toISOString(),
    subscriptionExpiresOn: expiryDateDisplay,
    sessionId: session.id
  });
  logger.log(`Subscription will expire on: ${expiryDateDisplay} (user_id: ${dbUserId})`);

  try {
    const userRows = await sql`
      SELECT name, email FROM "user" WHERE id = ${dbUserId} LIMIT 1
    `;
    if (userRows.length > 0) {
      const { name, email } = userRows[0];
      const planName = PLAN_DISPLAY_NAMES[planId] || planId;
      const startStr = startedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const endStr = expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      await sendSubscriptionThankYouEmail(email, name, planName, startStr, endStr);
    }
  } catch (emailErr) {
    logger.error('Failed to send subscription thank-you email', emailErr);
  }
}

/**
 * POST /api/stripe/webhook
 * Raw body required. Handles checkout.session.completed for barrister subscriptions.
 */
export async function handleStripeBarristerWebhook(req, res) {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_BARRISTER || process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error('Stripe barrister webhook: STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET_BARRISTER not set');
    return res.status(500).send('Webhook secret not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    logger.error('Stripe barrister webhook signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    // Only process one-time payments for barrister subscription (metadata.planId)
    if (session.metadata?.planId && session.mode === 'payment') {
      await handleBarristerCheckoutCompleted(session);
    }
  }

  res.json({ received: true });
}
