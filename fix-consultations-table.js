import { sql } from './src/config/db.js';

async function fixConsultationsTable() {
  try {
    console.log('Fixing consultations table structure...');
    
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
    
    // Add missing columns for the new structure
    const missingColumns = [];
    
    // Check if case_id exists
    const hasCaseId = columns.some(col => col.column_name === 'case_id');
    if (!hasCaseId) {
      missingColumns.push('case_id');
    }
    
    // Check if client_id exists (might be called user_id)
    const hasClientId = columns.some(col => col.column_name === 'client_id');
    const hasUserId = columns.some(col => col.column_name === 'user_id');
    if (!hasClientId && hasUserId) {
      // Rename user_id to client_id
      console.log('Renaming user_id to client_id...');
      await sql`ALTER TABLE consultations RENAME COLUMN user_id TO client_id`;
      console.log('✅ user_id renamed to client_id');
    } else if (!hasClientId && !hasUserId) {
      missingColumns.push('client_id');
    }
    
    // Check if consultation_type exists (might be called method)
    const hasConsultationType = columns.some(col => col.column_name === 'consultation_type');
    const hasMethod = columns.some(col => col.column_name === 'method');
    if (!hasConsultationType && hasMethod) {
      // Rename method to consultation_type
      console.log('Renaming method to consultation_type...');
      await sql`ALTER TABLE consultations RENAME COLUMN method TO consultation_type`;
      console.log('✅ method renamed to consultation_type');
    } else if (!hasConsultationType && !hasMethod) {
      missingColumns.push('consultation_type');
    }
    
    // Add missing columns
    for (const colName of missingColumns) {
      console.log(`Adding missing ${colName} column...`);
      switch (colName) {
        case 'case_id':
          await sql`ALTER TABLE consultations ADD COLUMN case_id INTEGER REFERENCES "case"(id) ON DELETE CASCADE`;
          break;
        case 'client_id':
          await sql`ALTER TABLE consultations ADD COLUMN client_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE`;
          break;
        case 'consultation_type':
          await sql`ALTER TABLE consultations ADD COLUMN consultation_type VARCHAR(20) NOT NULL DEFAULT 'chat' CHECK (consultation_type IN ('chat', 'video', 'audio'))`;
          break;
      }
      console.log(`✅ ${colName} column added successfully`);
    }
    
    // Add other optional columns if they don't exist
    const optionalColumns = ['duration', 'notes', 'meeting_link', 'outcome', 'started_at', 'ended_at'];
    for (const colName of optionalColumns) {
      const hasColumn = columns.some(col => col.column_name === colName);
      if (!hasColumn) {
        console.log(`Adding missing ${colName} column...`);
        switch (colName) {
          case 'duration':
            await sql`ALTER TABLE consultations ADD COLUMN duration INTEGER DEFAULT 30`;
            break;
          case 'notes':
            await sql`ALTER TABLE consultations ADD COLUMN notes TEXT`;
            break;
          case 'meeting_link':
            await sql`ALTER TABLE consultations ADD COLUMN meeting_link TEXT`;
            break;
          case 'outcome':
            await sql`ALTER TABLE consultations ADD COLUMN outcome TEXT`;
            break;
          case 'started_at':
            await sql`ALTER TABLE consultations ADD COLUMN started_at TIMESTAMP`;
            break;
          case 'ended_at':
            await sql`ALTER TABLE consultations ADD COLUMN ended_at TIMESTAMP`;
            break;
        }
        console.log(`✅ ${colName} column added successfully`);
      }
    }
    
    // Handle existing status data before updating constraints
    console.log('Updating existing status values...');
    
    // Check current status values
    const currentStatuses = await sql`
      SELECT DISTINCT status FROM consultations
    `;
    console.log('Current status values:', currentStatuses.map(s => s.status));
    
    // Update existing status values to match new constraints
    await sql`
      UPDATE consultations 
      SET status = 'scheduled' 
      WHERE status = 'confirmed'
    `;
    
    await sql`
      UPDATE consultations 
      SET status = 'completed' 
      WHERE status = 'completed'
    `;
    
    await sql`
      UPDATE consultations 
      SET status = 'cancelled' 
      WHERE status = 'cancelled'
    `;
    
    await sql`
      UPDATE consultations 
      SET status = 'scheduled' 
      WHERE status = 'rescheduled'
    `;
    
    // Update status column constraints
    console.log('Updating status column constraints...');
    
    // Drop existing constraint
    await sql`ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_status_check`;
    
    // Update default value
    await sql`ALTER TABLE consultations ALTER COLUMN status SET DEFAULT 'scheduled'`;
    
    // Add new constraint
    await sql`
      ALTER TABLE consultations 
      ADD CONSTRAINT consultations_status_check 
      CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'))
    `;
    
    console.log('✅ Status column constraints updated');
    
    console.log('✅ Consultations table structure fixed successfully');
    
  } catch (error) {
    console.error('❌ Error fixing consultations table:', error);
  } finally {
    process.exit(0);
  }
}

fixConsultationsTable(); 