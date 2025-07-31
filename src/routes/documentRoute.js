import express from 'express';
import { 
  generateDocument, 
  getUserDocuments, 
  getDocument, 
  deleteDocument,
  getDocumentTemplates,
  createDocumentPayment,
  verifyDocumentPayment,
  downloadDocument,
  getRecentDocuments
} from '../controllers/documentController.js';

const router = express.Router();

// GET /api/v1/documents/templates - Get available document templates
router.get('/templates', getDocumentTemplates);

// GET /api/v1/documents/recent - Get recent documents for user
router.get('/recent', getRecentDocuments);

// POST /api/v1/documents/generate - Generate a new document
router.post('/generate', generateDocument);

// GET /api/v1/documents/user - Get user's documents
router.get('/user', getUserDocuments);

// GET /api/v1/documents/:id - Get specific document
router.get('/:id', getDocument);

// POST /api/v1/documents/:id/create-payment - Create payment session for document
router.post('/:id/create-payment', createDocumentPayment);

// POST /api/v1/documents/:id/verify-payment - Verify payment and enable download
router.post('/:id/verify-payment', verifyDocumentPayment);

// GET /api/v1/documents/:id/download - Secure document download with payment verification
router.get('/:id/download', downloadDocument);

// DELETE /api/v1/documents/:id - Delete document (soft delete)
router.delete('/:id', deleteDocument);

export default router; 