import express from 'express';
import { registerCase, getClientCases, assignCaseToFreelancer } from '../controllers/caseController.js';
import { userExists } from '../middleware/userExists.js';

const router = express.Router();

router.post('/', userExists, registerCase);
router.get('/client/:clientId', getClientCases);
router.post('/assign/:caseId', assignCaseToFreelancer);

export default router; 