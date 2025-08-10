import { sql } from '../db.js';

export async function addWithdrawalTable() {
  try {
    console.log('Creating withdrawal table...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS withdrawal (
        id SERIAL PRIMARY KEY,
        freelancer_id INTEGER NOT NULL REFERENCES freelancer(user_id) ON DELETE CASCADE,
        amount INTEGER NOT NULL, -- Amount in cents
        method VARCHAR(50) NOT NULL, -- bank, paypal, stripe
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
        notes TEXT,
        processed_at TIMESTAMP WITH TIME ZONE,
        requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    
    // Create indexes for better performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_withdrawal_freelancer_id ON withdrawal(freelancer_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal(status)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_withdrawal_requested_at ON withdrawal(requested_at)
    `;
    
    console.log('Withdrawal table created successfully');
    
    return {
      success: true,
      message: 'Withdrawal table created successfully'
    };
  } catch (error) {
    console.error('Error creating withdrawal table:', error);
    return {
      success: false,
      message: 'Failed to create withdrawal table',
      error: error.message
    };
  }
}
