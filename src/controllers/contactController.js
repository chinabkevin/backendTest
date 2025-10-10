import { sql } from '../config/db.js';
import logger from '../utils/logger.js';

// Submit contact form
export const submitContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Get client IP and user agent
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Insert contact submission into database
    const result = await sql`
      INSERT INTO contact_submissions (name, email, subject, message, ip_address, user_agent)
      VALUES (${name}, ${email}, ${subject}, ${message}, ${ipAddress}, ${userAgent})
      RETURNING id, created_at
    `;

    const submission = result[0];

    logger.log('New contact submission received:', {
      id: submission.id,
      email,
      subject,
      ip: ipAddress
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for your message. We will get back to you within 24 hours.',
      data: {
        id: submission.id,
        submittedAt: submission.created_at
      }
    });

  } catch (error) {
    logger.error('Error submitting contact form:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while submitting your message. Please try again.'
    });
  }
};

// Get all contact submissions (admin only)
export const getContactSubmissions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = sql`
      SELECT id, name, email, subject, message, status, created_at, updated_at
      FROM contact_submissions
    `;

    const countQuery = sql`
      SELECT COUNT(*) as total
      FROM contact_submissions
    `;

    // Add status filter if provided
    if (status) {
      query = sql`
        SELECT id, name, email, subject, message, status, created_at, updated_at
        FROM contact_submissions
        WHERE status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      const countResult = await sql`
        SELECT COUNT(*) as total
        FROM contact_submissions
        WHERE status = ${status}
      `;
    } else {
      query = sql`
        SELECT id, name, email, subject, message, status, created_at, updated_at
        FROM contact_submissions
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const [submissions, countResult] = await Promise.all([
      query,
      status ? sql`SELECT COUNT(*) as total FROM contact_submissions WHERE status = ${status}` : sql`SELECT COUNT(*) as total FROM contact_submissions`
    ]);

    const total = parseInt(countResult[0].total);

    res.json({
      success: true,
      data: {
        submissions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching contact submissions:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching contact submissions'
    });
  }
};

// Get single contact submission (admin only)
export const getContactSubmission = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sql`
      SELECT id, name, email, subject, message, status, ip_address, user_agent, created_at, updated_at
      FROM contact_submissions
      WHERE id = ${id}
    `;

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact submission not found'
      });
    }

    res.json({
      success: true,
      data: result[0]
    });

  } catch (error) {
    logger.error('Error fetching contact submission:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the contact submission'
    });
  }
};

// Update contact submission status (admin only)
export const updateContactStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['new', 'read', 'replied', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: new, read, replied, closed'
      });
    }

    const result = await sql`
      UPDATE contact_submissions
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, status, updated_at
    `;

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact submission not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact submission status updated successfully',
      data: result[0]
    });

  } catch (error) {
    logger.error('Error updating contact submission status:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating the contact submission'
    });
  }
};
