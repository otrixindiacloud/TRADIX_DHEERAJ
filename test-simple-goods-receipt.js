// Simple test for goods receipt creation with auto-generated receipt numbers
const testSimpleGoodsReceipt = async () => {
  try {
    console.log('Testing simple goods receipt creation...');
    
    // Test data without receipt number (should be auto-generated)
    const testData = {
      supplierId: "f2eccbc9-209c-48b0-a2a8-b6f5921b59ec", // Use a known supplier ID
      receiptDate: new Date().toISOString().split('T')[0],
      receivedBy: 'test-user',
      status: 'Draft',
      notes: 'Test receipt - auto-generated number'
    };
    
    console.log('Creating goods receipt with data:', testData);
    
    const response = await fetch('http://localhost:5000/api/goods-receipt-headers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to create goods receipt:', response.status, error);
      return;
    }
    
    const result = await response.json();
    console.log('✅ SUCCESS: Goods receipt created successfully!');
    console.log('Receipt Number:', result.receiptNumber);
    console.log('Full result:', result);
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
};

// Run the test
testSimpleGoodsReceipt();
