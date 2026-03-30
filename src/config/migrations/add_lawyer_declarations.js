import { sql } from '../db.js';

/**
 * Compliance record: mandatory lawyer declaration at onboarding (not visible to clients).
 */
export async function addLawyerDeclarations() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS lawyer_declarations (
        id BIGSERIAL PRIMARY KEY,
        lawyer_user_id INTEGER NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        firm_name TEXT,
        regulatory_body TEXT NOT NULL,
        is_barrister BOOLEAN NOT NULL DEFAULT false,
        declarations JSONB NOT NULL,
        platform_agreement JSONB NOT NULL,
        data_protection JSONB NOT NULL,
        signature_text TEXT NOT NULL,
        signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        signature_date DATE NOT NULL DEFAULT CURRENT_DATE,
        ip_address TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_lawyer_declarations_lawyer_user
      ON lawyer_declarations (lawyer_user_id)
    `;
    return { success: true };
  } catch (error) {
    console.error('addLawyerDeclarations error:', error);
    return { success: false, error: error.message };
  }
}
