import express from 'express';
import multer from 'multer';
import { uploadProfileImage, removeProfileImage, getUserProfileImage } from '../controllers/profileController.js';
import fs from 'fs';

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/profile-images';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `profile-${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Profile image routes
router.post('/upload-image', upload.single('image'), uploadProfileImage);
router.delete('/remove-image', removeProfileImage);
router.get('/image/:userId', getUserProfileImage);

export default router; 