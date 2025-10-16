// Quick fix script for TRADIX ERP
const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔧 TRADIX ERP Quick Fix Script\n');

try {
  // Check if node_modules exists
  if (!fs.existsSync('node_modules')) {
    console.log('📦 Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed');
  } else {
    console.log('✅ Dependencies already installed');
  }

  // Check if server is running
  console.log('\n🔍 Checking server status...');
  try {
    const response = require('node-fetch')('http://localhost:5000/api/ai/health');
    if (response.ok) {
      console.log('✅ Server is already running');
    }
  } catch (error) {
    console.log('ℹ️  Server is not running. Starting server...');
    console.log('\n🚀 To start the server, run:');
    console.log('npm run dev');
    console.log('\n📧 To configure email, update the SMTP settings in package.json:');
    console.log('- SMTP_USER: your-email@gmail.com');
    console.log('- SMTP_PASS: your-app-password');
    console.log('- FROM_EMAIL: your-company@domain.com');
    console.log('- FROM_NAME: Your Company Name');
  }

  console.log('\n📋 Next Steps:');
  console.log('1. Update email settings in package.json');
  console.log('2. Run: npm run dev');
  console.log('3. Test AI features: node test-server.js');
  console.log('4. Test email: node test-email.js');
  
  console.log('\n🎉 Quick fix complete!');

} catch (error) {
  console.error('❌ Error:', error.message);
  console.log('\nManual steps:');
  console.log('1. Run: npm install');
  console.log('2. Update email settings in package.json');
  console.log('3. Run: npm run dev');
}
