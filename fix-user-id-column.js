import { sql } from './src/config/db.js';

async function fixUserIdColumn() {
  try {
    console.log('Fixing user_id column issue...');
    
    // Check current table structure
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'consultations'
      ORDER BY ordinal_position;
    `;
    
    console.log('Current table structure:');
    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check if user_id exists and is required
    const hasUserId = columns.some(col => col.column_name === 'user_id');
    const hasClientId = columns.some(col => col.column_name === 'client_id');
    
    // Check if method exists and is required
    const hasMethod = columns.some(col => col.column_name === 'method');
    const hasConsultationType = columns.some(col => col.column_name === 'consultation_type');
    
    // Fix user_id column
    if (hasUserId && !hasClientId) {
      console.log('Found user_id column, renaming to client_id...');
      
      // First, make user_id nullable so we can work with it
      await sql`ALTER TABLE consultations ALTER COLUMN user_id DROP NOT NULL`;
      console.log('✅ Made user_id nullable');
      
      // Rename user_id to client_id
      await sql`ALTER TABLE consultations RENAME COLUMN user_id TO client_id`;
      console.log('✅ Renamed user_id to client_id');
      
      // Make client_id required again
      await sql`ALTER TABLE consultations ALTER COLUMN client_id SET NOT NULL`;
      console.log('✅ Made client_id required');
      
    } else if (hasUserId && hasClientId) {
      console.log('Both user_id and client_id exist, copying data and dropping user_id...');
      
      // Copy data from user_id to client_id where client_id is null
      await sql`UPDATE consultations SET client_id = user_id WHERE client_id IS NULL`;
      console.log('✅ Copied data from user_id to client_id');
      
      // Drop user_id column
      await sql`ALTER TABLE consultations DROP COLUMN user_id`;
      console.log('✅ Dropped user_id column');
      
    } else if (!hasUserId && hasClientId) {
      console.log('✅ user_id column already fixed, client_id exists');
    } else {
      console.log('❌ Neither user_id nor client_id found, this is unexpected');
    }
    
    // Fix method column
    if (hasMethod && !hasConsultationType) {
      console.log('Found method column, renaming to consultation_type...');
      
      // First, make method nullable so we can work with it
      await sql`ALTER TABLE consultations ALTER COLUMN method DROP NOT NULL`;
      console.log('✅ Made method nullable');
      
      // Rename method to consultation_type
      await sql`ALTER TABLE consultations RENAME COLUMN method TO consultation_type`;
      console.log('✅ Renamed method to consultation_type');
      
      // Make consultation_type required again
      await sql`ALTER TABLE consultations ALTER COLUMN consultation_type SET NOT NULL`;
      console.log('✅ Made consultation_type required');
      
    } else if (hasMethod && hasConsultationType) {
      console.log('Both method and consultation_type exist, copying data and dropping method...');
      
      // Copy data from method to consultation_type where consultation_type is null
      await sql`UPDATE consultations SET consultation_type = method WHERE consultation_type IS NULL`;
      console.log('✅ Copied data from method to consultation_type');
      
      // Drop method column
      await sql`ALTER TABLE consultations DROP COLUMN method`;
      console.log('✅ Dropped method column');
      
    } else if (!hasMethod && hasConsultationType) {
      console.log('✅ method column already fixed, consultation_type exists');
    } else {
      console.log('❌ Neither method nor consultation_type found, this is unexpected');
    }
    
    // Verify the fix
    const updatedColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'consultations'
      ORDER BY ordinal_position;
    `;
    
    console.log('\nUpdated table structure:');
    updatedColumns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Test inserting a consultation
    console.log('\nTesting consultation creation...');
    
    // Get test data
    const testCase = await sql`SELECT id, client_id FROM "case" LIMIT 1`;
    const testFreelancer = await sql`SELECT user_id FROM freelancer LIMIT 1`;
    
    if (testCase.length > 0 && testFreelancer.length > 0) {
      // Check current column names for the test
      const currentColumns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'consultations' 
        AND column_name IN ('consultation_type', 'method')
        ORDER BY column_name
      `;
      
      const hasConsultationType = currentColumns.some(col => col.column_name === 'consultation_type');
      const columnName = hasConsultationType ? 'consultation_type' : 'method';
      
      console.log(`Using column: ${columnName} for consultation type`);
      
      // Use dynamic SQL based on column name
      if (columnName === 'consultation_type') {
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
        const testConsultation = await sql`
          INSERT INTO consultations (
            case_id, client_id, freelancer_id, method, 
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
      }
    } else {
      console.log('⚠️  No test data available for consultation creation test');
    }
    
    console.log('\n✅ user_id column issue fixed successfully');
    
  } catch (error) {
    console.error('❌ Error fixing user_id column:', error);
  } finally {
    process.exit(0);
  }
}

fixUserIdColumn(); 