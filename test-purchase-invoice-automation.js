// Test script to verify Purchase Invoice automation
const { storage } = require('./server/storage');

async function testPurchaseInvoiceAutomation() {
  try {
    console.log('Testing Purchase Invoice Automation...');
    
    // First, let's create a test goods receipt
    console.log('1. Creating test goods receipt...');
    
    const goodsReceiptData = {
      receiptNumber: `TEST-GR-${Date.now()}`,
      supplierId: 'test-supplier-id', // You'll need to replace with actual supplier ID
      supplierLpoId: null,
      expectedDeliveryDate: new Date().toISOString().split('T')[0],
      actualDeliveryDate: new Date().toISOString().split('T')[0],
      status: 'Draft',
      notes: 'Test goods receipt for automation testing',
      createdBy: 'test-user'
    };
    
    // Create goods receipt header
    const goodsReceipt = await storage.createGoodsReceiptHeader(goodsReceiptData);
    console.log('✓ Goods receipt created:', goodsReceipt.id);
    
    // Create test goods receipt items
    console.log('2. Creating test goods receipt items...');
    
    const itemsData = [
      {
        receiptHeaderId: goodsReceipt.id,
        itemDescription: 'Test Item 1',
        quantityExpected: 10,
        quantityReceived: 10,
        unitCost: '100.00',
        totalCost: '1000.00',
        storageLocation: 'MAIN',
        condition: 'Good'
      },
      {
        receiptHeaderId: goodsReceipt.id,
        itemDescription: 'Test Item 2',
        quantityExpected: 5,
        quantityReceived: 5,
        unitCost: '50.00',
        totalCost: '250.00',
        storageLocation: 'MAIN',
        condition: 'Good'
      }
    ];
    
    for (const item of itemsData) {
      await storage.createGoodsReceiptItem(item);
    }
    console.log('✓ Goods receipt items created');
    
    // Now approve the goods receipt to trigger Purchase Invoice creation
    console.log('3. Approving goods receipt to trigger Purchase Invoice creation...');
    
    const approvedReceipt = await storage.approveGoodsReceipt(goodsReceipt.id, 'test-user');
    console.log('✓ Goods receipt approved:', approvedReceipt.id);
    
    // Check if Purchase Invoice was created
    console.log('4. Checking if Purchase Invoice was created...');
    
    const purchaseInvoices = await storage.getPurchaseInvoices();
    const createdInvoice = purchaseInvoices.find(inv => inv.goodsReceiptId === goodsReceipt.id);
    
    if (createdInvoice) {
      console.log('✓ Purchase Invoice automatically created!');
      console.log('  - Invoice ID:', createdInvoice.id);
      console.log('  - Invoice Number:', createdInvoice.invoiceNumber);
      console.log('  - Supplier Invoice Number:', createdInvoice.supplierInvoiceNumber);
      console.log('  - Total Amount:', createdInvoice.totalAmount);
      console.log('  - Status:', createdInvoice.status);
      
      // Get invoice items
      const invoiceItems = await storage.getPurchaseInvoiceItems(createdInvoice.id);
      console.log('  - Items count:', invoiceItems.length);
      
      console.log('\n🎉 SUCCESS: Purchase Invoice automation is working correctly!');
    } else {
      console.log('❌ FAILED: No Purchase Invoice was created automatically');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPurchaseInvoiceAutomation();
