import { sql } from '../db.js';

export async function addUniqueConstraintToPayments() {
  try {
    console.log('Adding unique constraint to payments table for consultation_id...');
    
    // Add unique constraint on consultation_id
    // First check if constraint already exists
    const constraintExists = await sql`
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'unique_consultation_payment' 
      AND table_name = 'payments'
    `;
    
    if (constraintExists.length === 0) {
      await sql`
        ALTER TABLE payments 
        ADD CONSTRAINT unique_consultation_payment 
        UNIQUE (consultation_id)
      `;
      console.log('Unique constraint added');
    } else {
      console.log('Unique constraint already exists');
    }
    
    console.log('✅ Unique constraint added to payments table successfully');
    return { 
      success: true, 
      message: 'Unique constraint added to payments table successfully' 
    };
  } catch (error) {
    console.error('Error adding unique constraint to payments table:', error);
    return { 
      success: false, 
      message: 'Failed to add unique constraint to payments table', 
      error: error.message 
    };
  }
}

// Run this file directly if needed
if (import.meta.url === `file://${process.argv[1]}`) {
  addUniqueConstraintToPayments()
    .then(result => {
      console.log('Migration result:', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
