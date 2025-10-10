import { sql } from '../db.js';

export async function up() {
  try {
    // Create contact submissions table
    await sql`
      CREATE TABLE IF NOT EXISTS contact_submissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'closed')),
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Create index for better query performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email);
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON contact_submissions(status);
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at);
    `;

    console.log('Contact submissions table created successfully');
  } catch (error) {
    console.error('Error creating contact submissions table:', error);
    throw error;
  }
}

export async function down() {
  try {
    await sql`DROP TABLE IF EXISTS contact_submissions CASCADE;`;
    console.log('Contact submissions table dropped successfully');
  } catch (error) {
    console.error('Error dropping contact submissions table:', error);
    throw error;
  }
}
