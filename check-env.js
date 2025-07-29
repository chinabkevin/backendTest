import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔍 Checking environment variables for payment functionality...\n');

// Check required environment variables
const requiredVars = [
  'STRIPE_SECRET_KEY',
  'FRONTEND_URL',
  'DATABASE_URL'
];

let allSet = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${varName === 'STRIPE_SECRET_KEY' ? 'sk_***' + value.slice(-4) : value}`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
    allSet = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allSet) {
  console.log('🎉 All required environment variables are set!');
} else {
  console.log('⚠️  Some environment variables are missing.');
  console.log('\nTo fix this, add the missing variables to your .env file:');
  console.log('\nSTRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here');
  console.log('FRONTEND_URL=http://localhost:3000');
  console.log('DATABASE_URL=your_neon_database_url_here');
}

console.log('\n📋 Current working directory:', process.cwd());
console.log('📁 Looking for .env file at:', process.cwd() + '/.env');
