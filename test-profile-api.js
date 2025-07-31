import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔍 Testing Profile Image API...\n');

// Test the profile image API endpoint
async function testProfileImageAPI() {
  try {
    // Replace with an actual user ID from your database
    const testUserId = 'your-test-user-id-here';
    
    console.log(`Testing profile image API for user: ${testUserId}`);
    
    const response = await fetch(`http://localhost:5001/api/profile/image/${testUserId}`);
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response:', data);
    } else {
      console.log('❌ API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

testProfileImageAPI(); 