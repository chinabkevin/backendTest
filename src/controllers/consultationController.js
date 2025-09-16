import { sql } from "../config/db.js";
import { createNotification } from "./notificationController.js";

// Create a new consultation
export async function createConsultation(req, res) {
    console.log('createConsultation called with body:', req.body)
    
    const { 
        caseId, 
        freelancerId, 
        clientId, 
        consultationType, 
        scheduledAt, 
        duration, 
        notes,
        meetingLink 
    } = req.body;

    try {
        // Validate required fields
        if (!caseId || !freelancerId || !clientId || !consultationType || !scheduledAt) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate consultation type
        if (!['chat', 'video', 'audio'].includes(consultationType)) {
            return res.status(400).json({ error: 'Invalid consultation type' });
        }

        // Convert IDs from UUID to integer if needed
        let actualClientId = clientId;
        let actualFreelancerId = freelancerId;

        // Handle clientId - could be UUID string or integer
        console.log('Processing clientId:', clientId, 'type:', typeof clientId)
        if (typeof clientId === 'string' && clientId.includes('-')) {
            const userResult = await sql`SELECT id FROM "user" WHERE supabase_id = ${clientId}`;
            if (!userResult.length) {
                return res.status(404).json({ error: 'Client not found' });
            }
            actualClientId = userResult[0].id;
        }

        // Handle freelancerId - could be UUID string or integer
        if (typeof freelancerId === 'string' && freelancerId.includes('-')) {
            const freelancerResult = await sql`SELECT id FROM freelancer WHERE user_id = ${freelancerId}`;
            if (!freelancerResult.length) {
                return res.status(404).json({ error: 'Freelancer not found' });
            }
            actualFreelancerId = freelancerResult[0].id;
        }

        // Check if case exists and belongs to the client
        const caseResult = await sql`
            SELECT * FROM "case" WHERE id = ${caseId} AND client_id = ${actualClientId}
        `;
        
        if (!caseResult.length) {
            return res.status(404).json({ error: 'Case not found or access denied' });
        }

        // Create consultation
        const consultationResult = await sql`
            INSERT INTO consultations (
                case_id,
                freelancer_id,
                client_id,
                consultation_type,
                scheduled_at,
                duration,
                notes,
                meeting_link,
                status,
                created_at
            ) VALUES (
                ${caseId},
                ${actualFreelancerId},
                ${actualClientId},
                ${consultationType},
                ${scheduledAt},
                ${duration || 30},
                ${notes || null},
                ${meetingLink || null},
                'scheduled',
                NOW()
            ) RETURNING *
        `;

        const consultation = consultationResult[0];

        // Update case status if needed
        if (caseResult[0].status === 'pending') {
            await sql`
                UPDATE "case" 
                SET status = 'active', 
                    updated_at = NOW() 
                WHERE id = ${caseId}
            `;
        }

        res.status(201).json({
            success: true,
            message: 'Consultation scheduled successfully',
            consultation: consultation
        });
    } catch (error) {
        console.error('Error creating consultation:', error);
        res.status(500).json({ error: 'Failed to create consultation' });
    }
}

// Get consultations for a user (client or freelancer)
export async function getConsultations(req, res) {
    const { userId, userType } = req.params;
    const { status } = req.query;

    try {
        // Convert userId from UUID to integer if needed
        let actualUserId = userId;
        if (typeof userId === 'string' && userId.includes('-')) {
            const userResult = await sql`SELECT id FROM "user" WHERE supabase_id = ${userId}`;
            if (!userResult.length) {
                return res.status(404).json({ error: 'User not found' });
            }
            actualUserId = userResult[0].id;
        }

        let consultationsQuery;
        if (userType === 'client') {
            consultationsQuery = sql`
            SELECT 
                c.*,
                u.name as client_name,
                u.email as client_email,
                f.name as freelancer_name,
                f.email as freelancer_email,
                f.phone as freelancer_phone,
                cs.title as case_title,
                cs.description as case_description,
                p.status as payment_status,
                p.amount as payment_amount
            FROM consultations c
            LEFT JOIN "user" u ON c.client_id = u.id
            LEFT JOIN freelancer f ON c.freelancer_id = f.id
            LEFT JOIN "case" cs ON c.case_id = cs.id
            LEFT JOIN payments p ON p.consultation_id = c.id
            WHERE c.client_id = ${actualUserId}
        `;
        } else if (userType === 'freelancer') {
            // For freelancers, we need to find the freelancer record first
            const freelancerResult = await sql`SELECT id FROM freelancer WHERE user_id = ${actualUserId}`;
            if (!freelancerResult.length) {
                return res.status(404).json({ error: 'Freelancer not found' });
            }
            const freelancerId = freelancerResult[0].id;
            
            consultationsQuery = sql`
                SELECT 
                    c.*,
                    u.name as client_name,
                    u.email as client_email,
                    f.name as freelancer_name,
                    f.email as freelancer_email,
                    f.phone as freelancer_phone,
                cs.title as case_title,
                cs.description as case_description,
                p.status as payment_status,
                p.amount as payment_amount
                FROM consultations c
                LEFT JOIN "user" u ON c.client_id = u.id
                LEFT JOIN freelancer f ON c.freelancer_id = f.id
                LEFT JOIN "case" cs ON c.case_id = cs.id
                LEFT JOIN payments p ON p.consultation_id = c.id
                WHERE c.freelancer_id = ${freelancerId}
            `;
        } else {
            return res.status(400).json({ error: 'Invalid user type' });
        }

        // Add status filter if provided
        if (status) {
            consultationsQuery = sql`${consultationsQuery} AND c.status = ${status}`;
        }

        consultationsQuery = sql`${consultationsQuery} ORDER BY c.scheduled_at DESC`;

        const consultations = await consultationsQuery;

        res.json({
            success: true,
            consultations: consultations
        });
    } catch (error) {
        console.error('Error fetching consultations:', error);
        res.status(500).json({ error: 'Failed to fetch consultations' });
    }
}

// Get a specific consultation
export async function getConsultation(req, res) {
    const { consultationId } = req.params;

    try {
        const consultationResult = await sql`
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
            LEFT JOIN freelancer f ON c.freelancer_id = f.id
            LEFT JOIN "case" cs ON c.case_id = cs.id
            WHERE c.id = ${consultationId}
        `;

        if (!consultationResult.length) {
            return res.status(404).json({ error: 'Consultation not found' });
        }

        res.json({
            success: true,
            consultation: consultationResult[0]
        });
    } catch (error) {
        console.error('Error fetching consultation:', error);
        res.status(500).json({ error: 'Failed to fetch consultation' });
    }
}

// Update consultation status
export async function updateConsultationStatus(req, res) {
    const { consultationId } = req.params;
    const { status, notes, meetingLink } = req.body;

    try {
        if (!status || !['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        let updateQuery = sql`
            UPDATE consultations 
            SET status = ${status}, updated_at = NOW()
        `;

        if (notes) {
            updateQuery = sql`${updateQuery}, notes = ${notes}`;
        }

        if (meetingLink) {
            updateQuery = sql`${updateQuery}, meeting_link = ${meetingLink}`;
        }

        updateQuery = sql`${updateQuery} WHERE id = ${consultationId} RETURNING *`;

        const result = await updateQuery;

        if (!result.length) {
            return res.status(404).json({ error: 'Consultation not found' });
        }

        res.json({
            success: true,
            message: 'Consultation status updated successfully',
            consultation: result[0]
        });
    } catch (error) {
        console.error('Error updating consultation status:', error);
        res.status(500).json({ error: 'Failed to update consultation status' });
    }
}

// Start consultation (create meeting link if video/audio)
export async function startConsultation(req, res) {
    const { consultationId } = req.params;
    const { meetingLink } = req.body;

    try {
        // Get consultation details with payment status
        const consultationResult = await sql`
            SELECT c.*, p.status as payment_status 
            FROM consultations c
            LEFT JOIN payments p ON p.consultation_id = c.id
            WHERE c.id = ${consultationId}
        `;

        if (!consultationResult.length) {
            return res.status(404).json({ error: 'Consultation not found' });
        }

        const consultation = consultationResult[0];

        // Check if payment is completed
        if (consultation.payment_status !== 'completed' && consultation.payment_status !== 'paid') {
            return res.status(403).json({ 
                error: 'Payment required', 
                message: 'Consultation cannot start until payment is completed. Please wait for client payment confirmation.',
                paymentStatus: consultation.payment_status || 'pending'
            });
        }

        // Generate meeting link if not provided and consultation type is video/audio
        let finalMeetingLink = meetingLink;
        if (!meetingLink && ['video', 'audio'].includes(consultation.consultation_type)) {
            // In a real app, you would integrate with Zoom, Google Meet, etc.
            finalMeetingLink = `https://meet.example.com/${consultationId}-${Date.now()}`;
        }

        // Update consultation status
        const updateResult = await sql`
            UPDATE consultations 
            SET status = 'in_progress',
                meeting_link = ${finalMeetingLink},
                started_at = NOW(),
                updated_at = NOW()
            WHERE id = ${consultationId}
            RETURNING *
        `;

        // Get consultation details for notifications
        const consultationDetails = await sql`
            SELECT c.*, f.user_id as freelancer_user_id, f.name as freelancer_name, u.supabase_id as client_supabase_id
            FROM consultations c
            LEFT JOIN freelancer f ON c.freelancer_id = f.id
            LEFT JOIN "user" u ON c.client_id = u.id
            WHERE c.id = ${consultationId}
        `;

        if (consultationDetails.length > 0) {
            const consultation = consultationDetails[0];
            
            // Create notification for the client
            await createNotification(
                consultation.client_supabase_id,
                'consultation_started',
                'Consultation Started',
                `Your ${consultation.consultation_type} consultation with ${consultation.freelancer_name} has started. ${consultation.consultation_type === 'video' ? 'Join using the meeting link.' : 'You can now begin your consultation.'}`,
                { 
                    consultation_id: consultationId,
                    freelancer_name: consultation.freelancer_name,
                    consultation_type: consultation.consultation_type,
                    meeting_link: finalMeetingLink
                }
            );
        }

        res.json({
            success: true,
            message: 'Consultation started successfully',
            consultation: updateResult[0],
            meetingLink: finalMeetingLink
        });
    } catch (error) {
        console.error('Error starting consultation:', error);
        res.status(500).json({ error: 'Failed to start consultation' });
    }
}

// End consultation
export async function endConsultation(req, res) {
    const { consultationId } = req.params;
    const { notes, outcome } = req.body;

    try {
        const updateResult = await sql`
            UPDATE consultations 
            SET status = 'completed',
                notes = ${notes || null},
                outcome = ${outcome || null},
                ended_at = NOW(),
                updated_at = NOW()
            WHERE id = ${consultationId}
            RETURNING *
        `;

        if (!updateResult.length) {
            return res.status(404).json({ error: 'Consultation not found' });
        }

        // Get consultation details for notifications
        const consultationDetails = await sql`
            SELECT c.*, f.user_id as freelancer_user_id, f.name as freelancer_name, u.supabase_id as client_supabase_id
            FROM consultations c
            LEFT JOIN freelancer f ON c.freelancer_id = f.id
            LEFT JOIN "user" u ON c.client_id = u.id
            WHERE c.id = ${consultationId}
        `;

        if (consultationDetails.length > 0) {
            const consultation = consultationDetails[0];
            
            // Create notification for the client
            await createNotification(
                consultation.client_supabase_id,
                'consultation_completed',
                'Consultation Completed',
                `Your ${consultation.consultation_type} consultation with ${consultation.freelancer_name} has been completed. You can now provide feedback and rate your experience.`,
                { 
                    consultation_id: consultationId,
                    freelancer_name: consultation.freelancer_name,
                    consultation_type: consultation.consultation_type,
                    outcome: outcome
                }
            );

            // Create notification for the freelancer
            await createNotification(
                consultation.freelancer_user_id,
                'consultation_ended',
                'Consultation Ended',
                `Your ${consultation.consultation_type} consultation with the client has been completed. The client can now provide feedback.`,
                { 
                    consultation_id: consultationId,
                    client_id: consultation.client_id,
                    consultation_type: consultation.consultation_type,
                    outcome: outcome
                }
            );
        }

        res.json({
            success: true,
            message: 'Consultation ended successfully',
            consultation: updateResult[0]
        });
    } catch (error) {
        console.error('Error ending consultation:', error);
        res.status(500).json({ error: 'Failed to end consultation' });
    }
}

// Update consultation payment status - now updates the payments table directly
export async function updateConsultationPayment(consultationId, paymentData) {
    try {
        const { paymentStatus, paymentId, paymentAmount } = paymentData;
        
        // Update or create payment record in payments table
        const paymentResult = await sql`
            INSERT INTO payments (
                user_id,
                consultation_id,
                amount,
                status,
                service_type,
                stripe_payment_intent_id,
                created_at,
                updated_at
            ) VALUES (
                (SELECT client_id FROM consultations WHERE id = ${consultationId}),
                ${consultationId},
                ${paymentAmount},
                ${paymentStatus},
                'consultation',
                ${paymentId},
                NOW(),
                NOW()
            )
            ON CONFLICT (consultation_id) 
            DO UPDATE SET
                status = ${paymentStatus},
                amount = ${paymentAmount},
                stripe_payment_intent_id = ${paymentId},
                updated_at = NOW()
            RETURNING *
        `;

        if (!paymentResult.length) {
            throw new Error('Failed to update payment record');
        }

        console.log(`Payment status updated for consultation ${consultationId}: ${paymentStatus}`);
        return paymentResult[0];
    } catch (error) {
        console.error('Error updating consultation payment status:', error);
        throw error;
    }
}

// Cancel consultation
export async function cancelConsultation(req, res) {
    const { consultationId } = req.params;
    const { reason } = req.body;

    try {
        const updateResult = await sql`
            UPDATE consultations 
            SET status = 'cancelled',
                notes = ${reason || null},
                updated_at = NOW()
            WHERE id = ${consultationId}
            RETURNING *
        `;

        if (!updateResult.length) {
            return res.status(404).json({ error: 'Consultation not found' });
        }

        res.json({
            success: true,
            message: 'Consultation cancelled successfully',
            consultation: updateResult[0]
        });
    } catch (error) {
        console.error('Error cancelling consultation:', error);
        res.status(500).json({ error: 'Failed to cancel consultation' });
    }
}

// Get consultation statistics
export async function getConsultationStats(req, res) {
    const { userId, userType } = req.params;

    try {
        // Convert userId from UUID to integer if needed
        let actualUserId = userId;
        if (typeof userId === 'string' && userId.includes('-')) {
            const userResult = await sql`SELECT id FROM "user" WHERE supabase_id = ${userId}`;
            if (!userResult.length) {
                return res.status(404).json({ error: 'User not found' });
            }
            actualUserId = userResult[0].id;
        }

        let whereClause;
        if (userType === 'client') {
            whereClause = sql`WHERE client_id = ${actualUserId}`;
        } else if (userType === 'freelancer') {
            // For freelancers, we need to find the freelancer record first
            const freelancerResult = await sql`SELECT id FROM freelancer WHERE user_id = ${actualUserId}`;
            if (!freelancerResult.length) {
                return res.status(404).json({ error: 'Freelancer not found' });
            }
            const freelancerId = freelancerResult[0].id;
            whereClause = sql`WHERE freelancer_id = ${freelancerId}`;
        } else {
            return res.status(400).json({ error: 'Invalid user type' });
        }

        const stats = await sql`
            SELECT 
                COUNT(*) as total_consultations,
                COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
                COUNT(CASE WHEN consultation_type = 'chat' THEN 1 END) as chat_consultations,
                COUNT(CASE WHEN consultation_type = 'video' THEN 1 END) as video_consultations,
                COUNT(CASE WHEN consultation_type = 'audio' THEN 1 END) as audio_consultations
            FROM consultations
            ${whereClause}
        `;

        res.json({
            success: true,
            stats: stats[0]
        });
    } catch (error) {
        console.error('Error fetching consultation stats:', error);
        res.status(500).json({ error: 'Failed to fetch consultation stats' });
    }
}

// POST /api/consultations/book - Books a legal consultation
export const bookConsultation = async (req, res) => {
    try {
      const { userId, lawyerId, datetime, method, notes, caseId } = req.body;
      console.log("bookConsultation request body", req.body);
      
      // Validate required fields
      if (!userId || !lawyerId || !datetime || !method) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      // Validate method and map to consultation_type
      const methodMapping = {
        'video': 'video',
        'chat': 'chat', 
        'voice': 'audio'
      };
      
      if (!['video', 'chat', 'voice'].includes(method)) {
        return res.status(400).json({ error: 'Method must be either "video", "chat", or "voice"' });
      }
      
      const consultationType = methodMapping[method];
      
      // Check if freelancer exists and is available
      const freelancer = await sql`
        SELECT id, is_available, name 
        FROM freelancer 
        WHERE user_id = ${lawyerId} AND is_available = true
      `;
      console.log("freelancer ++++++++++++++", freelancer);
      
      if (freelancer.length === 0) {
        return res.status(404).json({ error: 'Lawyer not found or not available' });
      }
      
      // Check if user exists
      const user = await sql`
        SELECT id FROM "user" WHERE supabase_id = ${userId}
      `;
      
      if (user.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // If caseId is provided, verify it belongs to the user
      if (caseId) {
        const caseResult = await sql`
          SELECT id FROM "case" WHERE id = ${caseId} AND client_id = ${user[0].id}
        `;
        
        if (caseResult.length === 0) {
          return res.status(404).json({ error: 'Case not found or access denied' });
        }
      }
      
      // Generate meeting link for video consultations
      const meetingLink = consultationType === 'video' 
        ? `https://meet.jit.si/advoqat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        : null;
      
      // Calculate additional fee for voice call
      const baseFee = 50; // Base consultation fee
      const voiceCallFee = method === 'voice' ? 15 : 0; // Additional fee for voice calls
      const totalFee = baseFee + voiceCallFee;
      
      // Create consultation - store the freelancer's actual ID, not user_id
      const [consultation] = await sql`
        INSERT INTO consultations (
          client_id, 
          freelancer_id, 
          scheduled_at, 
          consultation_type, 
          notes, 
          meeting_link, 
          status,
          case_id,
          duration,
          created_at
        )
        VALUES (
          ${user[0].id}, 
          ${freelancer[0].id}, 
          ${datetime}, 
          ${consultationType}, 
          ${notes}, 
          ${meetingLink}, 
          'scheduled',
          ${caseId || null},
          30,
          NOW()
        )
        RETURNING id, meeting_link, status, consultation_type
      `;
      
      // Create notification for the freelancer
      await createNotification(
        lawyerId, // freelancer's user_id
        'consultation_booked',
        'New Consultation Booked',
        `A client has booked a ${consultation.consultation_type} consultation with you for ${new Date(datetime).toLocaleDateString()} at ${new Date(datetime).toLocaleTimeString()}.`,
        { 
          consultation_id: consultation.id, 
          client_id: user[0].id,
          consultation_type: consultation.consultation_type,
          scheduled_at: datetime,
          meeting_link: consultation.meeting_link
        }
      );

      // Create notification for the client
      await createNotification(
        userId, // client's supabase_id
        'consultation_scheduled',
        'Consultation Scheduled',
        `Your ${consultation.consultation_type} consultation with ${freelancer[0].name} has been scheduled for ${new Date(datetime).toLocaleDateString()} at ${new Date(datetime).toLocaleTimeString()}.`,
        { 
          consultation_id: consultation.id, 
          freelancer_id: freelancer[0].id,
          consultation_type: consultation.consultation_type,
          scheduled_at: datetime,
          meeting_link: consultation.meeting_link
        }
      );

      // Create response with appropriate instructions based on method
      let instructions = '';
      if (consultation.consultation_type === 'audio') {
        instructions = 'The lawyer will call you at the scheduled time.';
      } else if (consultation.consultation_type === 'video') {
        instructions = 'Join the video room at the scheduled time using the provided link.';
      } else {
        instructions = 'Chat will be available at the scheduled time.';
      }
      
      res.status(201).json({
        status: consultation.status,
        consultationId: consultation.id,
        roomUrl: consultation.meeting_link,
        method: method, // Return original method name for frontend compatibility
        consultationType: consultation.consultation_type,
        instructions,
        fee: {
          base_fee: baseFee,
          additional_fee: voiceCallFee,
          total: totalFee
        }
      });
    } catch (error) {
      console.error('Error booking consultation:', error);
      res.status(500).json({ error: 'Failed to book consultation' });
    }
  };
  