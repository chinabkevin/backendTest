import { sql } from '../db.js';

export async function addPaymentStatusToConsultations() {
  try {
    console.log('Adding payment status fields to consultations table...');
    
    // Add payment-related columns to consultations table
    await sql`
      ALTER TABLE consultations 
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
      ADD COLUMN IF NOT EXISTS payment_id INTEGER REFERENCES payments(id),
      ADD COLUMN IF NOT EXISTS payment_amount INTEGER,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ
    `;
    
    console.log('✅ Payment status fields added to consultations table successfully');
    
    return {
      success: true,
      message: 'Payment status fields added to consultations table successfully'
    };
  } catch (error) {
    console.error('Error adding payment status fields to consultations table:', error);
    return {
      success: false,
      message: 'Failed to add payment status fields to consultations table',
      error: error.message
    };
  }
}

// Run this file directly if needed
const isMainModule = import.meta.url.endsWith(process.argv[1]);
if (isMainModule) {
  addPaymentStatusToConsultations()
    .then(result => {
      console.log('Migration result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
