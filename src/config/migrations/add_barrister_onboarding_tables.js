import { sql } from '../db.js';

export async function addBarristerOnboardingTables() {
  try {
    console.log('Creating barrister onboarding tables...');
    
    // Add onboarding fields to user table if they don't exist
    await sql`
      ALTER TABLE "user" 
      ADD COLUMN IF NOT EXISTS onboarding_stage VARCHAR(50) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS profile_status VARCHAR(30) DEFAULT 'pending' CHECK (profile_status IN ('pending', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'INCOMPLETE')),
      ADD COLUMN IF NOT EXISTS eligibility_passed BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS year_of_call INTEGER,
      ADD COLUMN IF NOT EXISTS bsb_number VARCHAR(50)
    `;

    // Create barrister_eligibility table
    await sql`
      CREATE TABLE IF NOT EXISTS barrister_eligibility (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        answers JSONB NOT NULL,
        eligibility_passed BOOLEAN DEFAULT false,
        submitted_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id)
      );
    `;
    
    // Ensure unique constraint exists (in case table was created without it)
    await sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'barrister_eligibility_user_id_key'
        ) THEN
          ALTER TABLE barrister_eligibility 
          ADD CONSTRAINT barrister_eligibility_user_id_key UNIQUE (user_id);
        END IF;
      END $$;
    `;

    // Create barrister_documents table
    await sql`
      CREATE TABLE IF NOT EXISTS barrister_documents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL,
        file_url TEXT NOT NULL,
        file_hash VARCHAR(64),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
        uploaded_at TIMESTAMPTZ DEFAULT NOW(),
        verified_at TIMESTAMPTZ,
        verified_by VARCHAR(100),
        rejection_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Create audit_logs table for document changes
    await sql`
      CREATE TABLE IF NOT EXISTS barrister_document_audit_logs (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL REFERENCES barrister_documents(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        old_status VARCHAR(20),
        new_status VARCHAR(20),
        changed_by VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_eligibility_user_id ON barrister_eligibility(user_id);
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_documents_user_id ON barrister_documents(user_id);
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_documents_status ON barrister_documents(status);
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_documents_type ON barrister_documents(document_type);
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_onboarding_stage ON "user"(onboarding_stage);
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_profile_status ON "user"(profile_status);
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_document_audit_document_id ON barrister_document_audit_logs(document_id);
    `;
    
    console.log('Barrister onboarding tables created successfully');
    
    return {
      success: true,
      message: 'Barrister onboarding tables created successfully'
    };
  } catch (error) {
    console.error('Error creating barrister onboarding tables:', error);
    throw error;
  }
}

