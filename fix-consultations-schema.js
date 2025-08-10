import { sql } from './src/config/db.js';

async function fixConsultationsSchema() {
  try {
    console.log('Fixing consultations table schema...');
    
    // Check current table structure
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'consultations'
      ORDER BY ordinal_position;
    `;
    
    console.log('Current columns:', columns.map(col => col.column_name));
    
    // Check if user_id exists
    const hasUserId = columns.some(col => col.column_name === 'user_id');
    const hasClientId = columns.some(col => col.column_name === 'client_id');
    
    if (hasUserId && !hasClientId) {
      console.log('Found user_id column, renaming to client_id...');
      
      // Rename user_id to client_id
      await sql`ALTER TABLE consultations RENAME COLUMN user_id TO client_id`;
      console.log('✅ Renamed user_id to client_id');
      
    } else if (hasUserId && hasClientId) {
      console.log('Both user_id and client_id exist, copying data and dropping user_id...');
      
      // Copy data from user_id to client_id where client_id is null
      await sql`UPDATE consultations SET client_id = user_id WHERE client_id IS NULL`;
      console.log('✅ Copied data from user_id to client_id');
      
      // Drop user_id column
      await sql`ALTER TABLE consultations DROP COLUMN user_id`;
      console.log('✅ Dropped user_id column');
      
    } else if (!hasUserId && hasClientId) {
      console.log('✅ Schema already correct - client_id exists, user_id does not');
    } else {
      console.log('❌ Neither user_id nor client_id found');
    }
    
    // Verify the fix
    const updatedColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'consultations'
      ORDER BY ordinal_position;
    `;
    
    console.log('\nUpdated columns:', updatedColumns.map(col => col.column_name));
    
    // Test the consultation creation
    console.log('\nTesting consultation creation...');
    
    // Get test data
    const testCase = await sql`SELECT id, client_id FROM "case" LIMIT 1`;
    const testFreelancer = await sql`SELECT user_id FROM freelancer LIMIT 1`;
    
    if (testCase.length > 0 && testFreelancer.length > 0) {
      console.log('Test case:', testCase[0]);
      console.log('Test freelancer:', testFreelancer[0]);
      
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
      console.log('⚠️  No test data available');
    }
    
    console.log('\n✅ Consultations schema fixed successfully');
    
  } catch (error) {
    console.error('❌ Error fixing consultations schema:', error);
  } finally {
    process.exit(0);
  }
}

fixConsultationsSchema(); 