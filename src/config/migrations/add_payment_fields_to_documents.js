import { sql } from '../db.js';

/**
 * Migration: Add payment-related fields to documents table
 * This migration adds the necessary columns for the payment-before-download feature
 */
export async function addPaymentFieldsToDocuments() {
  try {
    console.log('Starting migration: Adding payment fields to documents table...');

    // Add payment-related columns to the documents table
    await sql`
      ALTER TABLE documents 
      ADD COLUMN IF NOT EXISTS document_fee INTEGER DEFAULT 1000,
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
      ADD COLUMN IF NOT EXISTS payment_session_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0
    `;

    console.log('✅ Successfully added payment fields to documents table');
    console.log('   - document_fee (INTEGER, default 1000 = $10.00)');
    console.log('   - payment_status (VARCHAR, default "pending")');
    console.log('   - payment_session_id (VARCHAR)');
    console.log('   - payment_intent_id (VARCHAR)');
    console.log('   - paid_at (TIMESTAMPTZ)');
    console.log('   - download_count (INTEGER, default 0)');

    // Update existing documents to have the default payment status
    const result = await sql`
      UPDATE documents 
      SET payment_status = 'pending', document_fee = 1000, download_count = 0
      WHERE payment_status IS NULL OR document_fee IS NULL OR download_count IS NULL
    `;

    console.log(`✅ Updated ${result.count || 0} existing documents with default payment values`);
    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addPaymentFieldsToDocuments()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}
