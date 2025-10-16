/**
 * Test script to verify receipt creation with items
 */

const fetch = require('node-fetch');

async function testReceiptCreation() {
  try {
    console.log('🔍 Testing Receipt Creation...');
    console.log('─'.repeat(50));
    
    // Sample receipt data with items
    const receiptData = {
      receiptNumber: `TEST-REC-${Date.now()}`,
      supplierLpoId: "test-lpo-id", // Replace with actual LPO ID
      supplierId: "test-supplier-id", // Replace with actual supplier ID
      receiptDate: new Date().toISOString().split('T')[0],
      receivedBy: "Test User",
      status: "Pending",
      notes: "Test receipt creation",
      items: [
        {
          itemDescription: "Test Item 1",
          quantity: 2,
          unitCost: 100.00,
          totalPrice: 200.00,
          barcode: "TEST001",
          supplierCode: "SUP001"
        },
        {
          itemDescription: "Test Item 2", 
          quantity: 1,
          unitCost: 50.00,
          totalPrice: 50.00,
          barcode: "TEST002",
          supplierCode: "SUP002"
        }
      ]
    };
    
    console.log('📋 Creating receipt with data:', JSON.stringify(receiptData, null, 2));
    
    const response = await fetch('http://localhost:3000/api/receipts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(receiptData)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Receipt created successfully!');
    console.log('─'.repeat(50));
    console.log('📄 Receipt Details:');
    console.log('  - ID:', result.id);
    console.log('  - Receipt Number:', result.receiptNumber);
    console.log('  - Status:', result.status);
    console.log('  - Total Items:', result.totalItems);
    console.log('  - Total Quantity Expected:', result.totalQuantityExpected);
    console.log('  - Total Quantity Received:', result.totalQuantityReceived);
    
    // Now test fetching all receipts to see if it appears
    console.log('\n🔍 Testing receipt retrieval...');
    const getResponse = await fetch('http://localhost:3000/api/receipts');
    
    if (getResponse.ok) {
      const receipts = await getResponse.json();
      console.log(`✅ Found ${receipts.length} receipts in database`);
      
      const createdReceipt = receipts.find(r => r.id === result.id);
      if (createdReceipt) {
        console.log('✅ Created receipt found in database');
        console.log('  - Items count:', createdReceipt.items?.length || 0);
        if (createdReceipt.items?.length > 0) {
          console.log('  - First item:', createdReceipt.items[0]);
        }
      } else {
        console.log('❌ Created receipt not found in database');
      }
    } else {
      console.log('❌ Failed to fetch receipts');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('  1. Your server is running on http://localhost:3000');
    console.log('  2. The database is properly configured');
    console.log('  3. The supplier and LPO IDs exist in your database');
  }
}

// Run the test
console.log('🚀 Starting Receipt Creation Test');
console.log('Make sure your server is running on http://localhost:3000');
console.log('');

testReceiptCreation();
