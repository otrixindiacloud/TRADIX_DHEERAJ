// Test script for AI integration
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000';

async function testAIIntegration() {
  console.log('🤖 Testing AI Integration for TRADIX ERP...\n');

  try {
    // Test 1: AI Chat
    console.log('1. Testing AI Chat...');
    const chatResponse = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: "Show me recent enquiries",
        context: [],
        pageContext: { currentPage: '/dashboard' }
      })
    });
    
    if (chatResponse.ok) {
      const chatData = await chatResponse.json();
      console.log('✅ AI Chat working:', chatData.response.substring(0, 100) + '...');
    } else {
      console.log('❌ AI Chat failed:', chatResponse.status);
    }

    // Test 2: Field Suggestions
    console.log('\n2. Testing Field Suggestions...');
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
      console.log('❌ Field Suggestions failed:', suggestionsResponse.status);
    }

    // Test 3: Data Analysis
    console.log('\n3. Testing Data Analysis...');
    const analysisResponse = await fetch(`${API_BASE}/api/ai/insights/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataType: 'enquiries',
        data: [
          { id: 1, status: 'Active', customer: 'ABC Corp' },
          { id: 2, status: 'Pending', customer: 'XYZ Ltd' }
        ]
      })
    });
    
    if (analysisResponse.ok) {
      const analysisData = await analysisResponse.json();
      console.log('✅ Data Analysis working:', analysisData.insights.substring(0, 100) + '...');
    } else {
      console.log('❌ Data Analysis failed:', analysisResponse.status);
    }

    // Test 4: Error Analysis
    console.log('\n4. Testing Error Analysis...');
    const errorResponse = await fetch(`${API_BASE}/api/ai/error-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: "Validation failed: Customer ID is required",
        context: { formType: 'enquiry' }
      })
    });
    
    if (errorResponse.ok) {
      const errorData = await errorResponse.json();
      console.log('✅ Error Analysis working:', errorData.explanation.substring(0, 100) + '...');
    } else {
      console.log('❌ Error Analysis failed:', errorResponse.status);
    }

    // Test 5: Pricing Suggestions
    console.log('\n5. Testing Pricing Suggestions...');
    const pricingResponse = await fetch(`${API_BASE}/api/ai/pricing-suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: { costPrice: 100, category: 'Electronics' },
        marketContext: { customerType: 'retail' }
      })
    });
    
    if (pricingResponse.ok) {
      const pricingData = await pricingResponse.json();
      console.log('✅ Pricing Suggestions working:', `Suggested: $${pricingData.suggestedPrice}`);
    } else {
      console.log('❌ Pricing Suggestions failed:', pricingResponse.status);
    }

    console.log('\n🎉 AI Integration Test Complete!');
    console.log('\nTo start the server with AI features:');
    console.log('npm run dev');
    console.log('\nThen visit: http://localhost:5000');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nMake sure the server is running: npm run dev');
  }
}

testAIIntegration();
