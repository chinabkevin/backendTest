import { migrateVoiceCallSupport } from './add_voice_call_support.js';

/**
 * Run all migrations in sequence
 */
async function runMigrations() {
  console.log('Running database migrations...');
  
  try {
    // Run voice call support migration
    const voiceCallResult = await migrateVoiceCallSupport();
    console.log('Voice call migration result:', voiceCallResult);
    
    // Add future migrations here
    
    console.log('All migrations completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, error: error.message };
  }
}

// Run this file directly if needed
// In ESM, we check if this is the main module by comparing import.meta.url
const isMainModule = import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  runMigrations()
    .then(result => console.log(result))
    .catch(err => console.error(err))
    .finally(() => process.exit());
}

export { runMigrations };
