import express from 'express';
import { getBilling } from '../controllers/barristerController.js';

const router = express.Router();

router.get('/', getBilling);

export default router;

