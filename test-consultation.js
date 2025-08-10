import { sql } from './src/config/db.js';

async function testConsultationSystem() {
  try {
    console.log('Testing consultation system...');
    
    // Test 1: Check if consultations table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'consultations'
      );
    `;
    
    console.log('Consultations table exists:', tableExists[0].exists);
    
    // Test 2: Check table structure
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'consultations'
      ORDER BY ordinal_position;
    `;
    
    console.log('Table structure:');
    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Test 3: Check if we have any test data
    const count = await sql`SELECT COUNT(*) as count FROM consultations`;
    console.log('Current consultations count:', count[0].count);
    
    console.log('✅ Consultation system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing consultation system:', error);
  } finally {
    process.exit(0);
  }
}

testConsultationSystem(); 