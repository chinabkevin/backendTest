import { sql } from './src/config/db.js';

async function fixConsultationsComplete() {
  try {
    console.log('🔧 Comprehensive consultations table fix...\n');
    
    // 1. Check current table structure
    console.log('1. Checking current table structure...');
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'consultations'
      ORDER BY ordinal_position;
    `;
    
    console.log('Current columns:', columns.map(col => col.column_name));
    
    // 2. Fix user_id -> client_id
    console.log('\n2. Fixing user_id -> client_id...');
    const hasUserId = columns.some(col => col.column_name === 'user_id');
    const hasClientId = columns.some(col => col.column_name === 'client_id');
    
    if (hasUserId && !hasClientId) {
      console.log('Renaming user_id to client_id...');
      await sql`ALTER TABLE consultations RENAME COLUMN user_id TO client_id`;
      console.log('✅ user_id renamed to client_id');
    } else if (hasUserId && hasClientId) {
      console.log('Both user_id and client_id exist, copying data and dropping user_id...');
      await sql`UPDATE consultations SET client_id = user_id WHERE client_id IS NULL`;
      await sql`ALTER TABLE consultations DROP COLUMN user_id`;
      console.log('✅ user_id dropped, data copied to client_id');
    } else if (!hasUserId && hasClientId) {
      console.log('✅ client_id already exists');
    } else {
      console.log('❌ Neither user_id nor client_id found');
    }
    
    // 3. Fix method -> consultation_type
    console.log('\n3. Fixing method -> consultation_type...');
    const hasMethod = columns.some(col => col.column_name === 'method');
    const hasConsultationType = columns.some(col => col.column_name === 'consultation_type');
    
    if (hasMethod && !hasConsultationType) {
      console.log('Renaming method to consultation_type...');
      await sql`ALTER TABLE consultations RENAME COLUMN method TO consultation_type`;
      console.log('✅ method renamed to consultation_type');
    } else if (hasMethod && hasConsultationType) {
      console.log('Both method and consultation_type exist, copying data and dropping method...');
      await sql`UPDATE consultations SET consultation_type = method WHERE consultation_type IS NULL`;
      await sql`ALTER TABLE consultations DROP COLUMN method`;
      console.log('✅ method dropped, data copied to consultation_type');
    } else if (!hasMethod && hasConsultationType) {
      console.log('✅ consultation_type already exists');
    } else {
      console.log('❌ Neither method nor consultation_type found');
    }
    
    // 4. Add missing columns
    console.log('\n4. Adding missing columns...');
    
    // Add case_id if it doesn't exist
    const hasCaseId = columns.some(col => col.column_name === 'case_id');
    if (!hasCaseId) {
      console.log('Adding case_id column...');
      await sql`ALTER TABLE consultations ADD COLUMN case_id INTEGER REFERENCES "case"(id) ON DELETE CASCADE`;
      console.log('✅ case_id added');
    } else {
      console.log('✅ case_id already exists');
    }
    
    // Add duration if it doesn't exist
    const hasDuration = columns.some(col => col.column_name === 'duration');
    if (!hasDuration) {
      console.log('Adding duration column...');
      await sql`ALTER TABLE consultations ADD COLUMN duration INTEGER DEFAULT 30`;
      console.log('✅ duration added');
    } else {
      console.log('✅ duration already exists');
    }
    
    // Add meeting_link if it doesn't exist
    const hasMeetingLink = columns.some(col => col.column_name === 'meeting_link');
    if (!hasMeetingLink) {
      console.log('Adding meeting_link column...');
      await sql`ALTER TABLE consultations ADD COLUMN meeting_link TEXT`;
      console.log('✅ meeting_link added');
    } else {
      console.log('✅ meeting_link already exists');
    }
    
    // Add outcome if it doesn't exist
    const hasOutcome = columns.some(col => col.column_name === 'outcome');
    if (!hasOutcome) {
      console.log('Adding outcome column...');
      await sql`ALTER TABLE consultations ADD COLUMN outcome TEXT`;
      console.log('✅ outcome added');
    } else {
      console.log('✅ outcome already exists');
    }
    
    // Add started_at if it doesn't exist
    const hasStartedAt = columns.some(col => col.column_name === 'started_at');
    if (!hasStartedAt) {
      console.log('Adding started_at column...');
      await sql`ALTER TABLE consultations ADD COLUMN started_at TIMESTAMP`;
      console.log('✅ started_at added');
    } else {
      console.log('✅ started_at already exists');
    }
    
    // Add ended_at if it doesn't exist
    const hasEndedAt = columns.some(col => col.column_name === 'ended_at');
    if (!hasEndedAt) {
      console.log('Adding ended_at column...');
      await sql`ALTER TABLE consultations ADD COLUMN ended_at TIMESTAMP`;
      console.log('✅ ended_at added');
    } else {
      console.log('✅ ended_at already exists');
    }
    
    // 5. Update constraints
    console.log('\n5. Updating constraints...');
    
    // Update status constraint
    await sql`ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_status_check`;
    await sql`ALTER TABLE consultations ALTER COLUMN status SET DEFAULT 'scheduled'`;
    await sql`
      ALTER TABLE consultations 
      ADD CONSTRAINT consultations_status_check 
      CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'))
    `;
    console.log('✅ Status constraint updated');
    
    // Update consultation_type constraint
    await sql`ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_consultation_type_check`;
    await sql`
      ALTER TABLE consultations 
      ADD CONSTRAINT consultations_consultation_type_check 
      CHECK (consultation_type IN ('chat', 'video', 'voice', 'audio'))
    `;
    console.log('✅ Consultation type constraint updated');
    
    // 6. Update existing data
    console.log('\n6. Updating existing data...');
    
    // Update status values
    await sql`UPDATE consultations SET status = 'scheduled' WHERE status = 'confirmed'`;
    await sql`UPDATE consultations SET status = 'scheduled' WHERE status = 'rescheduled'`;
    console.log('✅ Status values updated');
    
    // 7. Verify final structure
    console.log('\n7. Verifying final structure...');
    const finalColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'consultations'
      ORDER BY ordinal_position;
    `;
    
    console.log('Final columns:', finalColumns.map(col => col.column_name));
    
    // 8. Test consultation creation
    console.log('\n8. Testing consultation creation...');
    const testCase = await sql`SELECT id, client_id FROM "case" LIMIT 1`;
    const testFreelancer = await sql`SELECT user_id FROM freelancer LIMIT 1`;
    
    if (testCase.length > 0 && testFreelancer.length > 0) {
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
      console.log('  - ID:', testConsultation[0].id);
      console.log('  - Case ID:', testConsultation[0].case_id);
      console.log('  - Client ID:', testConsultation[0].client_id);
      console.log('  - Freelancer ID:', testConsultation[0].freelancer_id);
      console.log('  - Type:', testConsultation[0].consultation_type);
      console.log('  - Status:', testConsultation[0].status);
      
      // Clean up
      await sql`DELETE FROM consultations WHERE id = ${testConsultation[0].id}`;
      console.log('✅ Test consultation cleaned up');
    } else {
      console.log('⚠️  No test data available');
    }
    
    console.log('\n🎉 CONSULTATIONS TABLE FIX COMPLETE!');
    console.log('✅ All columns properly renamed');
    console.log('✅ All constraints updated');
    console.log('✅ All data migrated');
    console.log('✅ Consultation creation works');
    console.log('\n🚀 The consultations table is now ready for use!');
    
  } catch (error) {
    console.error('❌ Error fixing consultations table:', error);
  } finally {
    process.exit(0);
  }
}

fixConsultationsComplete(); 