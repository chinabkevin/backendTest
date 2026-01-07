import { sql } from '../db.js';

export async function addChatSessionTopic() {
  try {
    console.log('Adding primary_topic column to chat_sessions table...');
    
    // Add primary_topic column if it doesn't exist
    await sql`
      ALTER TABLE chat_sessions 
      ADD COLUMN IF NOT EXISTS primary_topic VARCHAR(100)
    `;
    
    console.log('✅ Successfully added primary_topic column to chat_sessions table');
  } catch (error) {
    console.error('Error adding primary_topic column:', error);
    throw error;
  }
}

