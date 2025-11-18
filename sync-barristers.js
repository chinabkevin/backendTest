import { sql } from './src/config/db.js';
import dotenv from 'dotenv';

dotenv.config();

async function syncBarristers() {
  try {
    console.log('Starting barrister sync...');
    
    // Get all users with role='barrister' who don't have a barrister record
    const usersWithoutBarristerRecord = await sql`
      SELECT u.id, u.email, u.name, u.phone, u.profile_status, u.onboarding_stage
      FROM "user" u
      LEFT JOIN barrister b ON u.id = b.user_id
      WHERE u.role = 'barrister' AND b.id IS NULL
    `;

    console.log(`Found ${usersWithoutBarristerRecord.length} barristers to sync`);

    if (usersWithoutBarristerRecord.length === 0) {
      console.log('All barristers are already synced!');
      process.exit(0);
    }

    let syncedCount = 0;
    const errors = [];

    for (const user of usersWithoutBarristerRecord) {
      try {
        // Determine status based on profile_status
        let status = 'PENDING_VERIFICATION';
        if (user.profile_status === 'APPROVED') {
          status = 'APPROVED';
        } else if (user.profile_status === 'REJECTED') {
          status = 'REJECTED';
        }

        // Determine stage based on onboarding_stage
        let stage = 'document_upload_completed';
        if (user.onboarding_stage === 'eligibility_check') {
          stage = 'eligibility_check';
        } else if (user.onboarding_stage === 'professional_information') {
          stage = 'professional_information';
        } else if (user.onboarding_stage === 'review' || user.onboarding_stage === 'pending_verification') {
          stage = 'review';
        } else if (user.onboarding_stage === 'completed') {
          stage = 'completed';
        }

        await sql`
          INSERT INTO barrister (user_id, name, email, phone, status, stage)
          VALUES (${user.id}, ${user.name || 'Unknown'}, ${user.email}, ${user.phone || null}, ${status}, ${stage})
          ON CONFLICT (user_id) DO NOTHING
        `;
        
        console.log(`✓ Synced barrister: ${user.name || user.email} (ID: ${user.id})`);
        syncedCount++;
      } catch (error) {
        console.error(`✗ Error syncing barrister ${user.id} (${user.email}):`, error.message);
        errors.push({ userId: user.id, email: user.email, error: error.message });
      }
    }

    console.log('\n=== Sync Summary ===');
    console.log(`Total barristers found: ${usersWithoutBarristerRecord.length}`);
    console.log(`Successfully synced: ${syncedCount}`);
    console.log(`Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(err => {
        console.log(`  - User ${err.userId} (${err.email}): ${err.error}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Fatal error syncing barristers:', error);
    process.exit(1);
  }
}

syncBarristers();

