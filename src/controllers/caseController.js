import { sql } from "../config/db.js";
import { uploadCaseDocument, validateDocumentFile } from "../utils/fileUpload.js";

export async function registerCase(req, res) {
    const { 
        clientId, 
        title, 
        description, 
        expertiseArea, 
        priority, 
        freelancerId,
        jurisdiction,
        caseType,
        clientNotes
    } = req.body;
    try {
        if (!clientId || !title || !description) {
            return res.status(400).json({ error: 'Missing required fields: clientId, title, description' });
        }

        let assignedFreelancerId = null;
        let assignedAt = null;
        let caseSummaryUrl = null;

        // Handle file upload if present
        if (req.file) {
            const validation = validateDocumentFile(req.file);
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error });
            }
        }

        // Get the actual user ID from the database if clientId is a UUID
        let actualClientId = clientId;
        if (clientId.includes('-')) {
            // UUID format - get the local user ID
            const user = await sql`SELECT id FROM "user" WHERE supabase_id = ${clientId}`;
            if (user.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            actualClientId = user[0].id;
        }

        // If specific freelancer is requested, validate and assign
        if (freelancerId) {
            const freelancer = await sql`
                SELECT * FROM freelancer WHERE user_id = ${freelancerId} AND is_available = true
            `;
            if (freelancer.length > 0) {
                assignedFreelancerId = freelancerId;
                assignedAt = 'NOW()';
            } else {
                return res.status(400).json({ error: 'Requested lawyer is not available or does not exist' });
            }
        } else {
            // Auto-assign available freelancer with matching expertise
            let freelancer = null;
            if (expertiseArea) {
                const candidates = await sql`
                    SELECT * FROM freelancer 
                    WHERE is_available = true 
                    AND ${expertiseArea} = ANY(expertise_areas) 
                    ORDER BY performance_score DESC, total_earnings ASC 
                    LIMIT 1
                `;
                if (candidates.length > 0) {
                    freelancer = candidates[0];
                }
            }
            
            // If no match, assign to any available freelancer
            if (!freelancer) {
                const anyAvailable = await sql`
                    SELECT * FROM freelancer 
                    WHERE is_available = true 
                    ORDER BY performance_score DESC, total_earnings ASC 
                    LIMIT 1
                `;
                if (anyAvailable.length > 0) {
                    freelancer = anyAvailable[0];
                }
            }
            
            if (freelancer) {
                assignedFreelancerId = freelancer.user_id;
                assignedAt = 'NOW()';
            }
        }

        // Create case first to get the case ID
        const newCase = await sql`
            INSERT INTO "case" (
                client_id, 
                freelancer_id, 
                title, 
                description, 
                case_summary_url, 
                expertise_area,
                priority,
                status, 
                assigned_at, 
                created_at, 
                updated_at,
                jurisdiction,
                case_type,
                client_notes,
                time_remaining
            )
            VALUES (
                ${actualClientId}, 
                ${assignedFreelancerId}, 
                ${title}, 
                ${description}, 
                ${caseSummaryUrl}, 
                ${expertiseArea || null},
                ${priority || 'medium'},
                'pending', 
                ${assignedAt ? sql`NOW()` : null}, 
                NOW(), 
                NOW(),
                ${jurisdiction || null},
                ${caseType || null},
                ${clientNotes || null},
                86400
            )
            RETURNING *
        `;

        // Upload file to Cloudinary if present
        if (req.file) {
            const uploadResult = await uploadCaseDocument(req.file, newCase[0].id, 'summary');
            if (uploadResult.success) {
                // Update case with the uploaded file URL
                await sql`
                    UPDATE "case" 
                    SET case_summary_url = ${uploadResult.url}, 
                        updated_at = NOW() 
                    WHERE id = ${newCase[0].id}
                `;
                caseSummaryUrl = uploadResult.url;
            } else {
                console.error('File upload failed:', uploadResult.error);
                // Continue without file upload, but log the error
            }
        }
        
        res.status(201).json({
            success: true,
            case: { ...newCase[0], case_summary_url: caseSummaryUrl },
            message: assignedFreelancerId ? 'Case assigned to lawyer' : 'Case created, waiting for lawyer assignment'
        });
    } catch (error) {
        console.error('Error registering case:', error);
        res.status(500).json({ error: 'Failed to register case' });
    }
}

export async function getClientCases(req, res) {
    const { clientId } = req.params;
    try {
        // Handle UUID format
        let actualClientId = clientId;
        if (clientId.includes('-')) {
            // UUID format - get the local user ID
            const user = await sql`SELECT id FROM "user" WHERE supabase_id = ${clientId}`;
            if (user.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            actualClientId = user[0].id;
        }

        const cases = await sql`
            SELECT 
                c.*,
                u.name as client_name,
                u.email as client_email,
                f.name as freelancer_name,
                f.email as freelancer_email
            FROM "case" c
            LEFT JOIN "user" u ON c.client_id = u.id
            LEFT JOIN freelancer f ON c.freelancer_id = f.user_id
            WHERE c.client_id = ${actualClientId} 
            ORDER BY c.created_at DESC
        `;
        res.json(cases);
    } catch (error) {
        console.error('Error fetching client cases:', error);
        res.status(500).json({ error: 'Failed to fetch client cases' });
    }
}

export async function getFreelancerCases(req, res) {
    const { freelancerId } = req.params;
    const { status } = req.query;
    
    try {
        // Handle UUID format
        let actualFreelancerId = freelancerId;
        if (freelancerId.includes('-')) {
            // UUID format - get the local user ID
            const user = await sql`SELECT id FROM "user" WHERE supabase_id = ${freelancerId}`;
            if (user.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            actualFreelancerId = user[0].id;
        }

        let query = sql`
            SELECT 
                c.*,
                u.name as client_name,
                u.email as client_email
            FROM "case" c
            LEFT JOIN "user" u ON c.client_id = u.id
            WHERE c.freelancer_id = ${actualFreelancerId}
        `;
        
        if (status && status !== 'all') {
            query = sql`${query} AND c.status = ${status}`;
        }
        
        query = sql`${query} ORDER BY c.created_at DESC`;
        
        const cases = await query;
        res.json(cases);
    } catch (error) {
        console.error('Error fetching freelancer cases:', error);
        res.status(500).json({ error: 'Failed to fetch freelancer cases' });
    }
}

export async function getCaseById(req, res) {
    const { caseId } = req.params;
    try {
        const cases = await sql`
            SELECT 
                c.*,
                u.name as client_name,
                u.email as client_email,
                f.name as freelancer_name,
                f.email as freelancer_email
            FROM "case" c
            LEFT JOIN "user" u ON c.client_id = u.id
            LEFT JOIN freelancer f ON c.freelancer_id = f.user_id
            WHERE c.id = ${caseId}
        `;
        
        if (cases.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        res.json(cases[0]);
    } catch (error) {
        console.error('Error fetching case:', error);
        res.status(500).json({ error: 'Failed to fetch case' });
    }
}

export async function assignCaseToFreelancer(req, res) {
    const { caseId } = req.params;
    const { freelancerId } = req.body;
    try {
        if (!freelancerId) return res.status(400).json({ error: 'Missing freelancerId' });
        
        // Check if freelancer exists and is available
        const freelancer = await sql`
            SELECT * FROM freelancer WHERE user_id = ${freelancerId} AND is_available = true
        `;
        
        if (freelancer.length === 0) {
            return res.status(400).json({ error: 'Freelancer not found or not available' });
        }
        
        const updated = await sql`
            UPDATE "case" 
            SET freelancer_id = ${freelancerId}, 
                assigned_at = NOW(), 
                updated_at = NOW() 
            WHERE id = ${caseId} 
            RETURNING *
        `;
        
        if (!updated.length) return res.status(404).json({ error: 'Case not found' });
        
        res.json({
            success: true,
            case: updated[0],
            message: 'Case assigned successfully'
        });
    } catch (error) {
        console.error('Error assigning case:', error);
        res.status(500).json({ error: 'Failed to assign case' });
    }
}

export async function updateCaseStatus(req, res) {
    const { caseId } = req.params;
    const { status, notes, estimated_completion, case_value, hours_spent } = req.body;
    
    try {
        if (!status || !['pending', 'active', 'completed', 'declined'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        // Start with basic update
        let updateQuery = sql`
            UPDATE "case" 
            SET status = ${status}, 
                updated_at = NOW(),
                annotation_notes = ${notes || null}
        `;
        
        // Add estimated completion if provided
        if (estimated_completion) {
            updateQuery = sql`${updateQuery}, estimated_completion = ${estimated_completion}`;
        }
        
        // Add case value if provided
        if (case_value !== undefined) {
            updateQuery = sql`${updateQuery}, case_value = ${case_value}`;
        }
        
        // Add hours spent if provided
        if (hours_spent !== undefined) {
            updateQuery = sql`${updateQuery}, hours_spent = ${hours_spent}`;
        }
        
        // Add appropriate timestamp based on status
        switch (status) {
            case 'active':
                updateQuery = sql`${updateQuery}, accepted_at = NOW()`;
                break;
            case 'completed':
                updateQuery = sql`${updateQuery}, completed_at = NOW()`;
                break;
            case 'declined':
                updateQuery = sql`${updateQuery}, declined_at = NOW()`;
                break;
        }
        
        // Complete the query
        updateQuery = sql`${updateQuery} WHERE id = ${caseId} RETURNING *`;
        
        const updated = await updateQuery;
        
        if (!updated.length) return res.status(404).json({ error: 'Case not found' });
        
        res.json({
            success: true,
            case: updated[0],
            message: `Case status updated to ${status}`
        });
    } catch (error) {
        console.error('Error updating case status:', error);
        res.status(500).json({ error: 'Failed to update case status' });
    }
}

export async function updateCaseDocument(req, res) {
    const { caseId } = req.params;
    const { documentUrl, documentType } = req.body;
    
    try {
        if (!documentUrl || !documentType) {
            return res.status(400).json({ error: 'Missing documentUrl or documentType' });
        }
        
        let updateField = '';
        switch (documentType) {
            case 'summary':
                updateField = 'case_summary_url';
                break;
            case 'annotated':
                updateField = 'annotated_document_url';
                break;
            default:
                return res.status(400).json({ error: 'Invalid document type' });
        }
        
        const updated = await sql`
            UPDATE "case" 
            SET ${sql(updateField)} = ${documentUrl}, 
                updated_at = NOW() 
            WHERE id = ${caseId} 
            RETURNING *
        `;
        
        if (!updated.length) return res.status(404).json({ error: 'Case not found' });
        
        res.json({
            success: true,
            case: updated[0],
            message: 'Document updated successfully'
        });
    } catch (error) {
        console.error('Error updating case document:', error);
        res.status(500).json({ error: 'Failed to update case document' });
    }
}

export async function getAvailableFreelancers(req, res) {
    const { expertiseArea } = req.query;
    
    try {
        let query = sql`
            SELECT 
                f.user_id,
                f.name,
                f.email,
                f.expertise_areas,
                f.performance_score,
                f.total_earnings,
                f.is_available
            FROM freelancer f
            WHERE f.is_available = true
        `;
        
        if (expertiseArea) {
            query = sql`${query} AND ${expertiseArea} = ANY(f.expertise_areas)`;
        }
        
        query = sql`${query} ORDER BY f.performance_score DESC, f.total_earnings ASC`;
        
        const freelancers = await query;
        res.json(freelancers);
    } catch (error) {
        console.error('Error fetching available freelancers:', error);
        res.status(500).json({ error: 'Failed to fetch available freelancers' });
    }
}

export async function getCaseStats(req, res) {
    const { userId, userType } = req.params;
    
    try {
        // Handle UUID format
        let actualUserId = userId;
        if (userId.includes('-')) {
            // UUID format - get the local user ID
            const user = await sql`SELECT id FROM "user" WHERE supabase_id = ${userId}`;
            if (user.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            actualUserId = user[0].id;
        }

        let statsQuery;
        
        if (userType === 'client') {
            statsQuery = sql`
                SELECT 
                    COUNT(*) as total_cases,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_cases,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_cases,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_cases,
                    SUM(case_value) as total_value
                FROM "case" 
                WHERE client_id = ${actualUserId}
            `;
        } else if (userType === 'freelancer') {
            statsQuery = sql`
                SELECT 
                    COUNT(*) as total_cases,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_cases,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_cases,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_cases,
                SUM(case_value) as total_earnings,
                SUM(hours_spent) as total_hours
            FROM "case" 
            WHERE freelancer_id = ${actualUserId}
        `;
        } else {
            return res.status(400).json({ error: 'Invalid user type' });
        }
        
        const stats = await statsQuery;
        res.json(stats[0]);
    } catch (error) {
        console.error('Error fetching case stats:', error);
        res.status(500).json({ error: 'Failed to fetch case stats' });
    }
} 