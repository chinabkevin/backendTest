import { sql } from '../db.js';

/**
 * Allow barrister_subscription.plan_type to include 3_months, 6_months, 12_months
 * for mandatory subscription billing (Basic £50, Professional £80, Premium £120).
 */
export async function addBarristerSubscriptionPlanTypes() {
  try {
    console.log('Updating barrister_subscription plan_type constraint...');

    // Drop existing check constraint (name may vary by DB)
    await sql`
      ALTER TABLE barrister_subscription
      DROP CONSTRAINT IF EXISTS barrister_subscription_plan_type_check
    `;

    // Add new check to allow basic|professional|premium|3_months|6_months|12_months
    await sql`
      ALTER TABLE barrister_subscription
      ADD CONSTRAINT barrister_subscription_plan_type_check
      CHECK (plan_type IN (
        'basic', 'professional', 'premium',
        '3_months', '6_months', '12_months'
      ))
    `;

    console.log('Barrister subscription plan types updated successfully');
    return { success: true, message: 'Plan type constraint updated' };
  } catch (error) {
    console.error('Error updating barrister_subscription plan_type:', error);
    throw error;
  }
}
