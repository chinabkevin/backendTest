import { sql } from '../db.js';

/**
 * Add platform commission fields to payments table for freelancer marketplace.
 * Stores: platform_fee, freelancer_earnings, freelancer_id, client_id, case_id, payment_date.
 */
export async function addPaymentsCommissionFields() {
  try {
    console.log('Adding commission fields to payments table...');

    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS platform_fee INTEGER`;
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS freelancer_earnings INTEGER`;
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS freelancer_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS case_id INTEGER REFERENCES "case"(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ DEFAULT NOW()`;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_payments_freelancer_id ON payments(freelancer_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_payments_case_id ON payments(case_id)
    `;

    console.log('Payments commission fields added successfully');
    return { success: true, message: 'Commission fields added' };
  } catch (error) {
    console.error('Error adding payments commission fields:', error);
    throw error;
  }
}
