import { sql } from '../db.js';

export async function addCaseBarristerSupport() {
  try {
    console.log('Adding barrister support to case table...');
    
    // Add barrister_id column to case table
    await sql`
      ALTER TABLE "case" 
      ADD COLUMN IF NOT EXISTS barrister_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL
    `;
    
    // Create index for better performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_case_barrister_id ON "case"(barrister_id)
    `;
    
    console.log('Case table updated with barrister support successfully');
    
    return {
      success: true,
      message: 'Case table updated with barrister support successfully'
    };
  } catch (error) {
    console.error('Error updating case table with barrister support:', error);
    return {
      success: false,
      message: 'Failed to update case table with barrister support',
      error: error.message
    };
  }
}

