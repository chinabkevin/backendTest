import { sql } from '../db.js';

export async function addFreelancerConsultationFees() {
  try {
    console.log('Adding consultation fee columns to freelancer table...');
    
    // Add consultation fee columns to freelancer table
    await sql`
      ALTER TABLE freelancer
      ADD COLUMN IF NOT EXISTS base_consultation_fee NUMERIC(10, 2) DEFAULT 50,
      ADD COLUMN IF NOT EXISTS video_consultation_fee NUMERIC(10, 2) DEFAULT 50,
      ADD COLUMN IF NOT EXISTS chat_consultation_fee NUMERIC(10, 2) DEFAULT 40,
      ADD COLUMN IF NOT EXISTS voice_consultation_fee NUMERIC(10, 2) DEFAULT 65,
      ADD COLUMN IF NOT EXISTS voice_call_additional_fee NUMERIC(10, 2) DEFAULT 15
    `;
    
    console.log('Consultation fee columns added to freelancer table successfully.');
    
    return { success: true };
  } catch (error) {
    console.error('Error adding consultation fee columns to freelancer table:', error);
    return { success: false, error: error.message };
  }
}

