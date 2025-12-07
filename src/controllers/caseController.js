import { sql } from "../config/db.js";
import { uploadCaseDocument, validateDocumentFile } from "../utils/fileUpload.js";
import { createNotification } from "./notificationController.js";
import { sendCaseAssignedEmail, sendCaseAcceptedEmail, sendCaseDeclinedEmail } from "../utils/emailService.js";
import logger from "../utils/logger.js";

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
        let assignedFreelancer = null;
        if (freelancerId) {
            const freelancer = await sql`
                SELECT f.*, u.supabase_id, u.name, u.email 
                FROM freelancer f
                JOIN "user" u ON f.user_id = u.id
                WHERE f.user_id = ${freelancerId} AND f.is_available = true
            `;
            if (freelancer.length > 0) {
                assignedFreelancerId = freelancerId;
                assignedAt = 'NOW()';
                assignedFreelancer = freelancer[0];
            } else {
                return res.status(400).json({ error: 'Requested lawyer is not available or does not exist' });
            }
        }
        // Note: Removed auto-assignment - cases will remain unassigned until manually assigned
        // This allows both lawyers and barristers to see and accept available cases

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

        // Send notifications to available freelancers
        try {
            // Get all available freelancers who match the expertise area (if specified)
            let availableFreelancers;
            if (expertiseArea) {
                availableFreelancers = await sql`
                    SELECT f.*, u.supabase_id as user_supabase_id
                    FROM freelancer f
                    JOIN "user" u ON f.user_id = u.id
                    WHERE f.is_available = true 
                    AND f.is_verified = true
                    AND ${expertiseArea} = ANY(f.expertise_areas)
                `;
            } else {
                availableFreelancers = await sql`
                    SELECT f.*, u.supabase_id as user_supabase_id
                    FROM freelancer f
                    JOIN "user" u ON f.user_id = u.id
                    WHERE f.is_available = true 
                    AND f.is_verified = true
                `;
            }

            // Send notification to each available freelancer
            for (const freelancer of availableFreelancers) {
                try {
                    await createNotification(
                        freelancer.user_supabase_id, // Use Supabase ID for notification
                        'case_assigned',
                        'New Case Available',
                        `A new case "${title}" has been submitted and is available for assignment. ${expertiseArea ? `Expertise area: ${expertiseArea}` : ''} Priority: ${priority || 'medium'}`,
                        {
                            case_id: newCase[0].id,
                            case_title: title,
                            expertise_area: expertiseArea,
                            priority: priority || 'medium',
                            jurisdiction: jurisdiction,
                            case_type: caseType,
                            client_notes: clientNotes
                        }
                    );
                    console.log(`Notification sent to freelancer ${freelancer.name} (ID: ${freelancer.id})`);
                } catch (notificationError) {
                    console.error(`Failed to send notification to freelancer ${freelancer.name}:`, notificationError);
                    // Continue with other freelancers even if one fails
                }
            }

            console.log(`Sent notifications to ${availableFreelancers.length} available freelancers for case ${newCase[0].id}`);
        } catch (notificationError) {
            console.error('Error sending notifications to freelancers:', notificationError);
            // Don't fail the case creation if notifications fail
        }

        // Send notifications to available barristers
        try {
            // Get all approved barristers who match the expertise area (if specified)
            let availableBarristers;
            if (expertiseArea) {
                availableBarristers = await sql`
                    SELECT b.*, u.supabase_id as user_supabase_id, bp.areas_of_practice
                    FROM barrister b
                    JOIN "user" u ON b.user_id = u.id
                    LEFT JOIN barrister_profiles bp ON b.user_id = bp.user_id
                    WHERE b.status = 'APPROVED'
                    AND (
                        ${expertiseArea} = ANY(COALESCE(bp.areas_of_practice, ARRAY[]::TEXT[]))
                        OR bp.areas_of_practice IS NULL
                    )
                `;
            } else {
                availableBarristers = await sql`
                    SELECT b.*, u.supabase_id as user_supabase_id
                    FROM barrister b
                    JOIN "user" u ON b.user_id = u.id
                    WHERE b.status = 'APPROVED'
                `;
            }

            // Send notification to each available barrister
            for (const barrister of availableBarristers) {
                try {
                    await createNotification(
                        barrister.user_supabase_id,
                        'case_available',
                        'New Case Available',
                        `A new case "${title}" has been submitted and is available for assignment. ${expertiseArea ? `Expertise area: ${expertiseArea}` : ''} Priority: ${priority || 'medium'}`,
                        {
                            case_id: newCase[0].id,
                            case_title: title,
                            expertise_area: expertiseArea,
                            priority: priority || 'medium',
                            jurisdiction: jurisdiction,
                            case_type: caseType,
                            client_notes: clientNotes
                        }
                    );
                    console.log(`Notification sent to barrister ${barrister.name} (ID: ${barrister.id})`);
                } catch (notificationError) {
                    console.error(`Failed to send notification to barrister ${barrister.name}:`, notificationError);
                    // Continue with other barristers even if one fails
                }
            }

            console.log(`Sent notifications to ${availableBarristers.length} available barristers for case ${newCase[0].id}`);
        } catch (notificationError) {
            console.error('Error sending notifications to barristers:', notificationError);
            // Don't fail the case creation if notifications fail
        }
        
        // If case was directly assigned to a freelancer, send notifications
        if (assignedFreelancer && assignedFreelancerId) {
            try {
                // Send app notification
                await createNotification(
                    assignedFreelancer.supabase_id,
                    'case_assigned',
                    'Case Assigned',
                    `You have been assigned to case "${title}"`,
                    {
                        case_id: newCase[0].id,
                        case_title: title,
                        expertise_area: expertiseArea,
                        priority: priority || 'medium',
                        jurisdiction: jurisdiction,
                        assignee_type: 'lawyer'
                    }
                );
                
                // Send email notification
                if (assignedFreelancer.email) {
                    await sendCaseAssignedEmail(
                        assignedFreelancer.email,
                        assignedFreelancer.name || 'Lawyer',
                        title,
                        {
                            expertiseArea: expertiseArea,
                            priority: priority || 'medium',
                            jurisdiction: jurisdiction
                        }
                    );
                    logger.log('Case assigned email sent to freelancer:', { 
                        email: assignedFreelancer.email, 
                        caseId: newCase[0].id 
                    });
                }
            } catch (notificationError) {
                logger.error('Error sending notifications to assigned freelancer:', notificationError);
                // Don't fail the case creation if notifications fail
            }
        }
        
        res.status(201).json({
            success: true,
            case: { ...newCase[0], case_summary_url: caseSummaryUrl },
            message: assignedFreelancerId ? 'Case assigned to lawyer' : 'Case created, available for assignment to lawyers or barristers'
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
                f.email as freelancer_email,
                b.name as barrister_name,
                b.email as barrister_email
            FROM "case" c
            LEFT JOIN "user" u ON c.client_id = u.id
            LEFT JOIN freelancer f ON c.freelancer_id = f.user_id
            LEFT JOIN barrister b ON c.barrister_id = b.user_id
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
                u.email as client_email,
                CASE 
                    WHEN c.assigned_at IS NULL THEN 'direct'
                    WHEN c.assigned_at::date = c.created_at::date AND 
                         EXTRACT(EPOCH FROM (c.assigned_at - c.created_at)) < 60 THEN 'direct'
                    ELSE 'assigned'
                END as case_source
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

export async function getBarristerCases(req, res) {
    const { barristerId } = req.params;
    const { status } = req.query;
    
    try {
        // Handle UUID format
        let actualBarristerId = barristerId;
        if (barristerId.includes('-')) {
            // UUID format - get the local user ID
            const user = await sql`SELECT id FROM "user" WHERE supabase_id = ${barristerId}`;
            if (user.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            actualBarristerId = user[0].id;
        }

        let query = sql`
            SELECT 
                c.*,
                u.name as client_name,
                u.email as client_email,
                CASE 
                    WHEN c.assigned_at IS NULL THEN 'direct'
                    WHEN c.assigned_at::date = c.created_at::date AND 
                         EXTRACT(EPOCH FROM (c.assigned_at - c.created_at)) < 60 THEN 'direct'
                    ELSE 'assigned'
                END as case_source
            FROM "case" c
            LEFT JOIN "user" u ON c.client_id = u.id
            WHERE c.barrister_id = ${actualBarristerId}
        `;
        
        if (status && status !== 'all') {
            query = sql`${query} AND c.status = ${status}`;
        }
        
        query = sql`${query} ORDER BY c.created_at DESC`;
        
        const cases = await query;
        res.json(cases);
    } catch (error) {
        console.error('Error fetching barrister cases:', error);
        res.status(500).json({ error: 'Failed to fetch barrister cases' });
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
            LEFT JOIN freelancer f ON c.freelancer_id = f.id
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

export async function getCaseByIdForUser(req, res) {
    const { caseId, userId } = req.params;
    try {
        // First check if the user has access to this case (either as client or freelancer)
        const caseAccess = await sql`
            SELECT 
                c.*,
                u.name as client_name,
                u.email as client_email,
                f.name as freelancer_name,
                f.email as freelancer_email
            FROM "case" c
            LEFT JOIN "user" u ON c.client_id = u.id
            LEFT JOIN freelancer f ON c.freelancer_id = f.id
            WHERE c.id = ${caseId} AND (c.client_id = ${userId} OR c.freelancer_id = ${userId})
        `;
        
        if (caseAccess.length === 0) {
            return res.status(404).json({ error: 'Case not found or access denied' });
        }
        
        res.json(caseAccess[0]);
    } catch (error) {
        console.error('Error fetching case for user:', error);
        res.status(500).json({ error: 'Failed to fetch case' });
    }
}

export async function assignCaseToFreelancer(req, res) {
    const { caseId } = req.params;
    const { freelancerId, barristerId, assigneeType } = req.body;
    try {
        // Validate that either freelancerId or barristerId is provided
        if (!freelancerId && !barristerId) {
            return res.status(400).json({ error: 'Missing freelancerId or barristerId' });
        }
        
        if (freelancerId && barristerId) {
            return res.status(400).json({ error: 'Cannot assign to both freelancer and barrister' });
        }

        // Get the case first to check if it exists
        const caseRecord = await sql`SELECT * FROM "case" WHERE id = ${caseId}`;
        if (caseRecord.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        let assignedUserId = null;
        let assignedName = null;
        let assignedEmail = null;
        let notificationMessage = '';

        if (freelancerId) {
            // Check if freelancer exists and is available
            const freelancer = await sql`
                SELECT f.*, u.supabase_id, u.name, u.email 
                FROM freelancer f
                JOIN "user" u ON f.user_id = u.id
                WHERE f.user_id = ${freelancerId} AND f.is_available = true
            `;
            
            if (freelancer.length === 0) {
                return res.status(400).json({ error: 'Freelancer not found or not available' });
            }

            assignedUserId = freelancer[0].supabase_id;
            assignedName = freelancer[0].name;
            assignedEmail = freelancer[0].email;
            notificationMessage = `You have been assigned to case "${caseRecord[0].title}"`;

            // Update case with freelancer assignment
            const updated = await sql`
                UPDATE "case" 
                SET freelancer_id = ${freelancerId}, 
                    barrister_id = NULL,
                    assigned_at = NOW(), 
                    updated_at = NOW() 
                WHERE id = ${caseId} 
                RETURNING *
            `;
            
            // Send app notification to freelancer
            try {
                await createNotification(
                    assignedUserId,
                    'case_assigned',
                    'Case Assigned',
                    notificationMessage,
                    {
                        case_id: parseInt(caseId),
                        case_title: caseRecord[0].title,
                        assignee_type: 'lawyer'
                    }
                );
            } catch (notificationError) {
                logger.error('Error sending app notification:', notificationError);
                // Don't fail the assignment if notification fails
            }
            
            // Send email notification to freelancer
            if (assignedEmail) {
                try {
                    await sendCaseAssignedEmail(
                        assignedEmail,
                        assignedName || 'Lawyer',
                        caseRecord[0].title,
                        {
                            expertiseArea: caseRecord[0].expertise_area,
                            priority: caseRecord[0].priority,
                            jurisdiction: caseRecord[0].jurisdiction
                        }
                    );
                    logger.log('Case assigned email sent to freelancer:', { 
                        email: assignedEmail, 
                        caseId 
                    });
                } catch (emailError) {
                    logger.error('Error sending case assigned email:', emailError);
                    // Don't fail the assignment if email fails
                }
            }

            return res.json({
                success: true,
                case: updated[0],
                message: 'Case assigned to lawyer successfully'
            });
        } else if (barristerId) {
            // Check if barrister exists and is approved
            const barrister = await sql`
                SELECT b.*, u.supabase_id, u.name, u.email 
                FROM barrister b
                JOIN "user" u ON b.user_id = u.id
                WHERE b.user_id = ${barristerId} AND b.status = 'APPROVED'
            `;
            
            if (barrister.length === 0) {
                return res.status(400).json({ error: 'Barrister not found or not approved' });
            }

            assignedUserId = barrister[0].supabase_id;
            assignedName = barrister[0].name;
            assignedEmail = barrister[0].email;
            notificationMessage = `You have been assigned to case "${caseRecord[0].title}"`;

            // Update case with barrister assignment
            const updated = await sql`
                UPDATE "case" 
                SET barrister_id = ${barristerId}, 
                    freelancer_id = NULL,
                    assigned_at = NOW(), 
                    updated_at = NOW() 
                WHERE id = ${caseId} 
                RETURNING *
            `;
            
            // Send app notification to barrister
            try {
                await createNotification(
                    assignedUserId,
                    'case_assigned',
                    'Case Assigned',
                    notificationMessage,
                    {
                        case_id: parseInt(caseId),
                        case_title: caseRecord[0].title,
                        assignee_type: 'barrister'
                    }
                );
            } catch (notificationError) {
                logger.error('Error sending app notification to barrister:', notificationError);
                // Don't fail the assignment if notification fails
            }
            
            // Send email notification to barrister
            if (assignedEmail) {
                try {
                    await sendCaseAssignedEmail(
                        assignedEmail,
                        assignedName || 'Barrister',
                        caseRecord[0].title,
                        {
                            expertiseArea: caseRecord[0].expertise_area,
                            priority: caseRecord[0].priority,
                            jurisdiction: caseRecord[0].jurisdiction
                        }
                    );
                    logger.log('Case assigned email sent to barrister:', { 
                        email: assignedEmail, 
                        caseId 
                    });
                } catch (emailError) {
                    logger.error('Error sending case assigned email to barrister:', emailError);
                    // Don't fail the assignment if email fails
                }
            }

            return res.json({
                success: true,
                case: updated[0],
                message: 'Case assigned to barrister successfully'
            });
        }
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
        
        // Get case details first to get client information for notifications
        const caseData = await sql`
            SELECT c.*, u.name as client_name, u.email as client_email, u.supabase_id as client_supabase_id
            FROM "case" c 
            JOIN "user" u ON c.client_id = u.id 
            WHERE c.id = ${caseId}
        `;
        
        if (!caseData.length) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        const caseItem = caseData[0];
        const oldStatus = caseItem.status;
        
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
        
        // Send notifications if status changed to 'active' (accepted) or 'declined'
        if ((status === 'active' && oldStatus !== 'active') || (status === 'declined' && oldStatus !== 'declined')) {
            try {
                // Send app notification to client
                const notificationUserId = caseItem.client_supabase_id || caseItem.client_id;
                if (status === 'active') {
                    await createNotification(
                        notificationUserId,
                        'case_accepted',
                        'Case Accepted',
                        `Your case "${caseItem.title}" has been accepted by the lawyer and is now active.`,
                        { case_id: parseInt(caseId), case_title: caseItem.title }
                    );
                } else if (status === 'declined') {
                    await createNotification(
                        notificationUserId,
                        'case_declined',
                        'Case Declined',
                        `Your case "${caseItem.title}" has been declined by the lawyer.`,
                        { case_id: parseInt(caseId), case_title: caseItem.title }
                    );
                }
            } catch (notificationError) {
                logger.error('Error creating notification for case status update:', notificationError);
                // Continue even if notification fails
            }
            
            // Send email notification to client
            if (caseItem.client_email) {
                try {
                    if (status === 'active') {
                        await sendCaseAcceptedEmail(
                            caseItem.client_email,
                            caseItem.client_name || 'Client',
                            caseItem.title
                        );
                        logger.log('Case accepted email sent to client:', { email: caseItem.client_email, caseId });
                    } else if (status === 'declined') {
                        await sendCaseDeclinedEmail(
                            caseItem.client_email,
                            caseItem.client_name || 'Client',
                            caseItem.title
                        );
                        logger.log('Case declined email sent to client:', { email: caseItem.client_email, caseId });
                    }
                } catch (emailError) {
                    logger.error('Error sending case status email:', emailError);
                    // Continue even if email fails
                }
            }
        }
        
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

export async function getAvailableBarristers(req, res) {
    const { expertiseArea } = req.query;
    
    try {
        let query = sql`
            SELECT 
                b.user_id,
                b.name,
                b.email,
                b.status,
                bp.areas_of_practice,
                bp.hourly_rate
            FROM barrister b
            LEFT JOIN barrister_profiles bp ON b.user_id = bp.user_id
            WHERE b.status = 'APPROVED'
        `;
        
        if (expertiseArea) {
            query = sql`${query} AND ${expertiseArea} = ANY(COALESCE(bp.areas_of_practice, ARRAY[]::TEXT[]))`;
        }
        
        query = sql`${query} ORDER BY b.name ASC`;
        
        const barristers = await query;
        res.json(barristers);
    } catch (error) {
        console.error('Error fetching available barristers:', error);
        res.status(500).json({ error: 'Failed to fetch available barristers' });
    }
}

export async function getAvailableCases(req, res) {
    const { expertiseArea, status } = req.query;
    
    try {
        // Get cases that are not assigned to anyone (no freelancer_id and no barrister_id)
        let query = sql`
            SELECT 
                c.*,
                u.name as client_name,
                u.email as client_email
            FROM "case" c
            LEFT JOIN "user" u ON c.client_id = u.id
            WHERE c.freelancer_id IS NULL 
            AND c.barrister_id IS NULL
            AND c.status = COALESCE(${status || 'pending'}, 'pending')
        `;
        
        if (expertiseArea) {
            query = sql`${query} AND c.expertise_area = ${expertiseArea}`;
        }
        
        query = sql`${query} ORDER BY c.created_at DESC`;
        
        const cases = await query;
        res.json(cases);
    } catch (error) {
        console.error('Error fetching available cases:', error);
        res.status(500).json({ error: 'Failed to fetch available cases' });
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

// ==================== CASE REFERRALS ====================

/**
 * Refer a case from a barrister to a lawyer
 * POST /api/cases/refer
 */
export async function referCase(req, res) {
    const { caseId, barristerId, lawyerId, referralNotes } = req.body;
    
    try {
        if (!caseId || !barristerId || !lawyerId) {
            return res.status(400).json({ error: 'Missing required fields: caseId, barristerId, lawyerId' });
        }

        // Resolve barrister ID (handle UUID)
        let actualBarristerId = barristerId;
        if (barristerId.includes('-')) {
            const user = await sql`SELECT id FROM "user" WHERE supabase_id = ${barristerId}`;
            if (user.length === 0) {
                return res.status(404).json({ error: 'Barrister not found' });
            }
            actualBarristerId = user[0].id;
        }

        // Verify case exists and belongs to barrister (or check if barrister has access)
        const caseRecord = await sql`
            SELECT c.*, u.name as client_name
            FROM "case" c
            LEFT JOIN "user" u ON c.client_id = u.id
            WHERE c.id = ${caseId}
        `;
        
        if (caseRecord.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }

        // Verify lawyer exists and is available
        const lawyer = await sql`
            SELECT f.*, u.supabase_id as user_supabase_id
            FROM freelancer f
            JOIN "user" u ON f.user_id = u.id
            WHERE f.user_id = ${lawyerId} AND f.is_available = true
        `;
        
        if (lawyer.length === 0) {
            return res.status(404).json({ error: 'Lawyer not found or not available' });
        }

        // Check if referral already exists
        const existingReferral = await sql`
            SELECT * FROM case_referrals
            WHERE case_id = ${caseId} AND lawyer_id = ${lawyerId} AND status = 'pending'
        `;
        
        if (existingReferral.length > 0) {
            return res.status(400).json({ error: 'A pending referral already exists for this case and lawyer' });
        }

        // Create referral
        const referral = await sql`
            INSERT INTO case_referrals (
                case_id,
                barrister_id,
                lawyer_id,
                referral_notes,
                status,
                created_at,
                updated_at
            )
            VALUES (
                ${caseId},
                ${actualBarristerId},
                ${lawyerId},
                ${referralNotes || null},
                'pending',
                NOW(),
                NOW()
            )
            RETURNING *
        `;

        // Send notification to lawyer
        try {
            await createNotification(
                lawyer[0].user_supabase_id,
                'case_referral',
                'New Case Referral',
                `You have received a case referral from a barrister: "${caseRecord[0].title}"`,
                {
                    referral_id: referral[0].id,
                    case_id: caseId,
                    case_title: caseRecord[0].title,
                    barrister_id: actualBarristerId
                }
            );
        } catch (notificationError) {
            console.error('Error sending notification:', notificationError);
            // Don't fail the referral if notification fails
        }

        res.status(201).json({
            success: true,
            referral: referral[0],
            message: 'Case referral created successfully'
        });
    } catch (error) {
        console.error('Error creating case referral:', error);
        res.status(500).json({ error: 'Failed to create case referral' });
    }
}

/**
 * Get referrals for a lawyer
 * GET /api/cases/referrals/lawyer/:lawyerId
 */
export async function getLawyerReferrals(req, res) {
    const { lawyerId } = req.params;
    const { status } = req.query;
    
    try {
        // Handle UUID format
        let actualLawyerId = lawyerId;
        if (lawyerId.includes('-')) {
            const user = await sql`SELECT id FROM "user" WHERE supabase_id = ${lawyerId}`;
            if (user.length === 0) {
                return res.status(404).json({ error: 'Lawyer not found' });
            }
            actualLawyerId = user[0].id;
        }

        let query = sql`
            SELECT 
                cr.*,
                c.title as case_title,
                c.description as case_description,
                c.status as case_status,
                c.expertise_area,
                c.priority,
                c.case_summary_url,
                c.jurisdiction,
                c.case_type,
                u.name as barrister_name,
                u.email as barrister_email,
                client.name as client_name,
                client.email as client_email
            FROM case_referrals cr
            JOIN "case" c ON cr.case_id = c.id
            JOIN "user" u ON cr.barrister_id = u.id
            JOIN "user" client ON c.client_id = client.id
            WHERE cr.lawyer_id = ${actualLawyerId}
        `;
        
        if (status && status !== 'all') {
            query = sql`${query} AND cr.status = ${status}`;
        }
        
        query = sql`${query} ORDER BY cr.created_at DESC`;
        
        const referrals = await query;
        res.json(referrals);
    } catch (error) {
        console.error('Error fetching lawyer referrals:', error);
        res.status(500).json({ error: 'Failed to fetch referrals' });
    }
}

/**
 * Respond to a referral (accept or decline)
 * PATCH /api/cases/referrals/:referralId/respond
 */
export async function respondToReferral(req, res) {
    const { referralId } = req.params;
    const { lawyerId, action, responseNotes } = req.body;
    
    try {
        if (!lawyerId || !action || !['accept', 'decline'].includes(action)) {
            return res.status(400).json({ error: 'Missing or invalid action. Must be "accept" or "decline"' });
        }

        // Resolve lawyer ID
        let actualLawyerId = lawyerId;
        if (lawyerId.includes('-')) {
            const user = await sql`SELECT id FROM "user" WHERE supabase_id = ${lawyerId}`;
            if (user.length === 0) {
                return res.status(404).json({ error: 'Lawyer not found' });
            }
            actualLawyerId = user[0].id;
        }

        // Get referral
        const referral = await sql`
            SELECT cr.*, c.title as case_title
            FROM case_referrals cr
            JOIN "case" c ON cr.case_id = c.id
            WHERE cr.id = ${referralId} AND cr.lawyer_id = ${actualLawyerId}
        `;
        
        if (referral.length === 0) {
            return res.status(404).json({ error: 'Referral not found or access denied' });
        }

        if (referral[0].status !== 'pending') {
            return res.status(400).json({ error: 'Referral has already been responded to' });
        }

        const newStatus = action === 'accept' ? 'accepted' : 'declined';
        
        // Update referral
        const updated = await sql`
            UPDATE case_referrals
            SET 
                status = ${newStatus},
                response_notes = ${responseNotes || null},
                responded_at = NOW(),
                updated_at = NOW()
            WHERE id = ${referralId}
            RETURNING *
        `;

        // If accepted, assign the case to the lawyer
        if (action === 'accept') {
            await sql`
                UPDATE "case"
                SET 
                    freelancer_id = ${actualLawyerId},
                    assigned_at = NOW(),
                    updated_at = NOW()
                WHERE id = ${referral[0].case_id}
            `;

            // Get barrister supabase_id for notification
            const barrister = await sql`
                SELECT supabase_id FROM "user" WHERE id = ${referral[0].barrister_id}
            `;
            
            if (barrister.length > 0) {
                try {
                    await createNotification(
                        barrister[0].supabase_id,
                        'referral_accepted',
                        'Referral Accepted',
                        `Your referral for case "${referral[0].case_title}" has been accepted by the lawyer.`,
                        {
                            referral_id: referralId,
                            case_id: referral[0].case_id
                        }
                    );
                } catch (notificationError) {
                    console.error('Error sending notification:', notificationError);
                }
            }
        }

        res.json({
            success: true,
            referral: updated[0],
            message: `Referral ${action}ed successfully`
        });
    } catch (error) {
        console.error('Error responding to referral:', error);
        res.status(500).json({ error: 'Failed to respond to referral' });
    }
}

/**
 * Get referrals made by a barrister
 * GET /api/cases/referrals/barrister/:barristerId
 */
export async function getBarristerReferrals(req, res) {
    const { barristerId } = req.params;
    const { status } = req.query;
    
    try {
        // Handle UUID format
        let actualBarristerId = barristerId;
        if (barristerId.includes('-')) {
            const user = await sql`SELECT id FROM "user" WHERE supabase_id = ${barristerId}`;
            if (user.length === 0) {
                return res.status(404).json({ error: 'Barrister not found' });
            }
            actualBarristerId = user[0].id;
        }

        let query = sql`
            SELECT 
                cr.*,
                c.title as case_title,
                c.description as case_description,
                c.status as case_status,
                f.name as lawyer_name,
                f.email as lawyer_email,
                f.expertise_areas as lawyer_expertise
            FROM case_referrals cr
            JOIN "case" c ON cr.case_id = c.id
            JOIN freelancer f ON cr.lawyer_id = f.user_id
            WHERE cr.barrister_id = ${actualBarristerId}
        `;
        
        if (status && status !== 'all') {
            query = sql`${query} AND cr.status = ${status}`;
        }
        
        query = sql`${query} ORDER BY cr.created_at DESC`;
        
        const referrals = await query;
        res.json(referrals);
    } catch (error) {
        console.error('Error fetching barrister referrals:', error);
        res.status(500).json({ error: 'Failed to fetch referrals' });
    }
}

/**
 * Accept a case (for barristers)
 * POST /api/cases/:caseId/barrister/accept
 */
export async function acceptBarristerCase(req, res) {
    const { caseId } = req.params;
    const { barristerId } = req.body;
    
    try {
        if (!barristerId) {
            return res.status(400).json({ error: 'Barrister ID is required' });
        }

        // Handle both numeric ID and UUID
        let actualBarristerId = barristerId;
        if (barristerId.includes('-')) {
            const user = await sql`SELECT id FROM "user" WHERE supabase_id = ${barristerId}`;
            if (user.length === 0) {
                return res.status(404).json({ error: 'Barrister not found' });
            }
            actualBarristerId = user[0].id;
        }

        // Get case details with client information
        const caseData = await sql`
            SELECT c.*, u.name as client_name, u.email as client_email, u.supabase_id as client_supabase_id
            FROM "case" c 
            JOIN "user" u ON c.client_id = u.id 
            WHERE c.id = ${parseInt(caseId)}
        `;
        
        if (!caseData.length) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        const caseItem = caseData[0];
        
        // Verify the case is assigned to this barrister
        if (caseItem.barrister_id !== parseInt(actualBarristerId)) {
            return res.status(403).json({ error: 'Case is not assigned to this barrister' });
        }
        
        // Update case status to active
        const updated = await sql`
            UPDATE "case" 
            SET status = 'active', accepted_at = NOW(), updated_at = NOW() 
            WHERE id = ${parseInt(caseId)} 
            RETURNING *
        `;
        
        if (!updated.length) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        // Send app notification to client
        try {
            // Handle email addresses, UUIDs, and numeric IDs
            let notificationUserId = caseItem.client_supabase_id || caseItem.client_id;
            
            // If it's an email address, look up the user by email
            if (notificationUserId && notificationUserId.includes('@')) {
                const userByEmail = await sql`
                    SELECT id, supabase_id FROM "user" WHERE email = ${notificationUserId}
                `;
                if (userByEmail.length > 0) {
                    // Use supabase_id if available, otherwise use numeric id
                    notificationUserId = userByEmail[0].supabase_id || userByEmail[0].id;
                }
            }
            
            await createNotification(
                notificationUserId,
                'case_accepted',
                'Case Accepted',
                `Your case "${caseItem.title}" has been accepted by the barrister and is now active.`,
                { case_id: parseInt(caseId), case_title: caseItem.title }
            );
        } catch (notificationError) {
            logger.error('Error creating notification for case acceptance:', notificationError);
            // Continue even if notification fails
        }
        
        // Send email notification to client
        if (caseItem.client_email) {
            try {
                await sendCaseAcceptedEmail(
                    caseItem.client_email,
                    caseItem.client_name || 'Client',
                    caseItem.title
                );
                logger.log('Case accepted email sent to client:', { email: caseItem.client_email, caseId });
            } catch (emailError) {
                logger.error('Error sending case accepted email:', emailError);
                // Continue even if email fails
            }
        }
        
        res.json({
            success: true,
            case: updated[0],
            message: 'Case accepted successfully'
        });
    } catch (error) {
        console.error('Error accepting case:', error);
        res.status(500).json({ error: 'Failed to accept case' });
    }
}

/**
 * Reject/Decline a case (for barristers)
 * POST /api/cases/:caseId/barrister/reject
 */
export async function rejectBarristerCase(req, res) {
    const { caseId } = req.params;
    const { barristerId, reason } = req.body;
    
    try {
        if (!barristerId) {
            return res.status(400).json({ error: 'Barrister ID is required' });
        }

        // Handle both numeric ID and UUID
        let actualBarristerId = barristerId;
        if (barristerId.includes('-')) {
            const user = await sql`SELECT id FROM "user" WHERE supabase_id = ${barristerId}`;
            if (user.length === 0) {
                return res.status(404).json({ error: 'Barrister not found' });
            }
            actualBarristerId = user[0].id;
        }

        // Get case details with client information
        const caseData = await sql`
            SELECT c.*, u.name as client_name, u.email as client_email, u.supabase_id as client_supabase_id
            FROM "case" c 
            JOIN "user" u ON c.client_id = u.id 
            WHERE c.id = ${parseInt(caseId)}
        `;
        
        if (!caseData.length) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        const caseItem = caseData[0];
        
        // Verify the case is assigned to this barrister
        if (caseItem.barrister_id !== parseInt(actualBarristerId)) {
            return res.status(403).json({ error: 'Case is not assigned to this barrister' });
        }
        
        // Update case status to declined and remove barrister assignment
        const updated = await sql`
            UPDATE "case" 
            SET status = 'declined', 
                declined_at = NOW(), 
                barrister_id = NULL,
                assigned_at = NULL,
                updated_at = NOW() 
            WHERE id = ${parseInt(caseId)} 
            RETURNING *
        `;
        
        if (!updated.length) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        // Send app notification to client
        try {
            // Handle email addresses, UUIDs, and numeric IDs
            let notificationUserId = caseItem.client_supabase_id || caseItem.client_id;
            
            // If it's an email address, look up the user by email
            if (notificationUserId && notificationUserId.includes('@')) {
                const userByEmail = await sql`
                    SELECT id, supabase_id FROM "user" WHERE email = ${notificationUserId}
                `;
                if (userByEmail.length > 0) {
                    // Use supabase_id if available, otherwise use numeric id
                    notificationUserId = userByEmail[0].supabase_id || userByEmail[0].id;
                }
            }
            
            await createNotification(
                notificationUserId,
                'case_declined',
                'Case Declined',
                `Your case "${caseItem.title}" has been declined by the barrister.${reason ? ` Reason: ${reason}` : ''}`,
                { case_id: parseInt(caseId), case_title: caseItem.title }
            );
        } catch (notificationError) {
            logger.error('Error creating notification for case decline:', notificationError);
            // Continue even if notification fails
        }
        
        // Send email notification to client
        if (caseItem.client_email) {
            try {
                await sendCaseDeclinedEmail(
                    caseItem.client_email,
                    caseItem.client_name || 'Client',
                    caseItem.title
                );
                logger.log('Case declined email sent to client:', { email: caseItem.client_email, caseId });
            } catch (emailError) {
                logger.error('Error sending case declined email:', emailError);
                // Continue even if email fails
            }
        }
        
        res.json({
            success: true,
            case: updated[0],
            message: 'Case rejected successfully'
        });
    } catch (error) {
        console.error('Error rejecting case:', error);
        res.status(500).json({ error: 'Failed to reject case' });
    }
} 