import express from 'express';
import { 
    registerCase, 
    getClientCases, 
    getFreelancerCases,
    getBarristerCases,
    getCaseById,
    getCaseByIdForUser,
    assignCaseToFreelancer, 
    updateCaseStatus,
    updateCaseDocument,
    getAvailableFreelancers,
    getAvailableBarristers,
    getAvailableCases,
    getCaseStats,
    referCase,
    getLawyerReferrals,
    respondToReferral,
    getBarristerReferrals,
    acceptBarristerCase,
    rejectBarristerCase
} from '../controllers/caseController.js';
import { userExists } from '../middleware/userExists.js';
import { upload } from '../utils/fileUpload.js';

const router = express.Router();

// Test endpoint to debug FormData
router.post('/test', upload.single('document'), (req, res) => {
  console.log('Test endpoint - Request body:', req.body);
  console.log('Test endpoint - Request file:', req.file);
  res.json({ 
    success: true, 
    body: req.body, 
    file: req.file ? req.file.originalname : null 
  });
});

// Case registration and management
router.post('/', upload.single('document'), userExists, registerCase);

// Specific routes that must come before /:caseId to avoid route conflicts
router.get('/client/:clientId', getClientCases);
router.get('/freelancer/:freelancerId', getFreelancerCases);
router.get('/barrister/:barristerId', getBarristerCases);
router.get('/user/:userId/:caseId', getCaseByIdForUser);

// Available freelancers, barristers, cases and stats (must come before /:caseId)
router.get('/freelancers/available', getAvailableFreelancers);
router.get('/barristers/available', getAvailableBarristers);
router.get('/available', getAvailableCases);
router.get('/stats/:userType/:userId', getCaseStats);

// Case referrals (must come before /:caseId)
router.post('/refer', referCase);
router.get('/referrals/lawyer/:lawyerId', getLawyerReferrals);
router.get('/referrals/barrister/:barristerId', getBarristerReferrals);
router.patch('/referrals/:referralId/respond', respondToReferral);

// Case assignment and status updates (must come before /:caseId)
router.post('/assign/:caseId', assignCaseToFreelancer);
router.post('/:caseId/barrister/accept', acceptBarristerCase);
router.post('/:caseId/barrister/reject', rejectBarristerCase);
router.patch('/:caseId/status', updateCaseStatus);
router.patch('/:caseId/document', updateCaseDocument);

// Generic case route (must be last to avoid conflicts)
router.get('/:caseId', getCaseById);

export default router; 