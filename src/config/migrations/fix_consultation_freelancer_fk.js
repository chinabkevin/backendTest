import { sql } from '../db.js';

export async function fixConsultationFreelancerFK() {
  try {
    console.log('Fixing consultation freelancer foreign key constraint...');
    
    // First, check what data exists
    const existingConsultations = await sql`
      SELECT id, freelancer_id FROM consultations 
      WHERE freelancer_id IS NOT NULL
    `;
    console.log('Existing consultations with freelancer_id:', existingConsultations);
    
    // Check what freelancer IDs exist
    const existingFreelancers = await sql`
      SELECT id, user_id, name FROM freelancer
    `;
    console.log('Existing freelancers:', existingFreelancers);
    
    // Find consultations with invalid freelancer_id values
    const validFreelancerIds = existingFreelancers.map(f => f.id);
    const invalidConsultations = existingConsultations.filter(c => 
      !validFreelancerIds.includes(c.freelancer_id)
    );
    
    if (invalidConsultations.length > 0) {
      console.log('Found consultations with invalid freelancer_id:', invalidConsultations);
      
      // Delete consultations with invalid freelancer_id
      for (const consultation of invalidConsultations) {
        await sql`
          DELETE FROM consultations WHERE id = ${consultation.id}
        `;
        console.log(`Deleted consultation ${consultation.id} with invalid freelancer_id ${consultation.freelancer_id}`);
      }
    }
    
    // Now drop the existing foreign key constraint
    await sql`
      ALTER TABLE consultations 
      DROP CONSTRAINT IF EXISTS consultations_freelancer_id_fkey
    `;
    console.log('Dropped existing foreign key constraint');
    
    // Add the correct foreign key constraint that references freelancer.id
    await sql`
      ALTER TABLE consultations 
      ADD CONSTRAINT consultations_freelancer_id_fkey 
      FOREIGN KEY (freelancer_id) REFERENCES freelancer(id) ON DELETE CASCADE
    `;
    console.log('Added correct foreign key constraint');
    
    console.log('✅ Consultation freelancer foreign key constraint fixed successfully');
    
    return {
      success: true,
      message: 'Consultation freelancer foreign key constraint fixed successfully'
    };
  } catch (error) {
    console.error('Error fixing consultation freelancer foreign key constraint:', error);
    return {
      success: false,
      message: 'Failed to fix consultation freelancer foreign key constraint',
      error: error.message
    };
  }
}

// Run this file directly if needed
const isMainModule = import.meta.url.endsWith(process.argv[1]);
if (isMainModule) {
  fixConsultationFreelancerFK()
    .then(result => {
      console.log('Migration result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
