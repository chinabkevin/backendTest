import { sql } from './src/config/db.js';

async function checkAndFixConsultationsTable() {
  try {
    console.log('Checking consultations table structure...');
    
    // Check if table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'consultations'
      );
    `;
    
    console.log('Consultations table exists:', tableExists[0].exists);
    
    if (!tableExists[0].exists) {
      console.log('Table does not exist, creating it...');
      const { addConsultationsTable } = await import('./src/config/migrations/add_consultations_table.js');
      const result = await addConsultationsTable();
      console.log('Table creation result:', result);
      return;
    }
    
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
    
    // Check if case_id column exists
    const hasCaseId = columns.some(col => col.column_name === 'case_id');
    console.log('Has case_id column:', hasCaseId);
    
    if (!hasCaseId) {
      console.log('Adding missing case_id column...');
      await sql`
        ALTER TABLE consultations 
        ADD COLUMN case_id INTEGER REFERENCES "case"(id) ON DELETE CASCADE
      `;
      console.log('case_id column added successfully');
    }
    
    // Check if other required columns exist
    const requiredColumns = ['freelancer_id', 'client_id', 'consultation_type', 'scheduled_at', 'status'];
    for (const colName of requiredColumns) {
      const hasColumn = columns.some(col => col.column_name === colName);
      if (!hasColumn) {
        console.log(`Adding missing ${colName} column...`);
        // Add the missing column based on the expected structure
        switch (colName) {
          case 'freelancer_id':
            await sql`ALTER TABLE consultations ADD COLUMN freelancer_id INTEGER REFERENCES freelancer(user_id) ON DELETE CASCADE`;
            break;
          case 'client_id':
            await sql`ALTER TABLE consultations ADD COLUMN client_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE`;
            break;
          case 'consultation_type':
            await sql`ALTER TABLE consultations ADD COLUMN consultation_type VARCHAR(20) NOT NULL DEFAULT 'chat' CHECK (consultation_type IN ('chat', 'video', 'audio'))`;
            break;
          case 'scheduled_at':
            await sql`ALTER TABLE consultations ADD COLUMN scheduled_at TIMESTAMP NOT NULL DEFAULT NOW()`;
            break;
          case 'status':
            await sql`ALTER TABLE consultations ADD COLUMN status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'))`;
            break;
        }
        console.log(`${colName} column added successfully`);
      }
    }
    
    // Check for other optional columns
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
        console.log(`${colName} column added successfully`);
      }
    }
    
    console.log('✅ Consultations table structure check completed');
    
  } catch (error) {
    console.error('❌ Error checking/fixing consultations table:', error);
  } finally {
    process.exit(0);
  }
}

checkAndFixConsultationsTable(); 