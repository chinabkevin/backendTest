import { sql } from '../db.js';

export async function addLawyerEngagementAcceptances() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS lawyer_engagement_acceptances (
        id BIGSERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        lawyer_user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        engagement_letter_version TEXT NOT NULL DEFAULT '2026-03-v1',
        accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        signature_name TEXT,
        lawyer_firm_name TEXT,
        lawyer_display_name TEXT,
        client_display_name TEXT,
        scope_text TEXT,
        fees_text TEXT,
        liability_text TEXT,
        content_snapshot JSONB
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_client_lawyer_version
      ON lawyer_engagement_acceptances (client_id, lawyer_user_id, engagement_letter_version)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_engagement_client_id
      ON lawyer_engagement_acceptances (client_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_engagement_lawyer_user_id
      ON lawyer_engagement_acceptances (lawyer_user_id)
    `;
    return { success: true };
  } catch (error) {
    console.error('addLawyerEngagementAcceptances error:', error);
    return { success: false, error: error.message };
  }
}
