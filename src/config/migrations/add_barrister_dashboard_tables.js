import { sql } from '../db.js';

export async function addBarristerDashboardTables() {
  try {
    console.log('Creating barrister dashboard tables...');
    
    // Create barrister_profiles table (public profile information)
    await sql`
      CREATE TABLE IF NOT EXISTS barrister_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
        full_name VARCHAR(255),
        trading_name VARCHAR(255),
        bio TEXT,
        profile_photo_url TEXT,
        areas_of_practice TEXT[],
        pricing_model VARCHAR(50) CHECK (pricing_model IN ('hourly', 'fixed_fee', 'package', 'mixed')),
        hourly_rate NUMERIC(10, 2),
        key_stages_timescales TEXT,
        complaints_info TEXT,
        vat_status VARCHAR(20),
        response_time VARCHAR(50),
        consultation_channels TEXT[],
        coverage_regions TEXT[],
        languages TEXT[],
        profile_complete BOOLEAN DEFAULT false,
        profile_published BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_profiles_user_id ON barrister_profiles(user_id)
    `;
    
    // Create barrister_enquiries table (client requests to barristers)
    await sql`
      CREATE TABLE IF NOT EXISTS barrister_enquiries (
        id SERIAL PRIMARY KEY,
        barrister_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        client_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        case_id INTEGER REFERENCES "case"(id) ON DELETE SET NULL,
        subject VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        enquiry_type VARCHAR(50) DEFAULT 'general',
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'info_requested', 'withdrawn')),
        requested_info TEXT,
        decline_reason TEXT,
        documents JSONB DEFAULT '[]'::jsonb,
        response_time INTEGER, -- in hours
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        responded_at TIMESTAMPTZ
      )
    `;

    // Create client_care_letters table
    await sql`
      CREATE TABLE IF NOT EXISTS client_care_letters (
        id SERIAL PRIMARY KEY,
        enquiry_id INTEGER NOT NULL REFERENCES barrister_enquiries(id) ON DELETE CASCADE,
        barrister_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        client_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        case_id INTEGER REFERENCES "case"(id) ON DELETE SET NULL,
        letter_content TEXT NOT NULL,
        pdf_url TEXT,
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'rejected')),
        sent_at TIMESTAMPTZ,
        signed_at TIMESTAMPTZ,
        signature_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Create messages table (secure communication)
    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        receiver_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        enquiry_id INTEGER REFERENCES barrister_enquiries(id) ON DELETE SET NULL,
        case_id INTEGER REFERENCES "case"(id) ON DELETE SET NULL,
        subject VARCHAR(255),
        content TEXT NOT NULL,
        attachments JSONB DEFAULT '[]'::jsonb,
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMPTZ,
        encrypted BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Create barrister_compliance table (certificates, renewals)
    await sql`
      CREATE TABLE IF NOT EXISTS barrister_compliance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('practising_certificate', 'bmif_insurance', 'public_access', 'other')),
        document_name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        expiry_date DATE,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'expired', 'rejected')),
        verified_by INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
        verified_at TIMESTAMPTZ,
        rejection_reason TEXT,
        reminder_sent BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Create barrister_analytics table (for performance tracking)
    await sql`
      CREATE TABLE IF NOT EXISTS barrister_analytics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        enquiries_received INTEGER DEFAULT 0,
        enquiries_accepted INTEGER DEFAULT 0,
        enquiries_declined INTEGER DEFAULT 0,
        avg_response_time_hours NUMERIC(10, 2),
        cases_completed INTEGER DEFAULT 0,
        cases_by_type JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, period_start, period_end)
      )
    `;

    // Create resources table (templates, guides)
    await sql`
      CREATE TABLE IF NOT EXISTS resources (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL CHECK (category IN ('bsb_rules', 'templates', 'guides', 'forms')),
        file_url TEXT,
        file_type VARCHAR(50),
        file_size INTEGER,
        is_active BOOLEAN DEFAULT true,
        download_count INTEGER DEFAULT 0,
        created_by INTEGER REFERENCES "user"(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Create indexes for better performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_enquiries_barrister_id ON barrister_enquiries(barrister_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_enquiries_client_id ON barrister_enquiries(client_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_enquiries_status ON barrister_enquiries(status)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_messages_enquiry_id ON messages(enquiry_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_compliance_user_id ON barrister_compliance(user_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_compliance_expiry_date ON barrister_compliance(expiry_date)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_client_care_letters_enquiry_id ON client_care_letters(enquiry_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_client_care_letters_status ON client_care_letters(status)
    `;

    console.log('Barrister dashboard tables created successfully');
    
    return {
      success: true,
      message: 'Barrister dashboard tables created successfully'
    };
  } catch (error) {
    console.error('Error creating barrister dashboard tables:', error);
    throw error;
  }
}

