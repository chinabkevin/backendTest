import { sql } from '../db.js';

export async function addBarristerTable() {
  try {
    console.log('Creating barrister table...');
    
    // Create barrister table
    await sql`
      CREATE TABLE IF NOT EXISTS barrister (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(20),
        practising_certificate_url TEXT,
        public_access_accreditation_url TEXT,
        bmif_insurance_url TEXT,
        qualified_person_document_url TEXT,
        qualified_person_name VARCHAR(100),
        qualified_person_email VARCHAR(255),
        status VARCHAR(30) DEFAULT 'PENDING_VERIFICATION' CHECK (status IN ('PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'INCOMPLETE')),
        stage VARCHAR(50) DEFAULT 'document_upload_completed' CHECK (stage IN ('eligibility_check', 'document_upload_completed', 'professional_information', 'review', 'completed')),
        verification_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    // Create indexes for better performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_user_id ON barrister(user_id);
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_status ON barrister(status);
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_stage ON barrister(stage);
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_email ON barrister(email);
    `;
    
    console.log('Barrister table created successfully');
    
    return {
      success: true,
      message: 'Barrister table created successfully'
    };
  } catch (error) {
    console.error('Error creating barrister table:', error);
    throw error;
  }
}

