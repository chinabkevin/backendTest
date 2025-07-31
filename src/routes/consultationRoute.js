import express from 'express';
import { 
  getLawyers, 
  bookConsultation, 
  getMyConsultations, 
  updateConsultation, 
  submitFeedback,
  getRecentConsultations
} from '../controllers/consultationController.js';

const router = express.Router();

// GET /api/lawyers - Get available lawyers
router.get('/lawyers', getLawyers);

// POST /api/consultations/book - Book a consultation
router.post('/consultations/book', bookConsultation);

// GET /api/consultations/my - Get user's consultations
router.get('/consultations/my', getMyConsultations);

// PATCH /api/consultations/:id - Update consultation (cancel/reschedule)
router.patch('/consultations/:id', updateConsultation);

// POST /api/consultations/:id/feedback - Submit feedback
router.post('/consultations/:id/feedback', submitFeedback);

// GET /api/consultations/recent - Get recent consultations for user
router.get('/consultations/recent', getRecentConsultations);

export default router; 