import express from 'express';
import { syncUser, getUserRole, getUserBySupabaseId, getUserProfile, updateUserProfile } from '../controllers/userController.js';

const router = express.Router();

router.post('/sync', syncUser);
router.get('/role', getUserRole); // expects ?userId=123
router.get('/by-supabase-id', getUserBySupabaseId); // expects ?supabaseId=123
router.get('/profile', getUserProfile); // expects ?userId=123
router.put('/update', updateUserProfile); // expects userId, name, phone, address in body

export default router; 