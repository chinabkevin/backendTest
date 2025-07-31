import { sql } from '../db.js';

export async function addAiDocumentsTable() {
  try {
    console.log('Creating ai_documents table...');
    await sql`
      CREATE TABLE IF NOT EXISTS ai_documents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        extracted_text TEXT,
        session_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    
    // Create indexes for better performance
    await sql`CREATE INDEX IF NOT EXISTS idx_ai_documents_user_id ON ai_documents(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ai_documents_session_id ON ai_documents(session_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ai_documents_created_at ON ai_documents(created_at)`;
    
    console.log('AI documents table created successfully');
    return { success: true, message: 'AI documents table created successfully' };
  } catch (error) {
    console.error('Error creating ai_documents table:', error);
    return { success: false, message: 'Failed to create ai_documents table', error: error.message };
  }
} 