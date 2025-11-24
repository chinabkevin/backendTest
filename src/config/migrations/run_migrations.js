import { migrateVoiceCallSupport } from './add_voice_call_support.js';
import { addPaymentsTable } from './add_payments_table.js';
import { addAiDocumentsTable } from './add_ai_documents_table.js';
import { addProfileImageFields } from './add_profile_image_fields.js';
import { addUserProfileFields } from './add_user_profile_fields.js';
import { addCaseTable } from './add_case_table.js';
import { addConsultationsTable } from './add_consultations_table.js';
import { addConsultationColumns } from './add_consultation_columns.js';
import { addWithdrawalTable } from './add_withdrawal_table.js';
import { fixConsultationFreelancerFK } from './fix_consultation_freelancer_fk.js';
import { addPaymentStatusToConsultations } from './add_payment_status_to_consultations.js';
import { addUniqueConstraintToPayments } from './add_unique_constraint_to_payments.js';
import { addNotificationsTable } from './add_notifications_table.js';
import { addBarristerTable } from './add_barrister_table.js';
import { addBarristerOnboardingTables } from './add_barrister_onboarding_tables.js';
import { addBarristerProfessionalInfoTables } from './add_barrister_professional_info_tables.js';
import { addBarristerDashboardTables } from './add_barrister_dashboard_tables.js';
import { addCaseReferralsTable } from './add_case_referrals_table.js';
import { addCaseBarristerSupport } from './add_case_barrister_support.js';

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
    
    // Run consultation foreign key fix migration
    const consultationFKResult = await fixConsultationFreelancerFK();
    console.log('Consultation FK fix migration result:', consultationFKResult);
    
    // Run consultation payment status migration
    const consultationPaymentResult = await addPaymentStatusToConsultations();
    console.log('Consultation payment status migration result:', consultationPaymentResult);
    
    // Run unique constraint migration for payments table
    const uniqueConstraintResult = await addUniqueConstraintToPayments();
    console.log('Unique constraint migration result:', uniqueConstraintResult);
    
    // Run notifications table migration
    const notificationsResult = await addNotificationsTable();
    console.log('Notifications table migration result:', notificationsResult);
    
    // Run barrister table migration
    const barristerResult = await addBarristerTable();
    console.log('Barrister table migration result:', barristerResult);
    
    // Run barrister onboarding tables migration
    const barristerOnboardingResult = await addBarristerOnboardingTables();
    console.log('Barrister onboarding tables migration result:', barristerOnboardingResult);
    
    // Run barrister professional info tables migration
    const barristerProfessionalInfoResult = await addBarristerProfessionalInfoTables();
    console.log('Barrister professional info tables migration result:', barristerProfessionalInfoResult);
    
    // Run barrister dashboard tables migration
    const barristerDashboardResult = await addBarristerDashboardTables();
    console.log('Barrister dashboard tables migration result:', barristerDashboardResult);
    
    // Run case referrals table migration
    const caseReferralsResult = await addCaseReferralsTable();
    console.log('Case referrals table migration result:', caseReferralsResult);
    
    // Run case barrister support migration
    const caseBarristerSupportResult = await addCaseBarristerSupport();
    console.log('Case barrister support migration result:', caseBarristerSupportResult);
    
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
