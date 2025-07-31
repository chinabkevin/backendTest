import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

console.log('🔍 Testing Simple Cloudinary Upload...\n');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function testSimpleUpload() {
  try {
    // Create a simple test image (1x1 pixel PNG)
    const testDir = 'uploads/test';
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    const testFilePath = path.join(testDir, 'test.png');
    const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(testFilePath, pngData);
    
    console.log('📤 Attempting simple upload...');
    
    // Try a very simple upload first
    const result = await cloudinary.uploader.upload(testFilePath, {
      folder: 'test',
      public_id: 'test-upload-' + Date.now()
    });
    
    console.log('✅ Simple upload successful!');
    console.log('Result:', {
      url: result.secure_url,
      public_id: result.public_id
    });
    
    // Clean up test file
    fs.unlinkSync(testFilePath);
    
    return true;
  } catch (error) {
    console.log('❌ Simple upload failed:', error.message);
    console.log('Error details:', error);
    return false;
  }
}

testSimpleUpload().then(success => {
  if (success) {
    console.log('\n✅ Cloudinary upload is working! The issue might be with specific upload parameters.');
  } else {
    console.log('\n❌ Cloudinary upload is still failing. Please check your credentials.');
  }
}); 