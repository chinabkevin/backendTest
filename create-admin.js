import { sql } from './src/config/db.js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

async function createAdmin() {
  try {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
      console.log('Usage: node create-admin.js <email> <name> <role> [password]');
      console.log('Role options: admin or super_admin');
      console.log('Password: Optional, defaults to "password123"');
      console.log('\nExample:');
      console.log('  node create-admin.js admin@advoqat.com "Admin User" super_admin');
      console.log('  node create-admin.js admin@advoqat.com "Admin User" super_admin mypassword');
      process.exit(1);
    }

    const [email, name, role, password = 'password123'] = args;

    if (role !== 'admin' && role !== 'super_admin') {
      console.error('Error: Role must be either "admin" or "super_admin"');
      process.exit(1);
    }

    // Initialize database connection
    await sql`SELECT 1`;

    // Ensure password column exists in user table
    try {
      await sql`
        ALTER TABLE "user" 
        ADD COLUMN IF NOT EXISTS password VARCHAR(255)
      `;
    } catch (error) {
      // Column might already exist, ignore error
      if (!error.message.includes('already exists')) {
        console.warn('Note: Could not add password column (might already exist)');
      }
    }

    // Hash the password (simple hash for now - in production use bcrypt)
    // For now, we'll store it as a simple hash
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    // Check if user already exists
    const existing = await sql`
      SELECT id, email, role FROM "user" WHERE email = ${email}
    `;

    if (existing.length > 0) {
      // Update existing user's role and password
      const updated = await sql`
        UPDATE "user" 
        SET role = ${role}, name = ${name}, password = ${passwordHash}, updated_at = NOW()
        WHERE email = ${email}
        RETURNING id, email, name, role
      `;
      console.log('✅ Updated existing user to admin:');
      console.log(updated[0]);
    } else {
      // Create new admin user
      const newAdmin = await sql`
        INSERT INTO "user" (supabase_id, email, name, role, password)
        VALUES (${email}, ${email}, ${name}, ${role}, ${passwordHash})
        RETURNING id, email, name, role, created_at
      `;
      console.log('✅ Created new admin user:');
      console.log(newAdmin[0]);
    }

    console.log('\n📝 Login credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ${role}`);
    console.log('\n🔗 Login at: http://localhost:3000/auth/login');
    console.log('\n⚠️  Note: The backend currently accepts any password for demo purposes.');
    console.log('   For production, update the signin endpoint to verify the stored password hash.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();

