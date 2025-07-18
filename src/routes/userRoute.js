import express from 'express';
import { syncUser, getUserRole } from '../controllers/userController.js';

const router = express.Router();

router.post('/sync', syncUser);
router.get('/role', getUserRole); // expects ?userId=123

export default router; 