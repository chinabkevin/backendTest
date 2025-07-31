import { sql } from '../db.js';

export async function addPaymentsTable() {
  try {
    console.log('Creating payments table...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        consultation_id INTEGER REFERENCES consultations(id) ON DELETE SET NULL,
        document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
        stripe_session_id VARCHAR(255) UNIQUE,
        stripe_payment_intent_id VARCHAR(255),
        amount INTEGER NOT NULL, -- Amount in cents
        currency VARCHAR(3) DEFAULT 'usd',
        payment_method VARCHAR(50),
        status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, completed, failed, refunded
        service_type VARCHAR(50) NOT NULL, -- consultation, document_download
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    
    // Create indexes for better performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_payments_service_type ON payments(service_type)
    `;
    
    console.log('Payments table created successfully');
    
    return {
      success: true,
      message: 'Payments table created successfully'
    };
  } catch (error) {
    console.error('Error creating payments table:', error);
    return {
      success: false,
      message: 'Failed to create payments table',
      error: error.message
    };
  }
} 