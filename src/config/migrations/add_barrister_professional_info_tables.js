import { sql } from '../db.js';

export async function addBarristerProfessionalInfoTables() {
  try {
    console.log('Creating barrister professional information tables...');
    
    // Create barrister_professional_info table
    await sql`
      CREATE TABLE IF NOT EXISTS barrister_professional_info (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
        chambers_name VARCHAR(255),
        practice_address TEXT,
        areas_of_practice TEXT[], -- Array of practice areas
        services_offered TEXT,
        pricing_model VARCHAR(50) CHECK (pricing_model IN ('hourly', 'fixed_fee', 'package')),
        hourly_rate DECIMAL(10, 2),
        example_fee DECIMAL(10, 2),
        public_access_authorisation BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Create barrister_subscription table
    await sql`
      CREATE TABLE IF NOT EXISTS barrister_subscription (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
        plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('basic', 'professional', 'premium')),
        stripe_subscription_id VARCHAR(255),
        stripe_customer_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled', 'expired')),
        auto_renewal BOOLEAN DEFAULT true,
        started_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Create barrister_legal_declarations table
    await sql`
      CREATE TABLE IF NOT EXISTS barrister_legal_declarations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
        bsb_authorisation_confirmed BOOLEAN DEFAULT false,
        bmif_insurance_confirmed BOOLEAN DEFAULT false,
        public_access_compliance_confirmed BOOLEAN DEFAULT false,
        advoqat_terms_accepted BOOLEAN DEFAULT false,
        privacy_consent_confirmed BOOLEAN DEFAULT false,
        digital_signature TEXT, -- Store signature (type or draw)
        signature_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Add privacy_consent_confirmed column if it doesn't exist (for existing tables)
    await sql`
      ALTER TABLE barrister_legal_declarations 
      ADD COLUMN IF NOT EXISTS privacy_consent_confirmed BOOLEAN DEFAULT false;
    `;

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_professional_info_user_id ON barrister_professional_info(user_id);
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_subscription_user_id ON barrister_subscription(user_id);
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_subscription_status ON barrister_subscription(status);
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_legal_declarations_user_id ON barrister_legal_declarations(user_id);
    `;
    
    console.log('Barrister professional information tables created successfully');
    
    return {
      success: true,
      message: 'Barrister professional information tables created successfully'
    };
  } catch (error) {
    console.error('Error creating barrister professional information tables:', error);
    throw error;
  }
}

