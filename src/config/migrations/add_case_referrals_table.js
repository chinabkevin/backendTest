import { sql } from '../db.js';

export async function addCaseReferralsTable() {
  try {
    console.log('Creating case_referrals table...');
    
    // Create case_referrals table
    await sql`
      CREATE TABLE IF NOT EXISTS case_referrals (
        id SERIAL PRIMARY KEY,
        case_id INTEGER NOT NULL REFERENCES "case"(id) ON DELETE CASCADE,
        barrister_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        lawyer_id INTEGER NOT NULL REFERENCES freelancer(user_id) ON DELETE CASCADE,
        referral_notes TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' 
          CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
        responded_at TIMESTAMPTZ,
        response_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    
    // Create indexes for better performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_case_referrals_case_id ON case_referrals(case_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_case_referrals_barrister_id ON case_referrals(barrister_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_case_referrals_lawyer_id ON case_referrals(lawyer_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_case_referrals_status ON case_referrals(status)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_case_referrals_created_at ON case_referrals(created_at)
    `;
    
    console.log('Case referrals table created successfully');
    
    return {
      success: true,
      message: 'Case referrals table created successfully'
    };
  } catch (error) {
    console.error('Error creating case referrals table:', error);
    return {
      success: false,
      message: 'Failed to create case referrals table',
      error: error.message
    };
  }
}

