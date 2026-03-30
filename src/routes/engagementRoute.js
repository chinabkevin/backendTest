import express from 'express';
import {
  acceptEngagement,
  getEngagementStatus,
  listClientEngagements,
  downloadEngagementPdf,
} from '../controllers/engagementController.js';

const router = express.Router();

router.post('/accept', acceptEngagement);
router.get('/status', getEngagementStatus);
router.get('/client/:userId', listClientEngagements);
router.get('/pdf/:id', downloadEngagementPdf);

export default router;
