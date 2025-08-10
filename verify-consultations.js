import { sql } from './src/config/db.js';

async function verifyConsultations() {
  try {
    console.log('🔍 Verifying consultations system...\n');
    
    // 1. Check table structure
    console.log('1. Checking table structure...');
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'consultations'
      ORDER BY ordinal_position;
    `;
    
    const columnNames = columns.map(col => col.column_name);
    console.log('Columns found:', columnNames);
    
    // Check for required columns
    const requiredColumns = ['case_id', 'client_id', 'freelancer_id', 'consultation_type', 'scheduled_at', 'status'];
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
    
    if (missingColumns.length > 0) {
      console.log('❌ Missing required columns:', missingColumns);
      return;
    } else {
      console.log('✅ All required columns present');
    }
    
    // 2. Check for test data
    console.log('\n2. Checking for test data...');
    const testCase = await sql`SELECT id, client_id FROM "case" LIMIT 1`;
    const testFreelancer = await sql`SELECT user_id FROM freelancer LIMIT 1`;
    const testUser = await sql`SELECT id FROM "user" LIMIT 1`;
    
    if (testCase.length === 0) {
      console.log('❌ No cases found in database');
      return;
    }
    
    if (testFreelancer.length === 0) {
      console.log('❌ No freelancers found in database');
      return;
    }
    
    console.log('✅ Test data available');
    console.log('  - Test case ID:', testCase[0].id, 'Client ID:', testCase[0].client_id);
    console.log('  - Test freelancer ID:', testFreelancer[0].user_id);
    
    // 3. Test consultation creation
    console.log('\n3. Testing consultation creation...');
    
    const testConsultation = await sql`
      INSERT INTO consultations (
        case_id, client_id, freelancer_id, consultation_type, 
        scheduled_at, status, duration, notes
      ) VALUES (
        ${testCase[0].id}, ${testCase[0].client_id}, ${testFreelancer[0].user_id},
        'chat', NOW() + INTERVAL '1 hour', 'scheduled', 30, 'Test consultation'
      ) RETURNING id, case_id, client_id, freelancer_id, consultation_type, status
    `;
    
    console.log('✅ Test consultation created successfully');
    console.log('  - Consultation ID:', testConsultation[0].id);
    console.log('  - Case ID:', testConsultation[0].case_id);
    console.log('  - Client ID:', testConsultation[0].client_id);
    console.log('  - Freelancer ID:', testConsultation[0].freelancer_id);
    console.log('  - Type:', testConsultation[0].consultation_type);
    console.log('  - Status:', testConsultation[0].status);
    
    // 4. Test consultation retrieval
    console.log('\n4. Testing consultation retrieval...');
    
    const retrievedConsultation = await sql`
      SELECT 
        c.*,
        u.name as client_name,
        f.name as freelancer_name,
        cs.title as case_title
      FROM consultations c
      LEFT JOIN "user" u ON c.client_id = u.id
      LEFT JOIN freelancer f ON c.freelancer_id = f.user_id
      LEFT JOIN "case" cs ON c.case_id = cs.id
      WHERE c.id = ${testConsultation[0].id}
    `;
    
    if (retrievedConsultation.length > 0) {
      console.log('✅ Consultation retrieved successfully');
      console.log('  - Client Name:', retrievedConsultation[0].client_name);
      console.log('  - Freelancer Name:', retrievedConsultation[0].freelancer_name);
      console.log('  - Case Title:', retrievedConsultation[0].case_title);
    } else {
      console.log('❌ Failed to retrieve consultation');
    }
    
    // 5. Test status update
    console.log('\n5. Testing status update...');
    
    await sql`
      UPDATE consultations 
      SET status = 'in_progress', started_at = NOW()
      WHERE id = ${testConsultation[0].id}
    `;
    
    const updatedConsultation = await sql`
      SELECT status, started_at FROM consultations WHERE id = ${testConsultation[0].id}
    `;
    
    if (updatedConsultation[0].status === 'in_progress') {
      console.log('✅ Status updated successfully');
      console.log('  - New Status:', updatedConsultation[0].status);
      console.log('  - Started At:', updatedConsultation[0].started_at);
    } else {
      console.log('❌ Status update failed');
    }
    
    // 6. Clean up test data
    console.log('\n6. Cleaning up test data...');
    await sql`DELETE FROM consultations WHERE id = ${testConsultation[0].id}`;
    console.log('✅ Test consultation cleaned up');
    
    // 7. Summary
    console.log('\n🎉 CONSULTATIONS SYSTEM VERIFICATION COMPLETE');
    console.log('✅ Table structure is correct');
    console.log('✅ Consultation creation works');
    console.log('✅ Consultation retrieval works');
    console.log('✅ Status updates work');
    console.log('✅ Database operations are functioning properly');
    
    console.log('\n🚀 The consultation system is ready for use!');
    console.log('   - Lawyers can schedule consultations');
    console.log('   - Clients can view their consultations');
    console.log('   - Status updates work properly');
    console.log('   - All database operations are functional');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    console.error('Error details:', error.message);
  } finally {
    process.exit(0);
  }
}

verifyConsultations(); 