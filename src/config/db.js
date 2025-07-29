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
      
      // Create consultations table
      await sql`CREATE TABLE IF NOT EXISTS consultations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        freelancer_id INTEGER NOT NULL REFERENCES freelancer(user_id) ON DELETE CASCADE,
        scheduled_at TIMESTAMPTZ NOT NULL,
        method VARCHAR(10) NOT NULL CHECK (method IN ('chat', 'video')),
        notes TEXT,
        room_url TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'rescheduled', 'completed')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`;
      
      // Create consultation feedback table
      await sql`CREATE TABLE IF NOT EXISTS consultation_feedback (
        id SERIAL PRIMARY KEY,
        consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comments TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );`;
      
      // Create documents table
      await sql`CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        template_id VARCHAR(50) NOT NULL,
        template_name VARCHAR(100) NOT NULL,
        form_data JSONB NOT NULL,
        generated_document TEXT NOT NULL,
        document_type VARCHAR(50) NOT NULL,
        document_fee INTEGER DEFAULT 1000,
        payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
        payment_session_id VARCHAR(255),
        payment_intent_id VARCHAR(255),
        paid_at TIMESTAMPTZ,
        download_count INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`;
      
      // Create chat sessions table
      await sql`CREATE TABLE IF NOT EXISTS chat_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`;
      
      // Create chat messages table
      await sql`CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        tokens_used INTEGER,
        model_used VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );`;
      
      console.log('Connected to the database successfully');
    } catch (error) {
      console.error('Error connecting to the database:', error);
      process.exit(1);
    }
  }