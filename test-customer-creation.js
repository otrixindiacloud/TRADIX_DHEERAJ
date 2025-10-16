// Simple test script to debug customer creation
// Run with: node test-customer-creation.js

const testCustomerCreation = async () => {
  const baseUrl = 'http://localhost:5000'; // Adjust if your server runs on different port
  
  const testData = {
    name: `Test Customer ${Date.now()}`,
    email: `test${Date.now()}@example.com`,
    phone: '1234567890',
    address: 'Test Address',
    customerType: 'Retail',
    classification: 'Individual',
    taxId: 'TAX123',
    creditLimit: '1000',
    paymentTerms: 'Net 30',
    isActive: true
  };

  console.log('Testing customer creation with data:', JSON.stringify(testData, null, 2));

  try {
    const response = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const result = await response.json();
    console.log('Response body:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('✅ Customer created successfully!');
    } else {
      console.log('❌ Customer creation failed');
      console.log('Error message:', result.message);
      console.log('Error details:', result.details);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
};

// Test with minimal data
const testMinimalCustomerCreation = async () => {
  const baseUrl = 'http://localhost:5000';
  
  const minimalData = {
    name: `Minimal Test ${Date.now()}`,
    customerType: 'Retail',
    classification: 'Individual'
  };

  console.log('\nTesting with minimal data:', JSON.stringify(minimalData, null, 2));

  try {
    const response = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(minimalData)
    });

    console.log('Response status:', response.status);
    const result = await response.json();
    console.log('Response body:', JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('✅ Minimal customer created successfully!');
    } else {
      console.log('❌ Minimal customer creation failed');
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
};

// Test duplicate detection
const testDuplicateDetection = async () => {
  const baseUrl = 'http://localhost:5000';
  
  const duplicateData = {
    name: 'Duplicate Test Customer',
    customerType: 'Retail',
    classification: 'Individual'
  };

  console.log('\nTesting duplicate detection...');

  try {
    // First creation
    console.log('Creating first customer...');
    const response1 = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(duplicateData)
    });

    console.log('First creation status:', response1.status);
    const result1 = await response1.json();
    console.log('First creation result:', result1.message);

    // Second creation (should fail)
    console.log('Creating duplicate customer...');
    const response2 = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(duplicateData)
    });

    console.log('Second creation status:', response2.status);
    const result2 = await response2.json();
    console.log('Second creation result:', result2.message);

    if (response2.status === 409) {
      console.log('✅ Duplicate detection working correctly!');
    } else {
      console.log('❌ Duplicate detection not working properly');
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
};

// Run all tests
const runAllTests = async () => {
  console.log('🧪 Starting customer creation tests...\n');
  
  await testCustomerCreation();
  await testMinimalCustomerCreation();
  await testDuplicateDetection();
  
  console.log('\n🏁 Tests completed!');
};

// Check if running directly
if (typeof window === 'undefined') {
  runAllTests().catch(console.error);
}

module.exports = { testCustomerCreation, testMinimalCustomerCreation, testDuplicateDetection };
