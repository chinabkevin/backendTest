import express from 'express';
import { getMessages, sendMessage, getConversations, markMessagesAsRead } from '../controllers/barristerController.js';

const router = express.Router();

router.get('/conversations', getConversations);
router.get('/:otherUserId', getMessages);
router.post('/send', sendMessage);
router.patch('/read', markMessagesAsRead);

export default router;

