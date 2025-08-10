import express from 'express';
import { registerFreelancer } from '../controllers/freelancerController.js';
import { getFreelancers, getFreelancerById, deleteFreelancer, updateFreelancerProfile, setFreelancerAvailability, getFreelancerEarnings, getFreelancerRatings, updateFreelancerCredentials, listFreelancerCases, getFreelancerCaseById, acceptCase, declineCase, completeCase, annotateCaseDocument, requestWithdrawal, searchFreelancers } from '../controllers/freelancerController.js';
import { userExists } from '../middleware/userExists.js';

const router = express.Router();

router.post('/register', userExists, registerFreelancer );
router.get('/', getFreelancers);
router.get('/search', searchFreelancers);
router.get('/:userId', getFreelancerById);
router.delete('/:userId', deleteFreelancer);
router.put('/update/:userId', updateFreelancerProfile);
router.post('/availability/:userId', setFreelancerAvailability);
router.get('/earnings/:userId', getFreelancerEarnings);
router.get('/ratings/:userId', getFreelancerRatings);
router.put('/credentials/:userId', updateFreelancerCredentials);

// --- CASE MANAGEMENT ---
router.get('/cases/:userId', listFreelancerCases);
router.get('/cases/:userId/:caseId', getFreelancerCaseById);
router.post('/cases/:caseId/accept', acceptCase);
router.post('/cases/:caseId/decline', declineCase);
router.post('/cases/:caseId/complete', completeCase);

// --- DOCUMENT ANNOTATION ---
router.post('/cases/:caseId/annotate', annotateCaseDocument);

// --- PAYMENTS ---
router.post('/withdraw/:userId', requestWithdrawal);


export default router;