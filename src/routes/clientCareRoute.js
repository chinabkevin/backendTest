import express from 'express';
import { createClientCareLetter, sendClientCareLetter } from '../controllers/barristerController.js';

const router = express.Router();

router.post('/create', createClientCareLetter);
router.post('/send', sendClientCareLetter);

export default router;

