/**
 * Test script to debug goods receipt creation issue
 */

import fetch from 'node-fetch';

async function testGoodsReceiptCreation() {
  try {
    console.log('🔍 Testing Goods Receipt Creation...');
    console.log('─'.repeat(60));
    
    // First, let's get existing suppliers and items
    console.log('📋 Step 1: Getting existing suppliers and items...');
    
    const suppliersResponse = await fetch('http://localhost:5000/api/suppliers');
    const suppliers = await suppliersResponse.json();
    console.log(`✅ Found ${suppliers.length} suppliers`);
    
    const itemsResponse = await fetch('http://localhost:5000/api/items');
    const items = await itemsResponse.json();
    console.log(`✅ Found ${items.length} items`);
    
    if (suppliers.length === 0) {
      console.log('❌ No suppliers found. Please create a supplier first.');
      return;
    }
    
    if (items.length === 0) {
      console.log('❌ No items found. Please create an item first.');
      return;
    }
    
    // Use the first supplier and item
    const supplier = suppliers[0];
    const item = items[0];
    
    console.log(`📄 Using Supplier: ${supplier.name} (${supplier.id})`);
    console.log(`📄 Using Item: ${item.description || item.itemName} (${item.id})`);
    
    // Test data for goods receipt
    const testData = {
      header: {
        receiptNumber: `GRN-${Date.now()}`,
        supplierId: supplier.id,
        receiptDate: "2025-01-14",
        status: "Draft",
        notes: "Test goods receipt"
      },
      items: [
        {
          itemId: item.id,
          itemDescription: item.description || item.itemName || "Test Item Description",
          quantityExpected: 10,
          quantityReceived: 10,
          unitCost: "100.00",
          totalCost: "1000.00",
          supplierCode: item.supplierCode || "TEST-001",
          barcode: item.barcode || "123456789"
        }
      ]
    };
    
    console.log('📋 Test data:', JSON.stringify(testData, null, 2));
    
    // Try to create goods receipt
    console.log('\n📋 Attempting to create goods receipt...');
    
    const response = await fetch('http://localhost:5000/api/goods-receipts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log(`Response body: ${responseText}`);
    
    if (response.ok) {
      console.log('✅ Goods receipt created successfully!');
    } else {
      console.log('❌ Goods receipt creation failed');
      try {
        const errorData = JSON.parse(responseText);
        console.log('Error details:', errorData);
      } catch (e) {
        console.log('Could not parse error response as JSON');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testGoodsReceiptCreation();
