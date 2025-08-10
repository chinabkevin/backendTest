import { migrateVoiceCallSupport } from './add_voice_call_support.js';
import { addPaymentsTable } from './add_payments_table.js';
import { addAiDocumentsTable } from './add_ai_documents_table.js';
import { addProfileImageFields } from './add_profile_image_fields.js';
import { addUserProfileFields } from './add_user_profile_fields.js';
import { addCaseTable } from './add_case_table.js';
import { addConsultationsTable } from './add_consultations_table.js';
import { addConsultationColumns } from './add_consultation_columns.js';
import { addWithdrawalTable } from './add_withdrawal_table.js';

/**
 * Run all migrations in sequence
 */
async function runMigrations() {
  console.log('Running database migrations...');
  
  try {
    // Run voice call support migration
    const voiceCallResult = await migrateVoiceCallSupport();
    console.log('Voice call migration result:', voiceCallResult);
    
    // Run payments table migration
    const paymentsResult = await addPaymentsTable();
    console.log('Payments table migration result:', paymentsResult);
    
    // Run AI documents table migration
    const aiDocumentsResult = await addAiDocumentsTable();
    console.log('AI documents table migration result:', aiDocumentsResult);
    
    // Run profile image fields migration
    const profileImageResult = await addProfileImageFields();
    console.log('Profile image fields migration result:', profileImageResult);
    
    // Run user profile fields migration
    const userProfileFieldsResult = await addUserProfileFields();
    console.log('User profile fields migration result:', userProfileFieldsResult);
    
    // Run case table migration
    const caseTableResult = await addCaseTable();
    console.log('Case table migration result:', caseTableResult);
    
    // Run consultations table migration
    const consultationsResult = await addConsultationsTable();
    console.log('Consultations table migration result:', consultationsResult);
    
    // Run consultation columns migration
    const consultationColumnsResult = await addConsultationColumns();
    console.log('Consultation columns migration result:', consultationColumnsResult);
    
    // Run withdrawal table migration
    const withdrawalTableResult = await addWithdrawalTable();
    console.log('Withdrawal table migration result:', withdrawalTableResult);
    
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
