import { sql } from './src/config/db.js';

async function testConsultationTable() {
  try {
    console.log('Testing consultations table structure...');
    
    // Check if all required columns exist
    const requiredColumns = ['case_id', 'client_id', 'freelancer_id', 'consultation_type', 'scheduled_at', 'status'];
    const optionalColumns = ['duration', 'notes', 'meeting_link', 'outcome', 'started_at', 'ended_at'];
    
    const allColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'consultations'
      ORDER BY column_name
    `;
    
    const existingColumns = allColumns.map(col => col.column_name);
    console.log('Existing columns:', existingColumns);
    
    // Check required columns
    console.log('\nChecking required columns:');
    for (const col of requiredColumns) {
      const exists = existingColumns.includes(col);
      console.log(`  ${col}: ${exists ? '✅' : '❌'}`);
    }
    
    // Check optional columns
    console.log('\nChecking optional columns:');
    for (const col of optionalColumns) {
      const exists = existingColumns.includes(col);
      console.log(`  ${col}: ${exists ? '✅' : '❌'}`);
    }
    
    // Test inserting a consultation
    console.log('\nTesting consultation creation...');
    
    // Get a test case and user
    const testCase = await sql`SELECT id, client_id FROM "case" LIMIT 1`;
    const testFreelancer = await sql`SELECT user_id FROM freelancer LIMIT 1`;
    
    if (testCase.length > 0 && testFreelancer.length > 0) {
      const testConsultation = await sql`
        INSERT INTO consultations (
          case_id, client_id, freelancer_id, consultation_type, 
          scheduled_at, status, duration
        ) VALUES (
          ${testCase[0].id}, ${testCase[0].client_id}, ${testFreelancer[0].user_id},
          'chat', NOW() + INTERVAL '1 hour', 'scheduled', 30
        ) RETURNING id
      `;
      
      console.log('✅ Test consultation created with ID:', testConsultation[0].id);
      
      // Clean up test data
      await sql`DELETE FROM consultations WHERE id = ${testConsultation[0].id}`;
      console.log('✅ Test consultation cleaned up');
    } else {
      console.log('⚠️  No test data available for consultation creation test');
    }
    
    console.log('\n✅ Consultations table structure test completed successfully');
    
  } catch (error) {
    console.error('❌ Error testing consultations table:', error);
  } finally {
    process.exit(0);
  }
}

testConsultationTable(); 