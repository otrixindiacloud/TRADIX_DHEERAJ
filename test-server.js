// Test script to check if server is running and AI endpoints are working
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5000';

async function testServer() {
  console.log('🔍 Testing TRADIX ERP Server...\n');

  try {
    // Test 1: Basic server health
    console.log('1. Testing server health...');
    const healthResponse = await fetch(`${API_BASE}/api/ai/health`);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Server is running:', healthData);
    } else {
      console.log('❌ Server health check failed:', healthResponse.status);
      console.log('Make sure to run: npm run dev');
      return;
    }

    // Test 2: AI Chat endpoint
    console.log('\n2. Testing AI Chat...');
    const chatResponse = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "Hello, test message",
        context: [],
        pageContext: { currentPage: '/dashboard' }
      })
    });
    
    if (chatResponse.ok) {
      const chatData = await chatResponse.json();
      console.log('✅ AI Chat working:', chatData.response.substring(0, 50) + '...');
    } else {
      const errorText = await chatResponse.text();
      console.log('❌ AI Chat failed:', chatResponse.status);
      console.log('Error response:', errorText.substring(0, 200));
    }

    // Test 3: Field suggestions
    console.log('\n3. Testing Field Suggestions...');
    const suggestionsResponse = await fetch(`${API_BASE}/api/ai/suggestions/field`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldType: 'customer_name',
        context: { formType: 'enquiry' }
      })
    });
    
    if (suggestionsResponse.ok) {
      const suggestionsData = await suggestionsResponse.json();
      console.log('✅ Field Suggestions working:', suggestionsData.suggestions.slice(0, 3));
    } else {
      const errorText = await suggestionsResponse.text();
      console.log('❌ Field Suggestions failed:', suggestionsResponse.status);
      console.log('Error response:', errorText.substring(0, 200));
    }

    console.log('\n🎉 Server test complete!');
    console.log('\nIf all tests pass, your AI integration is working correctly.');
    console.log('If tests fail, make sure to:');
    console.log('1. Run: npm run dev');
    console.log('2. Check that the server is running on port 5000');
    console.log('3. Verify the OpenAI API key is set in package.json');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nMake sure the server is running: npm run dev');
  }
}

testServer();
