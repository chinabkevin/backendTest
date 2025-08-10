import { sql } from '../db.js';

export async function addConsultationsTable() {
  try {
    console.log('Creating consultations table...');
    
    // Create consultations table
    await sql`
      CREATE TABLE IF NOT EXISTS consultations (
        id SERIAL PRIMARY KEY,
        case_id INTEGER REFERENCES "case"(id) ON DELETE CASCADE,
        freelancer_id INTEGER REFERENCES freelancer(user_id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
        consultation_type VARCHAR(20) NOT NULL CHECK (consultation_type IN ('chat', 'video', 'audio')),
        scheduled_at TIMESTAMP NOT NULL,
        duration INTEGER DEFAULT 30,
        notes TEXT,
        meeting_link TEXT,
        status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
        outcome TEXT,
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    // Create indexes for better performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_consultations_case_id ON consultations(case_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_consultations_freelancer_id ON consultations(freelancer_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_consultations_client_id ON consultations(client_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_consultations_scheduled_at ON consultations(scheduled_at)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_consultations_type ON consultations(consultation_type)
    `;
    
    console.log('Consultations table created successfully');
    
    return {
      success: true,
      message: 'Consultations table created successfully'
    };
  } catch (error) {
    console.error('Error creating consultations table:', error);
    return {
      success: false,
      message: 'Failed to create consultations table',
      error: error.message
    };
  }
} 