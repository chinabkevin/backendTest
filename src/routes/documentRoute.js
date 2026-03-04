import express from 'express';
import rateLimit from 'express-rate-limit';
import { upload } from '../utils/fileUpload.js';
import { verifyDocumentPayment } from '../middleware/verifyPayment.js';
import {
    getCaseDocuments,
    uploadCaseDocument,
    deleteCaseDocument,
    getDocumentDownloadUrl,
    getAllDocuments,
    getUserDocuments,
    getDocumentById,
    generateDocument,
    createDocumentFromChat,
    documentPreview,
    documentDownload,
} from '../controllers/documentController.js';

const router = express.Router();

const previewLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many preview requests. Try again later.' },
});

// Generate a document using AI (unchanged)
router.post('/generate', generateDocument);

// Create a document from AI chat content (for paywall: preview → pay → download)
router.post('/from-chat', createDocumentFromChat);

// Paywall: preview (limited content + price) — rate limited
router.post('/preview', previewLimiter, documentPreview);

// Paywall: download only after payment — middleware enforces
router.get('/download/:id', verifyDocumentPayment, documentDownload);

// Get all documents (admin dashboard) — must be before /user and /:id
router.get('/all', getAllDocuments);

// Get all documents for a user
router.get('/user', getUserDocuments);

// Get single document by id (for View detail page; must be after /user so /user is not matched as :id)
router.get('/:id', getDocumentById);

// Get all documents for a case
router.get('/case/:caseId', getCaseDocuments);

// Upload document to case
router.post('/case/:caseId/upload', upload.single('document'), uploadCaseDocument);

// Delete document from case
router.delete('/case/:caseId/document/:documentId', deleteCaseDocument);

// Get document download URL
router.get('/case/:caseId/document/:documentId/download', getDocumentDownloadUrl);

export default router; 