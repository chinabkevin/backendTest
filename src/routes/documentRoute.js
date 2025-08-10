import express from 'express';
import { upload } from '../utils/fileUpload.js';
import { 
    getCaseDocuments, 
    uploadCaseDocument, 
    deleteCaseDocument, 
    getDocumentDownloadUrl,
    getUserDocuments
} from '../controllers/documentController.js';

const router = express.Router();

// Get all documents for a user
router.get('/user', getUserDocuments);

// Get all documents for a case
router.get('/case/:caseId', getCaseDocuments);

// Upload document to case
router.post('/case/:caseId/upload', upload.single('document'), uploadCaseDocument);

// Delete document from case
router.delete('/case/:caseId/document/:documentId', deleteCaseDocument);

// Get document download URL
router.get('/case/:caseId/document/:documentId/download', getDocumentDownloadUrl);

export default router; 