import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

// Load environment variables
dotenv.config();

console.log('🔍 Testing Cloudinary Configuration...\n');

// Check environment variables
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

console.log('Environment Variables:');
console.log(`CLOUDINARY_CLOUD_NAME: ${cloudName ? `✅ SET (${cloudName})` : '❌ MISSING'}`);
console.log(`CLOUDINARY_API_KEY: ${apiKey ? `✅ SET (${apiKey.substring(0, 8)}...)` : '❌ MISSING'}`);
console.log(`CLOUDINARY_API_SECRET: ${apiSecret ? `✅ SET (${apiSecret.substring(0, 8)}...)` : '❌ MISSING'}`);

if (!cloudName || !apiKey || !apiSecret) {
  console.log('\n❌ Missing required environment variables!');
  console.log('Please add the following to your .env file:');
  console.log('CLOUDINARY_CLOUD_NAME=your_cloud_name');
  console.log('CLOUDINARY_API_KEY=your_api_key');
  console.log('CLOUDINARY_API_SECRET=your_api_secret');
  process.exit(1);
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

console.log('\n🔧 Testing Cloudinary API connection...');

// Test the API connection
try {
  console.log('Attempting to ping Cloudinary API...');
  const result = await cloudinary.api.ping();
  console.log('✅ Cloudinary API connection successful!');
  console.log('Response:', result);
} catch (error) {
  console.log('❌ Cloudinary API connection failed!');
  console.log('Error:', error.message);
  console.log('Error details:', error);
  
  if (error.http_code === 401) {
    console.log('\n💡 This usually means:');
    console.log('1. Your API key or secret is incorrect');
    console.log('2. Your Cloudinary account is suspended');
    console.log('3. You\'ve exceeded your upload limits');
  }
  
  // Let's also try a simple upload test
  console.log('\n🔧 Testing with a simple upload...');
  try {
    // Create a simple test image (1x1 pixel PNG)
    const testImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    
    const uploadResult = await cloudinary.uploader.upload_stream(
      { folder: 'test' },
      (error, result) => {
        if (error) {
          console.log('❌ Upload test failed:', error);
        } else {
          console.log('✅ Upload test successful:', result);
        }
      }
    ).end(testImage);
    
  } catch (uploadError) {
    console.log('❌ Upload test failed:', uploadError.message);
  }
  
  process.exit(1);
}

console.log('\n✅ Cloudinary is properly configured and ready to use!');
console.log('You can now upload profile images through the application.'); 