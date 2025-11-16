import express from 'express';
import { 
  registerBarrister, 
  submitEligibility, 
  uploadBarristerDocuments,
  saveProfessionalInfo,
  selectSubscription,
  confirmBarristerSubscription,
  submitLegalDeclarations,
  getBarristerByUserId,
  // Dashboard endpoints
  getBarristerDashboard,
  getBarristerEnquiries,
  getEnquiryById,
  acceptEnquiry,
  declineEnquiry,
  requestEnquiryInfo,
  createClientCareLetter,
  sendClientCareLetter,
  getBarristerProfile,
  updateBarristerProfile,
  getBarristerCompliance,
  uploadComplianceDocument,
  getMessages,
  sendMessage,
  getBilling,
  getResources,
  getBarristerAnalytics
} from '../controllers/barristerController.js';
import { uploadBarrister } from '../utils/fileUpload.js';

const router = express.Router();

// Configure multer for multiple file fields with 5MB limit
const uploadFields = uploadBarrister.fields([
  { name: 'practisingCertificate', maxCount: 1 },
  { name: 'publicAccessAccreditation', maxCount: 1 },
  { name: 'bmifInsurance', maxCount: 1 },
  { name: 'qualifiedPersonDocument', maxCount: 1 }
]);

// Stage 1: Register barrister account with eligibility check (combined)
router.post('/register', registerBarrister);

// Stage 2: Upload documents
router.post('/documents', uploadFields, uploadBarristerDocuments);

// Stage 3: Save professional information
router.post('/professional-info', saveProfessionalInfo);

// Stage 4: Select subscription plan
router.post('/subscription', selectSubscription);
router.post('/subscription/confirm', confirmBarristerSubscription);

// Stage 5: Submit legal declarations
router.post('/legal-declarations', submitLegalDeclarations);

// Legacy endpoints (for backward compatibility)
router.post('/eligibility', submitEligibility);
router.post('/upload-documents', uploadFields, uploadBarristerDocuments);

// Dashboard Homepage
router.get('/dashboard', getBarristerDashboard);

// Client Management (Enquiries)
router.get('/enquiries', getBarristerEnquiries);
router.get('/enquiries/:id', getEnquiryById);
router.post('/enquiries/:id/accept', acceptEnquiry);
router.post('/enquiries/:id/decline', declineEnquiry);
router.post('/enquiries/:id/request-info', requestEnquiryInfo);

// Client Care Letter
router.post('/client-care/create', createClientCareLetter);
router.post('/client-care/send', sendClientCareLetter);

// Profile Management
router.get('/profile', getBarristerProfile);
router.post('/profile/update', updateBarristerProfile);

// Compliance
router.get('/compliance', getBarristerCompliance);
router.post('/compliance/upload', uploadBarrister.single('document'), uploadComplianceDocument);

// Messages
router.get('/messages/:clientId', getMessages);
router.post('/messages/send', sendMessage);

// Billing
router.get('/billing', getBilling);

// Resources
router.get('/resources/list', getResources);

// Analytics
router.get('/analytics', getBarristerAnalytics);

// Get barrister by user ID (must be last to avoid route conflicts)
router.get('/:userId', getBarristerByUserId);

export default router;

