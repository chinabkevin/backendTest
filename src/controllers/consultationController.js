import { sql } from '../config/db.js';

// GET /api/lawyers - Returns a list of available legal professionals
export const getLawyers = async (req, res) => {
  try {
    const lawyers = await sql`
      SELECT 
        f.id,
        f.name as fullName,
        f.expertise_areas as specialty,
        f.is_available,
        f.is_verified,
        f.verification_status,
        f.performance_score,
        f.total_earnings,
        f.created_at,
        f.updated_at,
        CASE 
          WHEN f.is_available THEN ARRAY['Available now'] 
          ELSE ARRAY['Not available'] 
        END as availability,
        '/default-avatar.png' as avatarUrl
      FROM freelancer f
      WHERE f.is_verified = true
      ORDER BY f.performance_score DESC, f.created_at DESC
    `;
    
    res.json(lawyers);
  } catch (error) {
    console.error('Error fetching lawyers:', error);
    res.status(500).json({ error: 'Failed to fetch lawyers' });
  }
};

// POST /api/consultations/book - Books a legal consultation
export const bookConsultation = async (req, res) => {
  try {
    const { userId, lawyerId, datetime, method, notes } = req.body;
    console.log("bookConsultation request body", req.body);
    
    // Validate required fields
    if (!userId || !lawyerId || !datetime || !method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate method
    if (!['video', 'chat', 'voice'].includes(method)) {
      return res.status(400).json({ error: 'Method must be either "video", "chat", or "voice"' });
    }
    
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
    
    // Generate room URL for video consultations
    const roomUrl = method === 'video' 
      ? `https://meet.jit.si/legaliq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      : null;
    
    // Calculate additional fee for voice call
    const baseFee = 50; // Base consultation fee
    const voiceCallFee = method === 'voice' ? 15 : 0; // Additional fee for voice calls
    const totalFee = baseFee + voiceCallFee;
    
    // Create consultation - store the freelancer's actual ID, not user_id
    const [consultation] = await sql`
      INSERT INTO consultations (user_id, freelancer_id, scheduled_at, method, notes, room_url, status, base_fee, additional_fee, total_fee)
      VALUES (${user[0].id}, ${freelancer[0].id}, ${datetime}, ${method}, ${notes}, ${roomUrl}, 'confirmed', ${baseFee}, ${voiceCallFee}, ${totalFee})
      RETURNING id, room_url, status, method, total_fee
    `;
    
    // Create response with appropriate instructions based on method
    let instructions = '';
    if (consultation.method === 'voice') {
      instructions = 'The lawyer will call you at the scheduled time.';
    } else if (consultation.method === 'video') {
      instructions = 'Join the video room at the scheduled time using the provided link.';
    } else {
      instructions = 'Chat will be available at the scheduled time.';
    }
    
    res.status(201).json({
      status: consultation.status,
      consultationId: consultation.id,
      roomUrl: consultation.room_url,
      method: consultation.method,
      fee: {
        base: baseFee,
        additional: voiceCallFee,
        total: consultation.total_fee
      },
      instructions
    });
  } catch (error) {
    console.error('Error booking consultation:', error);
    res.status(500).json({ error: 'Failed to book consultation' });
  }
};

// GET /api/consultations/my - Get user's consultations
export const getMyConsultations = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const consultations = await sql`
      SELECT 
        c.id,
        COALESCE(f.name, 'Unknown Lawyer') as lawyerName,
        c.scheduled_at as datetime,
        c.method,
        c.room_url as roomUrl,
        c.status,
        c.notes,
        c.created_at,
        c.freelancer_id,
        f.id as freelancer_table_id,
        f.name as freelancer_name,
        c.base_fee,
        c.additional_fee,
        c.total_fee,
        CASE 
          WHEN c.method = 'voice' THEN 'The lawyer will call you at the scheduled time.' 
          WHEN c.method = 'video' THEN 'Join the video room at the scheduled time.' 
          ELSE 'Chat will be available at the scheduled time.' 
        END as instructions
      FROM consultations c
      LEFT JOIN freelancer f ON c.freelancer_id = f.id
      WHERE c.user_id = ${user[0].id}
      ORDER BY c.scheduled_at DESC
    `;
    
    console.log('Raw consultations data:', consultations);
    console.log('User ID:', user[0].id);
    console.log('Number of consultations found:', consultations.length);
    
    // Log each consultation for debugging
    consultations.forEach((consultation, index) => {
      console.log(`Consultation ${index + 1}:`, {
        id: consultation.id,
        lawyerName: consultation.lawyerName,
        freelancer_id: consultation.freelancer_id,
        freelancer_table_id: consultation.freelancer_table_id,
        freelancer_name: consultation.freelancer_name
      });
    });
    
    res.json(consultations);
  } catch (error) {
    console.error('Error fetching consultations:', error);
    res.status(500).json({ error: 'Failed to fetch consultations' });
  }
};

// PATCH /api/consultations/:id - Cancel or reschedule consultation
export const updateConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, newDatetime } = req.body;
    
    if (!action || !['cancel', 'reschedule'].includes(action)) {
      return res.status(400).json({ error: 'Action must be either "cancel" or "reschedule"' });
    }
    
    if (action === 'reschedule' && !newDatetime) {
      return res.status(400).json({ error: 'New datetime is required for rescheduling' });
    }
    
    // Check if consultation exists
    const consultation = await sql`
      SELECT id, status, scheduled_at 
      FROM consultations 
      WHERE id = ${id}
    `;
    
    if (consultation.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }
    
    if (consultation[0].status === 'cancelled') {
      return res.status(400).json({ error: 'Consultation is already cancelled' });
    }
    
    let result;
    if (action === 'cancel') {
      result = await sql`
        UPDATE consultations 
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, status
      `;
    } else {
      result = await sql`
        UPDATE consultations 
        SET scheduled_at = ${newDatetime}, status = 'rescheduled', updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, status, scheduled_at
      `;
    }
    
    res.json({
      status: result[0].status,
      ...(action === 'reschedule' && { newDatetime: result[0].scheduled_at })
    });
  } catch (error) {
    console.error('Error updating consultation:', error);
    res.status(500).json({ error: 'Failed to update consultation' });
  }
};

// POST /api/consultations/:id/feedback - Submit feedback for consultation
export const submitFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comments } = req.body;
    
    console.log('submitFeedback called with:', { id, rating, comments });
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    // Check if consultation exists and is completed
    const consultation = await sql`
      SELECT id, status 
      FROM consultations 
      WHERE id = ${id}
    `;
    
    console.log('Found consultation:', consultation);
    
    if (consultation.length === 0) {
      return res.status(404).json({ error: 'Consultation not found' });
    }
    
    console.log('Consultation status:', consultation[0].status);
    
    if (!['confirmed', 'completed'].includes(consultation[0].status)) {
      return res.status(400).json({ error: 'Feedback can only be submitted for confirmed or completed consultations' });
    }
    
    // Check if feedback already exists
    const existingFeedback = await sql`
      SELECT id FROM consultation_feedback WHERE consultation_id = ${id}
    `;
    
    if (existingFeedback.length > 0) {
      return res.status(400).json({ error: 'Feedback already submitted for this consultation' });
    }
    
    // Create feedback
    await sql`
      INSERT INTO consultation_feedback (consultation_id, rating, comments)
      VALUES (${id}, ${rating}, ${comments})
    `;
    
    // Update freelancer performance score
    const freelancerId = await sql`
      SELECT freelancer_id FROM consultations WHERE id = ${id}
    `;
    
    if (freelancerId.length > 0) {
      // Calculate new average rating
      const avgRating = await sql`
        SELECT AVG(cf.rating) as avg_rating
        FROM consultation_feedback cf
        JOIN consultations c ON cf.consultation_id = c.id
        WHERE c.freelancer_id = ${freelancerId[0].freelancer_id}
      `;
      
      if (avgRating[0].avg_rating) {
        await sql`
          UPDATE freelancer 
          SET performance_score = ${avgRating[0].avg_rating}, updated_at = NOW()
          WHERE user_id = ${freelancerId[0].freelancer_id}
        `;
      }
    }
    
    res.json({ message: 'Feedback saved.' });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
}; 

// Update consultation payment status - used by webhook
export const updateConsultationPayment = async (consultationId, paymentInfo) => {
  try {
    const { paymentStatus, paymentId, paymentAmount } = paymentInfo;
    
    // Update the consultation with payment information
    const result = await sql`
      UPDATE consultations 
      SET 
        payment_status = ${paymentStatus},
        payment_id = ${paymentId},
        payment_amount = ${paymentAmount || null},
        updated_at = NOW()
      WHERE id = ${consultationId}
      RETURNING id, status, payment_status
    `;
    
    if (result.length === 0) {
      throw new Error('Consultation not found');
    }
    
    // If payment is successful, update consultation status if needed
    if (paymentStatus === 'paid') {
      // Only update if not already completed or cancelled
      if (!['completed', 'cancelled'].includes(result[0].status)) {
        await sql`
          UPDATE consultations 
          SET status = 'confirmed', updated_at = NOW()
          WHERE id = ${consultationId}
        `;
      }
    }
    
    // If payment failed, mark as pending payment
    if (paymentStatus === 'failed') {
      // Only update if not already completed or cancelled
      if (!['completed', 'cancelled'].includes(result[0].status)) {
        await sql`
          UPDATE consultations 
          SET status = 'payment_pending', updated_at = NOW()
          WHERE id = ${consultationId}
        `;
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating consultation payment:', error);
    return { success: false, error: error.message };
  }
};

// GET /api/consultations/recent - Get recent consultations for user
export const getRecentConsultations = async (req, res) => {
  try {
    const { userId, limit = 5 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'UserId is required' });
    }

    // Get user ID from supabase_id
    const user = await sql`
      SELECT id FROM "user" WHERE supabase_id = ${userId}
    `;
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get recent consultations for the user
    const consultations = await sql`
      SELECT 
        c.id,
        c.status,
        c.created_at,
        c.updated_at,
        f.name as lawyer_name
      FROM consultations c
      LEFT JOIN freelancer f ON c.freelancer_id = f.id
      WHERE c.user_id = ${user[0].id}
      ORDER BY c.created_at DESC
      LIMIT ${parseInt(limit)}
    `;

    res.json({
      success: true,
      consultations: consultations
    });
  } catch (error) {
    console.error('Error fetching recent consultations:', error);
    res.status(500).json({ error: 'Failed to fetch recent consultations' });
  }
};