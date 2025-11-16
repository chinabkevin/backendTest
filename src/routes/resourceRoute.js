import express from 'express';
import { getResources } from '../controllers/barristerController.js';

const router = express.Router();

router.get('/list', getResources);

export default router;

