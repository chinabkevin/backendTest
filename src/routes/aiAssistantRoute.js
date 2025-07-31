import express from 'express';
import { upload } from '../utils/fileUpload.js';
import { 
  sendMessage,
  getUserSessions,
  getSession,
  deleteSession,
  updateSessionTitle,
  getAvailableModels,
  streamChat,
  uploadDocuments,
  getSessionDocumentsController,
  deleteDocumentController
} from '../controllers/aiAssistantController.js';

const router = express.Router();

// Chat functionality
router.post('/chat', sendMessage);
router.post('/chat/stream', streamChat);

// Session management
router.get('/sessions', getUserSessions);
router.get('/sessions/:id', getSession);
router.delete('/sessions/:id', deleteSession);
router.put('/sessions/:id', updateSessionTitle);

// AI models
router.get('/models', getAvailableModels);

// Document upload and management
router.post('/upload-documents', upload.array('documents', 5), uploadDocuments);
router.get('/documents/:sessionId', getSessionDocumentsController);
router.delete('/documents/:documentId', deleteDocumentController);

export default router; 