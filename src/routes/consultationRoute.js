import express from 'express';
import { 
    createConsultation,
    getConsultations,
    getConsultation,
    updateConsultationStatus,
    startConsultation,
    endConsultation,
    cancelConsultation,
    getConsultationStats
} from '../controllers/consultationController.js';

const router = express.Router();

// Create a new consultation
router.post('/consultations', createConsultation);

// Get consultations for a user (client or freelancer)
router.get('/consultations/:userType/:userId', getConsultations);

// Get a specific consultation
router.get('/consultations/:consultationId', getConsultation);

// Update consultation status
router.patch('/consultations/:consultationId/status', updateConsultationStatus);

// Start consultation
router.post('/consultations/:consultationId/start', startConsultation);

// End consultation
router.post('/consultations/:consultationId/end', endConsultation);

// Cancel consultation
router.post('/consultations/:consultationId/cancel', cancelConsultation);

// Get consultation statistics
router.get('/consultations/:userType/:userId/stats', getConsultationStats);

export default router; 