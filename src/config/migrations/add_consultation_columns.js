import { sql } from '../db.js';

export async function addConsultationColumns() {
  try {
    console.log('Adding missing columns to consultations table...');
    
    // Add case_id column if it doesn't exist
    await sql`
      ALTER TABLE consultations 
      ADD COLUMN IF NOT EXISTS case_id INTEGER REFERENCES "case"(id) ON DELETE CASCADE
    `;
    
    // Rename user_id to client_id if user_id exists and client_id doesn't
    const hasUserId = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'consultations' AND column_name = 'user_id'
    `;
    
    const hasClientId = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'consultations' AND column_name = 'client_id'
    `;
    
    if (hasUserId.length > 0 && hasClientId.length === 0) {
      await sql`ALTER TABLE consultations RENAME COLUMN user_id TO client_id`;
      console.log('Renamed user_id to client_id');
    }
    
    // Add client_id if neither exists
    if (hasUserId.length === 0 && hasClientId.length === 0) {
      await sql`
        ALTER TABLE consultations 
        ADD COLUMN client_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE
      `;
    }
    
    // Rename method to consultation_type if method exists and consultation_type doesn't
    const hasMethod = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'consultations' AND column_name = 'method'
    `;
    
    const hasConsultationType = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'consultations' AND column_name = 'consultation_type'
    `;
    
    if (hasMethod.length > 0 && hasConsultationType.length === 0) {
      await sql`ALTER TABLE consultations RENAME COLUMN method TO consultation_type`;
      console.log('Renamed method to consultation_type');
    }
    
    // Add consultation_type if neither exists
    if (hasMethod.length === 0 && hasConsultationType.length === 0) {
      await sql`
        ALTER TABLE consultations 
        ADD COLUMN consultation_type VARCHAR(20) NOT NULL DEFAULT 'chat' 
        CHECK (consultation_type IN ('chat', 'video', 'audio'))
      `;
    }
    
    // Add other optional columns
    await sql`
      ALTER TABLE consultations 
      ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 30
    `;
    
    await sql`
      ALTER TABLE consultations 
      ADD COLUMN IF NOT EXISTS meeting_link TEXT
    `;
    
    await sql`
      ALTER TABLE consultations 
      ADD COLUMN IF NOT EXISTS outcome TEXT
    `;
    
    await sql`
      ALTER TABLE consultations 
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP
    `;
    
    await sql`
      ALTER TABLE consultations 
      ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP
    `;
    
    // Handle existing status data before updating constraints
    console.log('Updating existing status values...');
    
    // Check current status values
    const currentStatuses = await sql`
      SELECT DISTINCT status FROM consultations
    `;
    console.log('Current status values:', currentStatuses.map(s => s.status));
    
    // Update existing status values to match new constraints
    await sql`
      UPDATE consultations 
      SET status = 'scheduled' 
      WHERE status = 'confirmed'
    `;
    
    await sql`
      UPDATE consultations 
      SET status = 'scheduled' 
      WHERE status = 'rescheduled'
    `;
    
    // Update status constraints
    await sql`
      ALTER TABLE consultations 
      DROP CONSTRAINT IF EXISTS consultations_status_check
    `;
    
    await sql`
      ALTER TABLE consultations 
      ALTER COLUMN status SET DEFAULT 'scheduled'
    `;
    
    await sql`
      ALTER TABLE consultations 
      ADD CONSTRAINT consultations_status_check 
      CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'))
    `;
    
    console.log('✅ Consultations table columns added successfully');
    
    return {
      success: true,
      message: 'Consultations table columns added successfully'
    };
  } catch (error) {
    console.error('Error adding consultation columns:', error);
    return {
      success: false,
      message: 'Failed to add consultation columns',
      error: error.message
    };
  }
} 