import { sql } from '../db.js';

export async function migrateVoiceCallSupport() {
  try {
    console.log('Starting voice call support migration...');
    
    // 1. Add fee columns to consultations table
    await sql`
      ALTER TABLE consultations
      ADD COLUMN IF NOT EXISTS base_fee NUMERIC DEFAULT 50,
      ADD COLUMN IF NOT EXISTS additional_fee NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_fee NUMERIC DEFAULT 50
    `;
    
    // 2. Update the consultation_type check constraint to include 'voice'
    // First, drop the existing constraint
    await sql`
      ALTER TABLE consultations
      DROP CONSTRAINT IF EXISTS consultations_consultation_type_check
    `;
    
    // Then, create the new constraint with 'voice' included
    await sql`
      ALTER TABLE consultations
      ADD CONSTRAINT consultations_consultation_type_check 
      CHECK (consultation_type IN ('chat', 'video', 'voice', 'audio'))
    `;
    
    console.log('Voice call support migration completed successfully');
    return { success: true, message: 'Voice call support migration completed successfully' };
  } catch (error) {
    console.error('Error during voice call support migration:', error);
    return { success: false, error: error.message };
  }
}

// Run this file directly if needed
// In ESM, we check if this is the main module by comparing import.meta.url
const isMainModule = import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  migrateVoiceCallSupport()
    .then(result => console.log(result))
    .catch(err => console.error(err))
    .finally(() => process.exit());
}
