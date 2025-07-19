import express from 'express';
import { 
  sendMessage,
  getUserSessions,
  getSession,
  deleteSession,
  updateSessionTitle,
  getAvailableModels,
  streamChat
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

export default router; 