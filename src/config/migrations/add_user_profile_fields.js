import { sql } from '../db.js';

export async function addUserProfileFields() {
  try {
    console.log('Adding phone and address fields to user table...');
    
    // Add phone and address fields to user table
    await sql`
      ALTER TABLE "user" 
      ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS address TEXT
    `;
    
    console.log('Phone and address fields added successfully');
    return { success: true, message: 'Phone and address fields added successfully' };
  } catch (error) {
    console.error('Error adding user profile fields:', error);
    return { success: false, message: 'Failed to add user profile fields', error: error.message };
  }
} 