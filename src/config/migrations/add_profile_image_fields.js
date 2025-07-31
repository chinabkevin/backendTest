import { sql } from '../db.js';

export async function addProfileImageFields() {
  try {
    console.log('Adding profile image fields to user table...');
    
    // Add profile image fields to user table
    await sql`
      ALTER TABLE "user" 
      ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS profile_image_public_id VARCHAR(255)
    `;
    
    // Create index for profile image public_id for faster lookups
    await sql`CREATE INDEX IF NOT EXISTS idx_user_profile_image_public_id ON "user"(profile_image_public_id)`;
    
    console.log('Profile image fields added successfully');
    return { success: true, message: 'Profile image fields added successfully' };
  } catch (error) {
    console.error('Error adding profile image fields:', error);
    return { success: false, message: 'Failed to add profile image fields', error: error.message };
  }
} 