/**
 * Test script to verify the invoice API endpoint is working
 */

const fetch = require('node-fetch');

async function testInvoiceAPI() {
  try {
    console.log('🔍 Testing Invoice API...');
    
    // Test with a sample invoice number - replace with actual invoice number from your system
    const testInvoiceNumber = 'INV-001'; // Change this to an actual invoice number
    
    console.log(`📋 Testing with invoice number: ${testInvoiceNumber}`);
    console.log('─'.repeat(50));
    
    const response = await fetch(`http://localhost:3000/api/invoices/complete/${testInvoiceNumber}`);
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }
    
    const result = await response.json();
    console.log('✅ API Response received');
    console.log('─'.repeat(50));
    
    if (result.success) {
      console.log('✅ Success:', result.success);
      console.log('📊 Data structure:');
      console.log('  - Invoice:', !!result.data.invoice);
      console.log('  - Customer:', !!result.data.customer);
      console.log('  - Sales Order:', !!result.data.salesOrder);
      console.log('  - Delivery:', !!result.data.delivery);
      console.log('  - Items count:', result.data.invoice?.items?.length || 0);
      
      if (result.data.invoice) {
        console.log('\n📄 Invoice Details:');
        console.log('  - Invoice Number:', result.data.invoice.invoiceNumber);
        console.log('  - Status:', result.data.invoice.status);
        console.log('  - Total Amount:', result.data.invoice.totalAmount);
        console.log('  - Currency:', result.data.invoice.currency);
      }
      
      if (result.data.customer) {
        console.log('\n👤 Customer Details:');
        console.log('  - Name:', result.data.customer.name);
        console.log('  - Email:', result.data.customer.email);
        console.log('  - Phone:', result.data.customer.phone);
      }
      
      if (result.data.invoice?.items?.length > 0) {
        console.log('\n📦 Items:');
        result.data.invoice.items.forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.description} - Qty: ${item.quantity} - Price: ${item.unitPrice}`);
        });
      }
      
    } else {
      console.error('❌ API returned error:', result.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('  1. Your server is running on http://localhost:3000');
    console.log('  2. The invoice number exists in your database');
    console.log('  3. The API endpoint is properly configured');
  }
}

// Run the test
console.log('🚀 Starting Invoice API Test');
console.log('Make sure your server is running on http://localhost:3000');
console.log('');

testInvoiceAPI();
