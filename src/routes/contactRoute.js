import express from 'express';
import {
  submitContact,
  getContactSubmissions,
  getContactSubmission,
  updateContactStatus
} from '../controllers/contactController.js';

const router = express.Router();

// Public route - submit contact form
router.post('/submit', submitContact);

// Admin routes (you may want to add authentication middleware here)
router.get('/submissions', getContactSubmissions);
router.get('/submissions/:id', getContactSubmission);
router.patch('/submissions/:id/status', updateContactStatus);

export default router;
