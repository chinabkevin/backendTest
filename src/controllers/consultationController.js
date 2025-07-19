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
    if (!['video', 'chat'].includes(method)) {
      return res.status(400).json({ error: 'Method must be either "video" or "chat"' });
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
    
    // Create consultation
    const [consultation] = await sql`
      INSERT INTO consultations (user_id, freelancer_id, scheduled_at, method, notes, room_url, status)
      VALUES (${user[0].id}, ${lawyerId}, ${datetime}, ${method}, ${notes}, ${roomUrl}, 'confirmed')
      RETURNING id, room_url, status
    `;
    
    res.status(201).json({
      status: consultation.status,
      consultationId: consultation.id,
      roomUrl: consultation.room_url
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
        f.name as lawyerName,
        c.scheduled_at as datetime,
        c.method,
        c.room_url as roomUrl,
        c.status,
        c.notes,
        c.created_at
      FROM consultations c
      JOIN freelancer f ON c.freelancer_id = f.user_id
      WHERE c.user_id = ${user[0].id}
      ORDER BY c.scheduled_at DESC
    `;
    
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