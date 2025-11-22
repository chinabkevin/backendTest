import express from 'express';
import { 
    registerCase, 
    getClientCases, 
    getFreelancerCases,
    getCaseById,
    getCaseByIdForUser,
    assignCaseToFreelancer, 
    updateCaseStatus,
    updateCaseDocument,
    getAvailableFreelancers,
    getCaseStats,
    referCase,
    getLawyerReferrals,
    respondToReferral,
    getBarristerReferrals
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
router.get('/client/:clientId', getClientCases);
router.get('/freelancer/:freelancerId', getFreelancerCases);
router.get('/:caseId', getCaseById);
router.get('/user/:userId/:caseId', getCaseByIdForUser);

// Case assignment and status updates
router.post('/assign/:caseId', assignCaseToFreelancer);
router.patch('/:caseId/status', updateCaseStatus);
router.patch('/:caseId/document', updateCaseDocument);

// Case referrals
router.post('/refer', referCase);
router.get('/referrals/lawyer/:lawyerId', getLawyerReferrals);
router.get('/referrals/barrister/:barristerId', getBarristerReferrals);
router.patch('/referrals/:referralId/respond', respondToReferral);

// Available freelancers and stats
router.get('/freelancers/available', getAvailableFreelancers);
router.get('/stats/:userType/:userId', getCaseStats);

export default router; 