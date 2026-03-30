import { sql } from '../db.js';

export async function addBarristerEngagementAcceptances() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS barrister_engagement_acceptances (
        id BIGSERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        barrister_user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        engagement_type TEXT NOT NULL DEFAULT 'public_access',
        engagement_version TEXT NOT NULL DEFAULT '2026-03-pa-v1',
        accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        signature_name TEXT,
        barrister_display_name TEXT,
        chambers_name TEXT,
        practising_certificate_no TEXT,
        client_display_name TEXT,
        scope_text TEXT,
        fees_text TEXT,
        content_snapshot JSONB
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_barrister_engagement_client_barrister_version
      ON barrister_engagement_acceptances (client_id, barrister_user_id, engagement_version)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_engagement_client
      ON barrister_engagement_acceptances (client_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_barrister_engagement_barrister
      ON barrister_engagement_acceptances (barrister_user_id)
    `;
    return { success: true };
  } catch (error) {
    console.error('addBarristerEngagementAcceptances error:', error);
    return { success: false, error: error.message };
  }
}
