// Test script to verify goods receipt creation with auto-generated receipt numbers
const testGoodsReceiptCreation = async () => {
  try {
    console.log('Testing goods receipt creation with auto-generated receipt numbers...');
    
    // First, get a supplier to use for testing
    const suppliersResponse = await fetch('http://localhost:5000/api/suppliers?limit=1');
    const suppliers = await suppliersResponse.json();
    
    if (!suppliers || suppliers.length === 0) {
      console.error('No suppliers found. Cannot test goods receipt creation.');
      return;
    }
    
    const supplierId = suppliers[0].id;
    console.log('Using supplier ID:', supplierId);
    
    // Test creating multiple goods receipts without specifying receipt numbers
    const testData1 = {
      supplierId: supplierId,
      receiptDate: new Date().toISOString().split('T')[0],
      receivedBy: 'test-user-1',
      status: 'Draft',
      notes: 'Test receipt 1 - auto-generated number'
    };
    
    const testData2 = {
      supplierId: supplierId,
      receiptDate: new Date().toISOString().split('T')[0],
      receivedBy: 'test-user-2',
      status: 'Draft',
      notes: 'Test receipt 2 - auto-generated number'
    };
    
    console.log('Creating first goods receipt...');
    const response1 = await fetch('http://localhost:5000/api/goods-receipt-headers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData1)
    });
    
    if (!response1.ok) {
      const error1 = await response1.text();
      console.error('Failed to create first goods receipt:', response1.status, error1);
      return;
    }
    
    const result1 = await response1.json();
    console.log('First goods receipt created successfully:', result1.receiptNumber);
    
    console.log('Creating second goods receipt...');
    const response2 = await fetch('http://localhost:5000/api/goods-receipt-headers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData2)
    });
    
    if (!response2.ok) {
      const error2 = await response2.text();
      console.error('Failed to create second goods receipt:', response2.status, error2);
      return;
    }
    
    const result2 = await response2.json();
    console.log('Second goods receipt created successfully:', result2.receiptNumber);
    
    console.log('✅ SUCCESS: Both goods receipts created with unique auto-generated receipt numbers!');
    console.log('Receipt 1:', result1.receiptNumber);
    console.log('Receipt 2:', result2.receiptNumber);
    
    // Verify they are different
    if (result1.receiptNumber === result2.receiptNumber) {
      console.error('❌ ERROR: Both receipts have the same receipt number!');
    } else {
      console.log('✅ Receipt numbers are unique as expected');
    }
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
};

// Run the test
testGoodsReceiptCreation();
