/**
 * Test script to demonstrate fetching complete invoice data by invoice number
 * This script shows how to use the new API endpoint to get all original data
 */

const fetch = require('node-fetch');

// Configuration
const API_BASE_URL = 'http://localhost:3000'; // Adjust if your server runs on a different port
const INVOICE_NUMBER = 'INV-001'; // Replace with an actual invoice number from your system

async function testCompleteInvoiceData() {
  try {
    console.log('🔍 Testing complete invoice data fetching...');
    console.log(`📋 Invoice Number: ${INVOICE_NUMBER}`);
    console.log('─'.repeat(50));

    // Fetch complete invoice data
    const response = await fetch(`${API_BASE_URL}/api/invoices/complete/${INVOICE_NUMBER}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Error:', errorData.message || 'Failed to fetch invoice data');
      return;
    }

    const result = await response.json();
    
    if (!result.success) {
      console.error('❌ API Error:', result.message);
      return;
    }

    const data = result.data;
    
    console.log('✅ Successfully fetched complete invoice data!');
    console.log('─'.repeat(50));
    
    // Display invoice information
    console.log('📄 INVOICE DETAILS:');
    console.log(`   Invoice Number: ${data.invoice.invoiceNumber}`);
    console.log(`   Invoice Type: ${data.invoice.invoiceType}`);
    console.log(`   Status: ${data.invoice.status}`);
    console.log(`   Currency: ${data.invoice.currency}`);
    console.log(`   Total Amount: ${data.invoice.totalAmount}`);
    console.log(`   Invoice Date: ${data.invoice.invoiceDate}`);
    console.log(`   Due Date: ${data.invoice.dueDate}`);
    
    // Display customer information
    if (data.customer) {
      console.log('\n👤 CUSTOMER DETAILS:');
      console.log(`   Name: ${data.customer.name || data.customer.companyName || 'N/A'}`);
      console.log(`   Email: ${data.customer.email || 'N/A'}`);
      console.log(`   Phone: ${data.customer.phone || 'N/A'}`);
      console.log(`   Address: ${data.customer.address || 'N/A'}`);
      console.log(`   Customer Type: ${data.customer.customerType || 'N/A'}`);
    } else {
      console.log('\n👤 CUSTOMER: Not found');
    }
    
    // Display sales order information
    if (data.salesOrder) {
      console.log('\n📦 SALES ORDER DETAILS:');
      console.log(`   Order Number: ${data.salesOrder.orderNumber}`);
      console.log(`   Status: ${data.salesOrder.status}`);
      console.log(`   Total Amount: ${data.salesOrder.totalAmount}`);
      console.log(`   Created: ${data.salesOrder.createdAt}`);
      
      if (data.salesOrder.items && data.salesOrder.items.length > 0) {
        console.log(`   Items (${data.salesOrder.items.length}):`);
        data.salesOrder.items.forEach((item, index) => {
          console.log(`     ${index + 1}. ${item.description} - Qty: ${item.quantity} - Price: ${item.unitPrice}`);
        });
      }
    } else {
      console.log('\n📦 SALES ORDER: Not linked');
    }
    
    // Display delivery information
    if (data.delivery) {
      console.log('\n🚚 DELIVERY DETAILS:');
      console.log(`   Delivery Number: ${data.delivery.deliveryNumber}`);
      console.log(`   Status: ${data.delivery.status}`);
      console.log(`   Delivery Date: ${data.delivery.deliveryDate}`);
      
      if (data.delivery.items && data.delivery.items.length > 0) {
        console.log(`   Items (${data.delivery.items.length}):`);
        data.delivery.items.forEach((item, index) => {
          console.log(`     ${index + 1}. ${item.description} - Delivered: ${item.deliveredQuantity}`);
        });
      }
    } else {
      console.log('\n🚚 DELIVERY: Not linked');
    }
    
    // Display invoice items
    console.log('\n📋 INVOICE ITEMS:');
    if (data.invoice.items && data.invoice.items.length > 0) {
      data.invoice.items.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.description}`);
        console.log(`      Barcode: ${item.barcode}`);
        console.log(`      Supplier Code: ${item.supplierCode}`);
        console.log(`      Quantity: ${item.quantity}`);
        console.log(`      Unit Price: ${item.unitPrice}`);
        console.log(`      Total Price: ${item.totalPrice}`);
        if (item.itemDetails) {
          console.log(`      Item Category: ${item.itemDetails.category || 'N/A'}`);
          console.log(`      Unit of Measure: ${item.itemDetails.unitOfMeasure || 'N/A'}`);
        }
        console.log('      ─'.repeat(30));
      });
    } else {
      console.log('   No items found');
    }
    
    // Display metadata
    console.log('\n📊 METADATA:');
    console.log(`   Total Items: ${data.metadata.totalItems}`);
    console.log(`   Has Sales Order: ${data.metadata.hasSalesOrder ? 'Yes' : 'No'}`);
    console.log(`   Has Delivery: ${data.metadata.hasDelivery ? 'Yes' : 'No'}`);
    console.log(`   Has Customer: ${data.metadata.hasCustomer ? 'Yes' : 'No'}`);
    console.log(`   Fetched At: ${data.metadata.fetchedAt}`);
    
    console.log('\n✅ Complete invoice data fetched successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
console.log('🚀 Starting Invoice Complete Data Test');
console.log('Make sure your server is running on', API_BASE_URL);
console.log('');

testCompleteInvoiceData();
