import express from 'express';
import { getMessages, sendMessage } from '../controllers/barristerController.js';

const router = express.Router();

router.get('/:clientId', getMessages);
router.post('/send', sendMessage);

export default router;

