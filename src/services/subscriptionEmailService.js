import { sql } from '../config/db.js';
import { sendSubscriptionExpiryReminderEmail } from '../utils/emailService.js';
import logger from '../utils/logger.js';

/**
 * Find barristers whose subscription expires in 2 days or less (status active)
 * and send expiry reminder emails.
 * Called daily by cron at 02:00.
 */
export async function runSubscriptionExpiryReminders() {
  try {
    const now = new Date();
    const inTwoDays = new Date(now);
    inTwoDays.setDate(inTwoDays.getDate() + 2);

    const rows = await sql`
      SELECT bs.user_id, bs.expires_at, bs.plan_type, u.name, u.email
      FROM barrister_subscription bs
      JOIN "user" u ON u.id = bs.user_id
      WHERE bs.status = 'active'
        AND bs.expires_at IS NOT NULL
        AND bs.expires_at <= ${inTwoDays}
        AND bs.expires_at >= ${now}
    `;

    const billingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/barrister/dashboard/billing`;

    for (const row of rows) {
      try {
        const expiryStr = new Date(row.expires_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        await sendSubscriptionExpiryReminderEmail(row.email, row.name, expiryStr, billingUrl);
        logger.log('Subscription expiry reminder sent', { userId: row.user_id, email: row.email });
      } catch (err) {
        logger.error('Failed to send expiry reminder to user', { userId: row.user_id, error: err.message });
      }
    }

    return { sent: rows.length };
  } catch (error) {
    logger.error('Subscription expiry reminders job failed', error);
    throw error;
  }
}
