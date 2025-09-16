import { sql } from '../db.js';

export async function addNotificationsTable() {
  try {
    console.log('Creating notifications table...');
    
    // Create notifications table
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL, -- 'case_assigned', 'case_accepted', 'case_completed', 'consultation_booked', 'payment_received', 'message_received'
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSONB DEFAULT '{}', -- Additional data like case_id, consultation_id, etc.
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        read_at TIMESTAMP
      )
    `;
    
    // Create indexes for better performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type)
    `;
    
    console.log('Notifications table created successfully');
    
    return {
      success: true,
      message: 'Notifications table created successfully'
    };
  } catch (error) {
    console.error('Error creating notifications table:', error);
    return {
      success: false,
      message: 'Failed to create notifications table',
      error: error.message
    };
  }
}
