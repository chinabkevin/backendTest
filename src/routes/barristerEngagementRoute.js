import express from 'express';
import {
  acceptBarristerEngagement,
  getBarristerEngagementStatus,
  listClientBarristerEngagements,
  downloadBarristerEngagementPdf,
} from '../controllers/barristerEngagementController.js';

const router = express.Router();

router.post('/accept', acceptBarristerEngagement);
router.get('/status', getBarristerEngagementStatus);
router.get('/client/:userId', listClientBarristerEngagements);
router.get('/pdf/:id', downloadBarristerEngagementPdf);

export default router;
