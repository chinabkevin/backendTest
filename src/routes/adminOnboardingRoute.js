import express from 'express';
import { requireAdminKey } from '../middleware/requireAdminKey.js';
import {
  adminListLawyersOnboarding,
  adminGetLawyerDeclaration,
  adminApproveLawyer,
  adminRejectLawyer,
} from '../controllers/lawyerDeclarationController.js';

const router = express.Router();

router.use(requireAdminKey);

router.get('/onboarding/lawyers', adminListLawyersOnboarding);
router.get('/onboarding/lawyers/:userId/declaration', adminGetLawyerDeclaration);
router.post('/onboarding/lawyers/:userId/approve', adminApproveLawyer);
router.post('/onboarding/lawyers/:userId/reject', adminRejectLawyer);

export default router;
