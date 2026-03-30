import express from 'express';
import {
  submitLawyerDeclaration,
  getLawyerDeclarationStatus,
  getMyLawyerDeclaration,
  downloadLawyerDeclarationPdf,
} from '../controllers/lawyerDeclarationController.js';

const router = express.Router();

router.post('/declaration', submitLawyerDeclaration);
router.get('/declaration/status', getLawyerDeclarationStatus);
router.get('/declaration/me', getMyLawyerDeclaration);
router.get('/declaration/pdf/:lawyerUserId', downloadLawyerDeclarationPdf);

export default router;
