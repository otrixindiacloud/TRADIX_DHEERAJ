/**
 * Test script to verify the complete receipt creation and display flow
 */

import fetch from 'node-fetch';

async function testReceiptFlow() {
  try {
    console.log('🔍 Testing Complete Receipt Flow...');
    console.log('─'.repeat(50));
    
    // Step 1: Check if API is running
    console.log('1. Testing API connectivity...');
    try {
      const healthResponse = await fetch('http://localhost:5000/api/receipts');
      console.log('✅ API is running, status:', healthResponse.status);
    } catch (error) {
      console.error('❌ API is not running:', error.message);
      console.log('Please start your server with: npm run dev');
      return;
    }
    
    // Step 2: Create a test receipt
    console.log('\n2. Creating test receipt...');
    const receiptData = {
      receiptNumber: `TEST-REC-${Date.now()}`,
      supplierLpoId: "test-lpo-id",
      supplierId: "test-supplier-id", 
      receiptDate: new Date().toISOString().split('T')[0],
      receivedBy: "Test User",
      status: "Pending",
      notes: "Test receipt from automated test",
      items: [
        {
          itemDescription: "Test Product 1",
          quantity: 5,
          unitCost: 25.50,
          totalPrice: 127.50,
          barcode: "TEST001",
          supplierCode: "SUP001"
        },
        {
          itemDescription: "Test Product 2",
          quantity: 3,
          unitCost: 15.75,
          totalPrice: 47.25,
          barcode: "TEST002", 
          supplierCode: "SUP002"
        }
      ]
    };
    
    const createResponse = await fetch('http://localhost:5000/api/receipts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(receiptData)
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('❌ Failed to create receipt:', errorText);
      return;
    }
    
    const createdReceipt = await createResponse.json();
    console.log('✅ Receipt created successfully!');
    console.log('   - ID:', createdReceipt.id);
    console.log('   - Receipt Number:', createdReceipt.receiptNumber);
    console.log('   - Status:', createdReceipt.status);
    console.log('   - Total Items:', createdReceipt.totalItems);
    
    // Step 3: Fetch all receipts to verify it appears
    console.log('\n3. Fetching all receipts...');
    const getResponse = await fetch('http://localhost:5000/api/receipts');
    
    if (!getResponse.ok) {
      console.error('❌ Failed to fetch receipts');
      return;
    }
    
    const allReceipts = await getResponse.json();
    console.log(`✅ Found ${allReceipts.length} receipts in database`);
    
    // Step 4: Find our created receipt
    const ourReceipt = allReceipts.find(r => r.id === createdReceipt.id);
    if (ourReceipt) {
      console.log('✅ Our receipt found in database!');
      console.log('   - Receipt Number:', ourReceipt.receiptNumber);
      console.log('   - Status:', ourReceipt.status);
      console.log('   - Items count:', ourReceipt.items?.length || 0);
      console.log('   - Total Items field:', ourReceipt.totalItems);
      
      if (ourReceipt.items && ourReceipt.items.length > 0) {
        console.log('   - Items details:');
        ourReceipt.items.forEach((item, index) => {
          console.log(`     ${index + 1}. ${item.itemDescription} - Qty: ${item.quantityExpected} - Cost: ${item.unitCost}`);
        });
      } else {
        console.log('   ⚠️  No items found in receipt');
      }
    } else {
      console.log('❌ Our receipt not found in database');
    }
    
    // Step 5: Test frontend data structure
    console.log('\n4. Testing frontend data structure...');
    console.log('Sample receipt structure for frontend:');
    if (allReceipts.length > 0) {
      const sample = allReceipts[0];
      console.log('   - Has receiptNumber:', !!sample.receiptNumber);
      console.log('   - Has status:', !!sample.status);
      console.log('   - Has receivedBy:', !!sample.receivedBy);
      console.log('   - Has receiptDate:', !!sample.receiptDate);
      console.log('   - Has items array:', Array.isArray(sample.items));
      console.log('   - Items count:', sample.items?.length || 0);
      console.log('   - Has totalItems field:', typeof sample.totalItems === 'number');
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('If the frontend is not showing data, check:');
    console.log('1. Browser console for any errors');
    console.log('2. Network tab to see if API calls are successful');
    console.log('3. React Query devtools to see query states');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('  1. Your server is running on http://localhost:5000');
    console.log('  2. The database is properly configured');
    console.log('  3. All required tables exist');
  }
}

// Run the test
console.log('🚀 Starting Complete Receipt Flow Test');
console.log('Make sure your server is running on http://localhost:5000');
console.log('');

testReceiptFlow();
