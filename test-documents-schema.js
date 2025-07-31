import dotenv from 'dotenv';
import { sql } from './src/config/db.js';

// Load environment variables
dotenv.config();

console.log('🔍 Testing Documents Table Schema...\n');

async function testDocumentsSchema() {
  try {
    console.log('Checking documents table structure...');
    
    // Get table schema
    const schema = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'documents'
      ORDER BY ordinal_position
    `;
    
    console.log('✅ Documents table columns:');
    schema.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Test a simple query
    console.log('\nTesting simple documents query...');
    const testQuery = await sql`
      SELECT COUNT(*) as total FROM documents LIMIT 1
    `;
    console.log('✅ Basic query successful, total documents:', testQuery[0]?.total || 0);
    
    // Test with specific columns
    console.log('\nTesting query with specific columns...');
    const testColumns = await sql`
      SELECT 
        id,
        template_name,
        payment_status,
        created_at,
        updated_at
      FROM documents 
      LIMIT 1
    `;
    console.log('✅ Column query successful:', testColumns.length > 0 ? 'Data found' : 'No data');
    
  } catch (error) {
    console.error('❌ Schema test error:', error.message);
    console.error('Error stack:', error.stack);
  }
}

testDocumentsSchema(); 