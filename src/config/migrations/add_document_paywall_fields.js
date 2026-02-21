import { sql } from '../db.js';

/**
 * Migration: Add paywall and audit fields to documents table
 */
export async function addDocumentPaywallFields() {
  try {
    await sql`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS generated_file_path VARCHAR(512),
      ADD COLUMN IF NOT EXISTS version_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(128),
      ADD COLUMN IF NOT EXISTS risk_level VARCHAR(32),
      ADD COLUMN IF NOT EXISTS regeneration_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS category VARCHAR(64),
      ADD COLUMN IF NOT EXISTS complexity VARCHAR(32),
      ADD COLUMN IF NOT EXISTS user_type VARCHAR(32)
    `;
    console.log('Document paywall fields migration completed');
    return { success: true };
  } catch (error) {
    console.error('Document paywall migration failed:', error);
    throw error;
  }
}
