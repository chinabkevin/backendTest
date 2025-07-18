import { neon } from '@neondatabase/serverless';
import "dotenv/config";
//Create a SQL connection to the Neon database
export const sql = neon(process.env.DATABASE_URL);

export const isStagingOrLocal =
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "test" ||
  process.env.STAGING === "true" ||
  process.env.BASE_URL?.includes("localhost");

export async function initDB() {
    try {
      // Create user table FIRST
      await sql`CREATE TABLE IF NOT EXISTS "user" (
        id SERIAL PRIMARY KEY,
        supabase_id UUID UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`;
      // Then freelancer (references user)
      await sql`CREATE TABLE IF NOT EXISTS freelancer (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(20) NOT NULL,
      experience INTEGER NOT NULL,
      expertise_areas TEXT[] NOT NULL,
      id_card_url TEXT,
      bar_certificate_url TEXT,
      additional_documents TEXT[],
      is_verified BOOLEAN DEFAULT FALSE,
      verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
      verification_notes TEXT,
      is_available BOOLEAN DEFAULT FALSE,
      performance_score NUMERIC DEFAULT 0,
      total_earnings NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
  );`;
      // Then case (references user and freelancer)
      await sql`CREATE TABLE IF NOT EXISTS "case" (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        freelancer_id INTEGER REFERENCES freelancer(user_id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
        case_summary_url TEXT,
        annotated_document_url TEXT,
        annotation_notes TEXT,
        assigned_at TIMESTAMPTZ,
        accepted_at TIMESTAMPTZ,
        declined_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`;
      console.log('Connected to the database successfully');
    } catch (error) {
      console.error('Error connecting to the database:', error);
      process.exit(1);
    }
  }