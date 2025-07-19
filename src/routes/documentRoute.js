import express from 'express';
import { 
  generateDocument, 
  getUserDocuments, 
  getDocument, 
  deleteDocument,
  getDocumentTemplates
} from '../controllers/documentController.js';

const router = express.Router();

// GET /api/v1/documents/templates - Get available document templates
router.get('/templates', getDocumentTemplates);

// POST /api/v1/documents/generate - Generate a new document
router.post('/generate', generateDocument);

// GET /api/v1/documents/user - Get user's documents
router.get('/user', getUserDocuments);

// GET /api/v1/documents/:id - Get specific document
router.get('/:id', getDocument);

// DELETE /api/v1/documents/:id - Delete document (soft delete)
router.delete('/:id', deleteDocument);

export default router; 