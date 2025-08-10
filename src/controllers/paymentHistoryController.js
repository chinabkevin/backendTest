import { sql } from '../config/db.js';

// Get payment history for a user
export const getUserPaymentHistory = async (req, res) => {
  try {
    const { userId } = req.query;
    const { startDate, endDate, serviceType, status, page = 1, limit = 10 } = req.query;
    
    console.log('Payment history request - userId:', userId);
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get database user ID from Supabase user ID
    let dbUserId = userId;
    if (userId.includes('-')) { // This is a Supabase UUID
      console.log('Converting Supabase UUID to database ID...');
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
    
    // Check if payments table exists
    console.log('Checking if payments table exists...');
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'payments'
      ) as table_exists
    `;
    
    if (!tableCheck[0]?.table_exists) {
      console.error('Payments table does not exist!');
      return res.status(500).json({ 
        error: 'Payments table does not exist',
        details: 'Database migration may have failed'
      });
    }
    
    console.log('Payments table exists, proceeding with query...');
    
    // Build the base query
    let query = sql`
      SELECT 
        p.id,
        p.amount,
        p.currency,
        p.payment_method,
        p.status,
        p.service_type,
        p.description,
        p.created_at,
        p.updated_at,
        p.stripe_session_id,
        p.stripe_payment_intent_id,
        f.name as consultation_lawyer_name,
        c.scheduled_at as consultation_date,
        c.consultation_type as consultation_method,
        d.template_name as document_name,
        d.template_id as document_type
      FROM payments p
      LEFT JOIN consultations c ON p.consultation_id = c.id
      LEFT JOIN freelancer f ON c.freelancer_id = f.id
      LEFT JOIN documents d ON p.document_id = d.id
      WHERE p.user_id = ${dbUserId}
    `;
    
    // Add filters
    const conditions = [];
    const params = [];
    
    if (startDate) {
      conditions.push(sql`p.created_at >= ${startDate}`);
    }
    
    if (endDate) {
      conditions.push(sql`p.created_at <= ${endDate}`);
    }
    
    if (serviceType) {
      conditions.push(sql`p.service_type = ${serviceType}`);
    }
    
    if (status) {
      conditions.push(sql`p.status = ${status}`);
    }
    
    // Add conditions to query
    if (conditions.length > 0) {
      // Build the conditions manually to avoid sql.join issues
      let conditionQuery = query;
      for (let i = 0; i < conditions.length; i++) {
        conditionQuery = sql`${conditionQuery} AND ${conditions[i]}`;
      }
      query = conditionQuery;
    }
    
    // Add ordering and pagination
    const offset = (page - 1) * limit;
    query = sql`${query} ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    console.log('Executing payment history query...');
    const payments = await query;
    console.log('Query executed successfully, found payments:', payments.length);
    
    // Get total count for pagination
    let countQuery = sql`
      SELECT COUNT(*) as total
      FROM payments p
      WHERE p.user_id = ${dbUserId}
    `;
    
    if (conditions.length > 0) {
      // Build the conditions manually to avoid sql.join issues
      let conditionCountQuery = countQuery;
      for (let i = 0; i < conditions.length; i++) {
        conditionCountQuery = sql`${conditionCountQuery} AND ${conditions[i]}`;
      }
      countQuery = conditionCountQuery;
    }
    
    const countResult = await countQuery;
    const total = parseInt(countResult[0].total);
    
    // Format the response
    const formattedPayments = payments.map(payment => ({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.payment_method,
      status: payment.status,
      serviceType: payment.service_type,
      description: payment.description,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
      stripeSessionId: payment.stripe_session_id,
      stripePaymentIntentId: payment.stripe_payment_intent_id,
      // Service-specific details
      consultation: payment.consultation_lawyer_name ? {
        lawyerName: payment.consultation_lawyer_name,
        date: payment.consultation_date,
        method: payment.consultation_method
      } : null,
      document: payment.document_name ? {
        name: payment.document_name,
        type: payment.document_type
      } : null
    }));
    
    console.log('Returning payment history successfully');
    res.json({
      success: true,
      payments: formattedPayments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    res.status(500).json({ 
      error: 'Failed to fetch payment history',
      details: error.message,
      code: error.code
    });
  }
};

// Create a payment record
export const createPaymentRecord = async (paymentData) => {
  try {
    const {
      userId,
      consultationId,
      documentId,
      stripeSessionId,
      stripePaymentIntentId,
      amount,
      currency = 'usd',
      paymentMethod,
      status = 'pending',
      serviceType,
      description,
      metadata = {}
    } = paymentData;
    
    const result = await sql`
      INSERT INTO payments (
        user_id,
        consultation_id,
        document_id,
        stripe_session_id,
        stripe_payment_intent_id,
        amount,
        currency,
        payment_method,
        status,
        service_type,
        description,
        metadata
      ) VALUES (
        ${userId},
        ${consultationId},
        ${documentId},
        ${stripeSessionId},
        ${stripePaymentIntentId},
        ${amount},
        ${currency},
        ${paymentMethod},
        ${status},
        ${serviceType},
        ${description},
        ${JSON.stringify(metadata)}
      ) RETURNING id
    `;
    
    console.log('Payment record created:', result[0].id);
    return result[0].id;
  } catch (error) {
    console.error('Error creating payment record:', error);
    throw error;
  }
};

// Update payment status
export const updatePaymentStatus = async (paymentId, status, additionalData = {}) => {
  try {
    const updateFields = [];
    const values = [];
    
    updateFields.push(sql`status = ${status}`);
    values.push(status);
    
    if (additionalData.paymentMethod) {
      updateFields.push(sql`payment_method = ${additionalData.paymentMethod}`);
      values.push(additionalData.paymentMethod);
    }
    
    if (additionalData.metadata) {
      updateFields.push(sql`metadata = ${JSON.stringify(additionalData.metadata)}`);
      values.push(JSON.stringify(additionalData.metadata));
    }
    
    updateFields.push(sql`updated_at = NOW()`);
    
    await sql`
      UPDATE payments 
      SET ${sql.join(updateFields, sql`, `)}
      WHERE id = ${paymentId}
    `;
    
    console.log(`Payment ${paymentId} status updated to ${status}`);
  } catch (error) {
    console.error('Error updating payment status:', error);
    throw error;
  }
};

// Get payment statistics for a user
export const getUserPaymentStats = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get database user ID from Supabase user ID
    let dbUserId = userId;
    if (userId.includes('-')) { // This is a Supabase UUID
      const user = await sql`
        SELECT id FROM "user" WHERE supabase_id = ${userId}
      `;
      if (user.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      dbUserId = user[0].id;
    }
    
    const stats = await sql`
      SELECT 
        COUNT(*) as total_payments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_payments,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_spent,
        COUNT(CASE WHEN service_type = 'consultation' THEN 1 END) as consultation_payments,
        COUNT(CASE WHEN service_type = 'document_download' THEN 1 END) as document_payments
      FROM payments 
      WHERE user_id = ${dbUserId}
    `;
    
    const result = stats[0];
    
    res.json({
      success: true,
      stats: {
        totalPayments: parseInt(result.total_payments),
        successfulPayments: parseInt(result.successful_payments),
        failedPayments: parseInt(result.failed_payments),
        totalSpent: parseInt(result.total_spent || 0),
        consultationPayments: parseInt(result.consultation_payments),
        documentPayments: parseInt(result.document_payments)
      }
    });
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({ error: 'Failed to fetch payment statistics' });
  }
}; 