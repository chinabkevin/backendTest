import { sql } from '../db.js';

export async function addCaseTable() {
  try {
    console.log('Updating case table with missing columns...');
    
    // First, add missing columns to the existing case table
    await sql`
      ALTER TABLE "case" 
      ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium',
      ADD COLUMN IF NOT EXISTS expertise_area VARCHAR(100),
      ADD COLUMN IF NOT EXISTS case_value INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS hours_spent DECIMAL(5,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(100),
      ADD COLUMN IF NOT EXISTS case_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS client_notes TEXT,
      ADD COLUMN IF NOT EXISTS time_remaining INTEGER DEFAULT 86400,
      ADD COLUMN IF NOT EXISTS auto_generated_docs JSONB DEFAULT '[]'
    `;
    
    // Update the status check constraint to include 'active' and 'completed'
    await sql`
      ALTER TABLE "case" 
      DROP CONSTRAINT IF EXISTS case_status_check
    `;
    
    await sql`
      ALTER TABLE "case" 
      ADD CONSTRAINT case_status_check 
      CHECK (status IN ('pending', 'active', 'completed', 'declined'))
    `;
    
    // Create indexes for better performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_case_client_id ON "case"(client_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_case_freelancer_id ON "case"(freelancer_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_case_status ON "case"(status)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_case_created_at ON "case"(created_at)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_case_expertise_area ON "case"(expertise_area)
    `;
    
    console.log('Case table updated successfully');
    
    return {
      success: true,
      message: 'Case table updated successfully'
    };
  } catch (error) {
    console.error('Error updating case table:', error);
    return {
      success: false,
      message: 'Failed to update case table',
      error: error.message
    };
  }
} 