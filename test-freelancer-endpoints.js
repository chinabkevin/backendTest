import { sql } from './src/config/db.js';

async function testFreelancerEndpoints() {
  try {
    console.log('🧪 Testing freelancer endpoints...\n');
    
    // 1. Check if there are any freelancers
    console.log('1. Checking freelancers...');
    const freelancers = await sql`SELECT * FROM freelancer LIMIT 5`;
    console.log('Freelancers found:', freelancers.length);
    if (freelancers.length > 0) {
      console.log('Sample freelancer:', {
        id: freelancers[0].id,
        user_id: freelancers[0].user_id,
        name: freelancers[0].name,
        email: freelancers[0].email
      });
    }
    
    // 2. Check if there are any cases
    console.log('\n2. Checking cases...');
    const cases = await sql`SELECT * FROM "case" LIMIT 5`;
    console.log('Cases found:', cases.length);
    if (cases.length > 0) {
      console.log('Sample case:', {
        id: cases[0].id,
        client_id: cases[0].client_id,
        freelancer_id: cases[0].freelancer_id,
        title: cases[0].title,
        status: cases[0].status
      });
    }
    
    // 3. Check if there are any consultations
    console.log('\n3. Checking consultations...');
    const consultations = await sql`SELECT * FROM consultations LIMIT 5`;
    console.log('Consultations found:', consultations.length);
    if (consultations.length > 0) {
      console.log('Sample consultation:', {
        id: consultations[0].id,
        case_id: consultations[0].case_id,
        client_id: consultations[0].client_id,
        freelancer_id: consultations[0].freelancer_id,
        consultation_type: consultations[0].consultation_type,
        status: consultations[0].status
      });
    }
    
    // 4. Test freelancer cases query
    if (freelancers.length > 0) {
      console.log('\n4. Testing freelancer cases query...');
      const freelancerId = freelancers[0].user_id;
      console.log('Testing with freelancer user_id:', freelancerId);
      
      const freelancerCases = await sql`
        SELECT 
          c.*,
          u.name as client_name,
          u.email as client_email
        FROM "case" c
        LEFT JOIN "user" u ON c.client_id = u.id
        WHERE c.freelancer_id = ${freelancerId}
        ORDER BY c.created_at DESC
      `;
      
      console.log('Freelancer cases found:', freelancerCases.length);
      if (freelancerCases.length > 0) {
        console.log('Sample freelancer case:', {
          id: freelancerCases[0].id,
          title: freelancerCases[0].title,
          client_name: freelancerCases[0].client_name,
          status: freelancerCases[0].status
        });
      }
    }
    
    // 5. Test freelancer consultations query
    if (freelancers.length > 0) {
      console.log('\n5. Testing freelancer consultations query...');
      const freelancerId = freelancers[0].user_id;
      console.log('Testing with freelancer user_id:', freelancerId);
      
      // First get the freelancer's internal ID
      const freelancerResult = await sql`SELECT id FROM freelancer WHERE user_id = ${freelancerId}`;
      if (freelancerResult.length > 0) {
        const freelancerInternalId = freelancerResult[0].id;
        console.log('Freelancer internal ID:', freelancerInternalId);
        
        const freelancerConsultations = await sql`
          SELECT 
            c.*,
            u.name as client_name,
            u.email as client_email,
            f.name as freelancer_name,
            f.email as freelancer_email,
            f.phone as freelancer_phone,
            cs.title as case_title,
            cs.description as case_description
          FROM consultations c
          LEFT JOIN "user" u ON c.client_id = u.id
          LEFT JOIN freelancer f ON c.freelancer_id = f.user_id
          LEFT JOIN "case" cs ON c.case_id = cs.id
          WHERE c.freelancer_id = ${freelancerInternalId}
          ORDER BY c.scheduled_at DESC
        `;
        
        console.log('Freelancer consultations found:', freelancerConsultations.length);
        if (freelancerConsultations.length > 0) {
          console.log('Sample freelancer consultation:', {
            id: freelancerConsultations[0].id,
            case_title: freelancerConsultations[0].case_title,
            client_name: freelancerConsultations[0].client_name,
            consultation_type: freelancerConsultations[0].consultation_type,
            status: freelancerConsultations[0].status
          });
        }
      }
    }
    
    // 6. Test consultation stats
    if (freelancers.length > 0) {
      console.log('\n6. Testing consultation stats...');
      const freelancerId = freelancers[0].user_id;
      
      const freelancerResult = await sql`SELECT id FROM freelancer WHERE user_id = ${freelancerId}`;
      if (freelancerResult.length > 0) {
        const freelancerInternalId = freelancerResult[0].id;
        
        const stats = await sql`
          SELECT 
            COUNT(*) as total_consultations,
            COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
          FROM consultations
          WHERE freelancer_id = ${freelancerInternalId}
        `;
        
        console.log('Consultation stats:', stats[0]);
      }
    }
    
    console.log('\n✅ Freelancer endpoint tests completed!');
    
  } catch (error) {
    console.error('❌ Error testing freelancer endpoints:', error);
  } finally {
    process.exit(0);
  }
}

testFreelancerEndpoints(); 