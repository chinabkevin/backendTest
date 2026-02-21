import { sql } from '../db.js';

export async function addBarristerValidatedAt() {
  try {
    console.log('Adding validated_at to barrister table...');

    await sql`
      ALTER TABLE barrister
      ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ
    `;

    console.log('Barrister validated_at column added successfully');
    return { success: true, message: 'Barrister validated_at column added successfully' };
  } catch (error) {
    console.error('Error adding validated_at to barrister:', error);
    return { success: false, message: 'Failed to add validated_at', error: error.message };
  }
}
