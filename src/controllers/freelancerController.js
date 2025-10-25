import { sql } from "../config/db.js";
import { createNotification } from "./notificationController.js";

export async function registerFreelancer(req, res){
    const { name, email, phone, experience, expertiseAreas, idCardUrl, barCertificateUrl, additionalDocuments, userId } = req.body;
    console.log('🔍 registerFreelancer called with:', { name, email, phone, experience, expertiseAreas, userId });
    
    try {
      if (!name || !email || !phone || !experience || !expertiseAreas || !userId) {
        console.log('❌ Missing required fields');
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      console.log('🔍 Attempting to insert freelancer into database...');
      const freelancer = await sql`INSERT INTO freelancer (name, email, phone, experience, expertise_areas, id_card_url, bar_certificate_url, additional_documents, user_id) VALUES (${name}, ${email}, ${phone}, ${experience}, ${expertiseAreas}, ${idCardUrl}, ${barCertificateUrl}, ${additionalDocuments}, ${userId}) RETURNING *`;
      console.log('✅ Freelancer inserted:', freelancer);
      
      if (!freelancer || freelancer.length === 0) {
        console.log('❌ No freelancer returned from insert');
        return res.status(400).json({ error: 'Failed to register freelancer' });
      }
      
      // Set user role to freelancer
      console.log('🔍 Updating user role to freelancer...');
      await sql`UPDATE "user" SET role = 'freelancer' WHERE id = ${userId}`;
      console.log('✅ User role updated to freelancer');
      
      console.log('✅ Freelancer registered successfully');
      res.status(201).json(freelancer[0]);
    } catch (error) {
      console.error('❌ Error registering freelancer:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Error code:', error.code);
      res.status(500).json({ error: 'Failed to register freelancer' });
    }
}

export async function getFreelancers(req, res){
    try {
        const freelancers = await sql`SELECT * FROM freelancer`;
        console.log('freelancers', freelancers);
        res.json(freelancers);
    } catch (error) {
        console.error('Error getting freelancers:', error);
        res.status(500).json({ error: 'Failed to get freelancers' });
    }
}

export async function getFreelancerById(req, res){
    try { 
        const { userId } = req.params;
        console.log('userId', userId);
        
        // Handle both Supabase UUID and numeric database ID
        let dbUserId = userId;
        if (userId.includes('-')) { // This is a Supabase UUID
            console.log('Converting Supabase UUID to database ID for freelancer...');
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                console.log('User not found for Supabase ID:', userId);
                return res.status(404).json({ error: 'User not found' });
            }
            dbUserId = user[0].id;
            console.log('Converted to database ID:', dbUserId);
        } else {
            console.log('Using numeric user ID:', dbUserId);
        }
        
        const freelancer = await sql`SELECT * FROM freelancer WHERE user_id = ${dbUserId} ORDER BY created_at DESC`;
        if (!freelancer) {
          return res.status(404).json({ error: 'Freelancer not found' });
        }
        res.json(freelancer);
      } catch (error) { 
        console.error('Error getting freelancer:', error);
        res.status(500).json({ error: 'Failed to get freelancer' });
      }
}

export async function deleteFreelancer(req, res) {
    const { userId } = req.params;
    try {
        // Handle both Supabase UUID and numeric database ID
        let dbUserId = userId;
        if (userId.includes('-')) { // This is a Supabase UUID
            console.log('Converting Supabase UUID to database ID for delete...');
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                console.log('User not found for Supabase ID:', userId);
                return res.status(404).json({ error: 'User not found' });
            }
            dbUserId = user[0].id;
            console.log('Converted to database ID:', dbUserId);
        } else {
            console.log('Using numeric user ID:', dbUserId);
        }
        
        const freelancer = await sql`DELETE FROM freelancer WHERE user_id = ${dbUserId} RETURNING *`;
        if (!freelancer.length) return res.status(404).json({ error: 'Freelancer not found' });
        res.json({ message: 'Freelancer deleted successfully' });
    } catch (error) {
        console.error('Error deleting freelancer:', error);
        res.status(500).json({ error: 'Failed to delete freelancer' });
    }
}

export async function updateFreelancerProfile(req, res) {
    const { userId } = req.params;
    const { name, phone, experience, expertiseAreas } = req.body;
    try {
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        
        // Handle both Supabase UUID and numeric database ID
        let dbUserId = userId;
        if (userId.includes('-')) { // This is a Supabase UUID
            console.log('Converting Supabase UUID to database ID for profile update...');
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                console.log('User not found for Supabase ID:', userId);
                return res.status(404).json({ error: 'User not found' });
            }
            dbUserId = user[0].id;
            console.log('Converted to database ID:', dbUserId);
        } else {
            console.log('Using numeric user ID:', dbUserId);
        }
        
        const updated = await sql`
            UPDATE freelancer SET
                name = COALESCE(${name}, name),
                phone = COALESCE(${phone}, phone),
                experience = COALESCE(${experience}, experience),
                expertise_areas = COALESCE(${expertiseAreas}, expertise_areas),
                updated_at = NOW()
            WHERE user_id = ${dbUserId}
            RETURNING *`;
        if (!updated.length) return res.status(404).json({ error: 'Freelancer not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error updating freelancer:', error);
        res.status(500).json({ error: 'Failed to update freelancer' });
    }
}

export async function setFreelancerAvailability(req, res) {
    const { userId } = req.params;
    const { isAvailable } = req.body;
    try {
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        if (typeof isAvailable !== 'boolean') return res.status(400).json({ error: 'isAvailable must be a boolean' });
        
        // Handle both Supabase UUID and numeric database ID
        let dbUserId = userId;
        if (userId.includes('-')) { // This is a Supabase UUID
            console.log('Converting Supabase UUID to database ID for availability...');
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                console.log('User not found for Supabase ID:', userId);
                return res.status(404).json({ error: 'User not found' });
            }
            dbUserId = user[0].id;
            console.log('Converted to database ID:', dbUserId);
        } else {
            console.log('Using numeric user ID:', dbUserId);
        }
        
        const updated = await sql`
            UPDATE freelancer SET is_available = ${isAvailable}, updated_at = NOW() WHERE user_id = ${dbUserId} RETURNING *`;
        if (!updated.length) return res.status(404).json({ error: 'Freelancer not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error updating availability:', error);
        res.status(500).json({ error: 'Failed to update availability' });
    }
}

export async function getFreelancerAvailability(req, res) {
    const { userId } = req.params;
    try {
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        
        // Handle both Supabase UUID and numeric database ID
        let dbUserId = userId;
        if (userId.includes('-')) { // This is a Supabase UUID
            console.log('Converting Supabase UUID to database ID for availability check...');
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                console.log('User not found for Supabase ID:', userId);
                return res.status(404).json({ error: 'User not found' });
            }
            dbUserId = user[0].id;
            console.log('Converted to database ID:', dbUserId);
        } else {
            console.log('Using numeric user ID:', dbUserId);
        }
        
        const freelancer = await sql`
            SELECT is_available, name, updated_at 
            FROM freelancer 
            WHERE user_id = ${dbUserId}
        `;
        
        if (!freelancer.length) return res.status(404).json({ error: 'Freelancer not found' });
        
        res.json({
            is_available: freelancer[0].is_available,
            name: freelancer[0].name,
            last_updated: freelancer[0].updated_at
        });
    } catch (error) {
        console.error('Error getting availability:', error);
        res.status(500).json({ error: 'Failed to get availability' });
    }
}

export async function getFreelancerEarnings(req, res) {
    const { userId } = req.params;
    try {
        // Handle both Supabase UUID and numeric database ID
        let dbUserId = userId;
        if (userId.includes('-')) { // This is a Supabase UUID
            console.log('Converting Supabase UUID to database ID for earnings...');
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                console.log('User not found for Supabase ID:', userId);
                return res.status(404).json({ error: 'User not found' });
            }
            dbUserId = user[0].id;
            console.log('Converted to database ID:', dbUserId);
        } else {
            console.log('Using numeric user ID:', dbUserId);
        }
        
        // Get basic freelancer info
        const freelancerResult = await sql`SELECT total_earnings FROM freelancer WHERE user_id = ${dbUserId}`;
        if (!freelancerResult.length) return res.status(404).json({ error: 'Freelancer not found' });
        
        const totalEarnings = freelancerResult[0].total_earnings || 0;
        
        // Get case statistics
        const caseStats = await sql`
            SELECT 
                COUNT(*) as total_cases,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_cases,
                AVG(CASE WHEN status = 'completed' THEN 100 END) as average_per_case
            FROM "case" 
            WHERE freelancer_id = ${dbUserId}
        `;
        
        // Get monthly earnings for current and last month
        const currentMonth = new Date();
        const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
        
        const monthlyEarnings = await sql`
            SELECT 
                COALESCE(SUM(CASE 
                    WHEN created_at >= ${currentMonth.toISOString().slice(0, 7) + '-01'} 
                    THEN 100 ELSE 0 END), 0) as this_month,
                COALESCE(SUM(CASE 
                    WHEN created_at >= ${lastMonth.toISOString().slice(0, 7) + '-01'} 
                    AND created_at < ${currentMonth.toISOString().slice(0, 7) + '-01'}
                    THEN 100 ELSE 0 END), 0) as last_month
            FROM "case" 
            WHERE freelancer_id = ${dbUserId} AND status = 'completed'
        `;
        
        // Calculate pending earnings (cases that are active but not completed)
        const pendingEarnings = await sql`
            SELECT COALESCE(COUNT(*) * 100, 0) as pending_earnings
            FROM "case" 
            WHERE freelancer_id = ${dbUserId} AND status IN ('accepted', 'pending')
        `;
        
        const earningsData = {
            total_earnings: totalEarnings,
            pending_earnings: pendingEarnings[0]?.pending_earnings || 0,
            this_month: monthlyEarnings[0]?.this_month || 0,
            last_month: monthlyEarnings[0]?.last_month || 0,
            total_cases: caseStats[0]?.total_cases || 0,
            completed_cases: caseStats[0]?.completed_cases || 0,
            average_per_case: caseStats[0]?.average_per_case || 0
        };
        
        res.json(earningsData);
    } catch (error) {
        console.error('Error fetching earnings:', error);
        res.status(500).json({ error: 'Failed to fetch earnings' });
    }
}

export async function getFreelancerRatings(req, res) {
    const { userId } = req.params;
    try {
        // Handle both Supabase UUID and numeric database ID
        let dbUserId = userId;
        if (userId.includes('-')) { // This is a Supabase UUID
            console.log('Converting Supabase UUID to database ID for ratings...');
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                console.log('User not found for Supabase ID:', userId);
                return res.status(404).json({ error: 'User not found' });
            }
            dbUserId = user[0].id;
            console.log('Converted to database ID:', dbUserId);
        } else {
            console.log('Using numeric user ID:', dbUserId);
        }
        
        // Placeholder: Replace with actual ratings table if exists
        const result = await sql`SELECT performance_score FROM freelancer WHERE user_id = ${dbUserId}`;
        if (!result.length) return res.status(404).json({ error: 'Freelancer not found' });
        res.json({ performanceScore: result[0].performance_score });
    } catch (error) {
        console.error('Error fetching ratings:', error);
        res.status(500).json({ error: 'Failed to fetch ratings' });
    }
}

export async function updateFreelancerCredentials(req, res) {
    const { userId } = req.params;
    const { idCardUrl, barCertificateUrl, additionalDocuments } = req.body;
    try {
        // Handle both Supabase UUID and numeric database ID
        let dbUserId = userId;
        if (userId.includes('-')) { // This is a Supabase UUID
            console.log('Converting Supabase UUID to database ID for credentials...');
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                console.log('User not found for Supabase ID:', userId);
                return res.status(404).json({ error: 'User not found' });
            }
            dbUserId = user[0].id;
            console.log('Converted to database ID:', dbUserId);
        } else {
            console.log('Using numeric user ID:', dbUserId);
        }
        
        const updated = await sql`
            UPDATE freelancer SET
                id_card_url = COALESCE(${idCardUrl}, id_card_url),
                bar_certificate_url = COALESCE(${barCertificateUrl}, bar_certificate_url),
                additional_documents = COALESCE(${additionalDocuments}, additional_documents),
                updated_at = NOW()
            WHERE user_id = ${dbUserId}
            RETURNING *`;
        if (!updated.length) return res.status(404).json({ error: 'Freelancer not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error updating credentials:', error);
        res.status(500).json({ error: 'Failed to update credentials' });
    }
}

// --- CASE MANAGEMENT ---
export async function listFreelancerCases(req, res) {
    const { userId } = req.params;
    try {
        // Handle both Supabase UUID and numeric database ID
        let dbUserId = userId;
        if (userId.includes('-')) { // This is a Supabase UUID
            console.log('Converting Supabase UUID to database ID for cases...');
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                console.log('User not found for Supabase ID:', userId);
                return res.status(404).json({ error: 'User not found' });
            }
            dbUserId = user[0].id;
            console.log('Converted to database ID:', dbUserId);
        } else {
            console.log('Using numeric user ID:', dbUserId);
        }
        
        const cases = await sql`SELECT * FROM "case" WHERE freelancer_id = ${dbUserId} ORDER BY created_at DESC`;
        res.json(cases);
    } catch (error) {
        console.error('Error listing cases:', error);
        res.status(500).json({ error: 'Failed to list cases' });
    }
}

export async function getFreelancerCaseById(req, res) {
    try {
        const { userId, caseId } = req.params;
        console.log('getFreelancerCaseById called with:', { userId, caseId });
        
        if (!userId || !caseId) {
            return res.status(400).json({ error: 'Missing userId or caseId' });
        }
        
        // Handle both Supabase UUID and numeric database ID
        let dbUserId = userId;
        if (userId.includes('-')) { // This is a Supabase UUID
            console.log('Converting Supabase UUID to database ID for case...');
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                console.log('User not found for Supabase ID:', userId);
                return res.status(404).json({ error: 'User not found' });
            }
            dbUserId = user[0].id;
            console.log('Converted to database ID:', dbUserId);
        } else {
            console.log('Using numeric user ID:', dbUserId);
        }
        
        // First check if the case belongs to this freelancer
        const caseData = await sql`
            SELECT c.*, u.name as client_name, u.email as client_email 
            FROM "case" c 
            JOIN "user" u ON c.client_id = u.id 
            WHERE c.id = ${caseId} AND c.freelancer_id = ${dbUserId}
        `;
        
        if (!caseData.length) {
            return res.status(404).json({ error: 'Case not found or access denied' });
        }
        
        res.json(caseData[0]);
    } catch (error) {
        console.error('Error in getFreelancerCaseById:', error);
        res.status(500).json({ error: 'Failed to get case' });
    }
}

export async function acceptCase(req, res) {
    const { caseId } = req.params;
    try {
        // Get case details first
        const caseData = await sql`
            SELECT c.*, u.name as client_name, u.email as client_email 
            FROM "case" c 
            JOIN "user" u ON c.client_id = u.id 
            WHERE c.id = ${caseId}
        `;
        
        if (!caseData.length) return res.status(404).json({ error: 'Case not found' });
        
        const caseItem = caseData[0];
        
        // Update case status
        const updated = await sql`UPDATE "case" SET status = 'active', accepted_at = NOW() WHERE id = ${caseId} RETURNING *`;
        if (!updated.length) return res.status(404).json({ error: 'Case not found' });
        
        // Create notification for the client
        await createNotification(
            caseItem.client_id,
            'case_accepted',
            'Case Accepted',
            `Your case "${caseItem.title}" has been accepted by the lawyer and is now active.`,
            { case_id: caseId, case_title: caseItem.title }
        );
        
        res.json(updated[0]);
    } catch (error) {
        console.error('Error accepting case:', error);
        res.status(500).json({ error: 'Failed to accept case' });
    }
}

export async function declineCase(req, res) {
    const { caseId } = req.params;
    try {
        const updated = await sql`UPDATE "case" SET status = 'declined', declined_at = NOW() WHERE id = ${caseId} RETURNING *`;
        if (!updated.length) return res.status(404).json({ error: 'Case not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error declining case:', error);
        res.status(500).json({ error: 'Failed to decline case' });
    }
}

export async function completeCase(req, res) {
    const { caseId } = req.params;
    const { userId } = req.body;
    
    try {
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        
        // Handle both Supabase UUID and numeric database ID
        let dbUserId = userId;
        if (userId.includes('-')) { // This is a Supabase UUID
            console.log('Converting Supabase UUID to database ID for complete case...');
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                console.log('User not found for Supabase ID:', userId);
                return res.status(404).json({ error: 'User not found' });
            }
            dbUserId = user[0].id;
            console.log('Converted to database ID:', dbUserId);
        } else {
            console.log('Using numeric user ID:', dbUserId);
        }
        
        // First, get the case details and verify freelancer access
        const caseData = await sql`
            SELECT c.*, f.user_id as freelancer_user_id, f.total_earnings 
            FROM "case" c 
            LEFT JOIN freelancer f ON c.freelancer_id = f.user_id 
            WHERE c.id = ${caseId} AND c.freelancer_id = ${dbUserId}
        `;
        
        if (!caseData.length) {
            return res.status(404).json({ error: 'Case not found or access denied' });
        }
        
        const caseItem = caseData[0];
        
        // Check if case has required documents for completion
        // Temporarily disabled for testing - uncomment the lines below to enforce document requirement
        /*
        if (!caseItem.annotated_document_url) {
            return res.status(400).json({ 
                error: 'Cannot complete case without annotated document',
                message: 'Please annotate and submit the document before marking case as complete'
            });
        }
        */
        
        // Calculate case payment (this would be based on case complexity, hours spent, etc.)
        // For now, using a fixed rate of $150 per case
        const casePayment = 15000; // $150.00 in cents
        
        // Update case status
        const updated = await sql`
            UPDATE "case" 
            SET status = 'completed', completed_at = NOW() 
            WHERE id = ${caseId} 
            RETURNING *
        `;
        
        if (!updated.length) {
            return res.status(500).json({ error: 'Failed to update case status' });
        }
        
        // Update freelancer earnings
        if (caseItem.freelancer_user_id) {
            await sql`
                UPDATE freelancer 
                SET total_earnings = total_earnings + ${casePayment},
                    updated_at = NOW()
                WHERE user_id = ${caseItem.freelancer_user_id}
            `;
        }
        
        // Create payment record for the completed case
        const metadata = JSON.stringify({
            case_id: caseId,
            case_title: caseItem.title
        });
        
        await sql`
            INSERT INTO payments (
                user_id, 
                amount, 
                currency, 
                payment_method, 
                status, 
                service_type, 
                description, 
                metadata
            ) VALUES (
                ${caseItem.freelancer_user_id}, 
                ${casePayment}, 
                'usd', 
                'case_completion', 
                'completed', 
                'case_payment', 
                ${`Payment for completed case: ${caseItem.title}`}, 
                ${metadata}
            )
        `;
        
        // Create notification for the client
        await createNotification(
            caseItem.client_id,
            'case_completed',
            'Case Completed',
            `Your case "${caseItem.title}" has been completed by the lawyer. You can now review the work and provide feedback.`,
            { case_id: caseId, case_title: caseItem.title }
        );
        
        res.json({
            ...updated[0],
            payment_amount: casePayment / 100, // Convert cents to dollars
            message: 'Case completed successfully. Payment of $150 has been added to your earnings.'
        });
        
    } catch (error) {
        console.error('Error completing case:', error);
        res.status(500).json({ error: 'Failed to complete case' });
    }
}

// --- DOCUMENT ANNOTATION ---
export async function annotateCaseDocument(req, res) {
    const { caseId } = req.params;
    const { annotatedDocumentUrl, notes, documentType = 'annotated' } = req.body;
    
    try {
        // Validate required fields
        if (!notes || !notes.trim()) {
            return res.status(400).json({ 
                error: 'Annotation notes are required',
                message: 'Please provide detailed legal analysis and recommendations'
            });
        }
        
        if (!annotatedDocumentUrl) {
            return res.status(400).json({ 
                error: 'Annotated document is required',
                message: 'Please upload your annotated version of the document'
            });
        }
        
        // Check if case exists and freelancer has access
        const caseData = await sql`
            SELECT c.*, f.user_id as freelancer_id 
            FROM "case" c 
            LEFT JOIN freelancer f ON c.freelancer_id = f.id 
            WHERE c.id = ${caseId}
        `;
        
        if (!caseData.length) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        const caseItem = caseData[0];
        
        // Check if case is assigned to a freelancer
        if (!caseItem.freelancer_id) {
            return res.status(403).json({ 
                error: 'Case not assigned',
                message: 'This case has not been assigned to a freelancer yet'
            });
        }
        
        // Check if case status allows annotation
        if (caseItem.status === 'completed') {
            return res.status(400).json({ 
                error: 'Case already completed',
                message: 'Cannot annotate a completed case'
            });
        }
        
        // Update case with annotation
        const updated = await sql`
            UPDATE "case" 
            SET 
                annotated_document_url = ${annotatedDocumentUrl},
                annotation_notes = ${notes},
                updated_at = NOW()
            WHERE id = ${caseId} 
            RETURNING *
        `;
        
        if (!updated.length) {
            return res.status(500).json({ error: 'Failed to update case annotation' });
        }
        
        res.json({
            ...updated[0],
            message: 'Document annotated successfully. You can now mark the case as complete to receive payment.',
            next_steps: [
                'Review your annotation notes',
                'Ensure the annotated document is properly formatted',
                'Mark the case as complete to trigger payment'
            ]
        });
        
    } catch (error) {
        console.error('Error annotating document:', error);
        res.status(500).json({ error: 'Failed to annotate document' });
    }
}

// --- SEARCH ---
export async function searchFreelancers(req, res) {
    const { name } = req.query;
    try {
        let freelancers;
        if (name) {
            // Search by name (case-insensitive, partial match)
            freelancers = await sql`
                SELECT * FROM freelancer 
                WHERE LOWER(name) LIKE LOWER(${`%${name}%`}) 
                ORDER BY created_at DESC
            `;
        } else {
            // If no name provided, return top 5 onboarded freelancers
            freelancers = await sql`
                SELECT * FROM freelancer 
                ORDER BY created_at DESC 
                LIMIT 5
            `;
        }

        if (freelancers.length === 0) {
            return res.status(200).json({
                message: "No onboarded lawyers found matching your search.",
                freelancers: []
            });
        }

        res.status(200).json({ freelancers });
    } catch (error) {
        console.error('Error searching freelancers:', error);
        res.status(500).json({ error: 'Failed to search freelancers' });
    }
}

// --- PAYMENTS ---
export async function requestWithdrawal(req, res) {
    const { userId } = req.params;
    const { amount, method } = req.body;
    try {
        // Handle both Supabase UUID and numeric database ID
        let dbUserId = userId;
        if (userId.includes('-')) { // This is a Supabase UUID
            console.log('Converting Supabase UUID to database ID for withdrawal...');
            const user = await sql`
                SELECT id FROM "user" WHERE supabase_id = ${userId}
            `;
            if (user.length === 0) {
                console.log('User not found for Supabase ID:', userId);
                return res.status(404).json({ error: 'User not found' });
            }
            dbUserId = user[0].id;
            console.log('Converted to database ID:', dbUserId);
        } else {
            console.log('Using numeric user ID:', dbUserId);
        }
        
        // Placeholder: Insert withdrawal request
        const withdrawal = await sql`INSERT INTO withdrawal (freelancer_id, amount, method, status, requested_at) VALUES (${dbUserId}, ${amount}, ${method}, 'pending', NOW()) RETURNING *`;
        res.status(201).json(withdrawal[0]);
    } catch (error) {
        console.error('Error requesting withdrawal:', error);
        res.status(500).json({ error: 'Failed to request withdrawal' });
    }
}

// --- CONSULTATION MANAGEMENT ---
export async function listFreelancerConsultations(req, res) {
    const { userId } = req.params;
    try {
        const consultations = await sql`
            SELECT 
                c.*,
                u.name as client_name,
                u.email as client_email,
                u.phone as client_phone
            FROM consultation c
            JOIN "user" u ON c.client_id = u.id
            WHERE c.freelancer_id = ${userId}
            ORDER BY c.created_at DESC
        `;
        res.json(consultations);
    } catch (error) {
        console.error('Error listing consultations:', error);
        res.status(500).json({ error: 'Failed to list consultations' });
    }
}

export async function getConsultationById(req, res) {
    const { consultationId } = req.params;
    try {
        const consultation = await sql`
            SELECT 
                c.*,
                u.name as client_name,
                u.email as client_email,
                u.phone as client_phone
            FROM consultation c
            JOIN "user" u ON c.client_id = u.id
            WHERE c.id = ${consultationId}
        `;
        if (!consultation.length) return res.status(404).json({ error: 'Consultation not found' });
        res.json(consultation[0]);
    } catch (error) {
        console.error('Error getting consultation:', error);
        res.status(500).json({ error: 'Failed to get consultation' });
    }
}

export async function confirmConsultation(req, res) {
    const { consultationId } = req.params;
    try {
        const updated = await sql`
            UPDATE consultation 
            SET status = 'confirmed', confirmed_at = NOW() 
            WHERE id = ${consultationId} 
            RETURNING *
        `;
        if (!updated.length) return res.status(404).json({ error: 'Consultation not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error confirming consultation:', error);
        res.status(500).json({ error: 'Failed to confirm consultation' });
    }
}

export async function completeConsultation(req, res) {
    const { consultationId } = req.params;
    try {
        const updated = await sql`
            UPDATE consultation 
            SET status = 'completed', completed_at = NOW() 
            WHERE id = ${consultationId} 
            RETURNING *
        `;
        if (!updated.length) return res.status(404).json({ error: 'Consultation not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error completing consultation:', error);
        res.status(500).json({ error: 'Failed to complete consultation' });
    }
}

export async function cancelConsultation(req, res) {
    const { consultationId } = req.params;
    const { reason } = req.body;
    try {
        const updated = await sql`
            UPDATE consultation 
            SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = ${reason} 
            WHERE id = ${consultationId} 
            RETURNING *
        `;
        if (!updated.length) return res.status(404).json({ error: 'Consultation not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error cancelling consultation:', error);
        res.status(500).json({ error: 'Failed to cancel consultation' });
    }
}

export async function updateConsultationNotes(req, res) {
    const { consultationId } = req.params;
    const { notes } = req.body;
    try {
        const updated = await sql`
            UPDATE consultation 
            SET notes = ${notes}, updated_at = NOW() 
            WHERE id = ${consultationId} 
            RETURNING *
        `;
        if (!updated.length) return res.status(404).json({ error: 'Consultation not found' });
        res.json(updated[0]);
    } catch (error) {
        console.error('Error updating consultation notes:', error);
        res.status(500).json({ error: 'Failed to update consultation notes' });
    }
}