// Test script for email functionality
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:5000';

async function testEmail() {
  console.log('📧 Testing Email Functionality...\n');

  try {
    // Test 1: Check if server is running
    console.log('1. Checking server status...');
    const healthResponse = await fetch(`${API_BASE}/api/ai/health`);
    
    if (!healthResponse.ok) {
      console.log('❌ Server is not running. Please run: npm run dev');
      return;
    }
    console.log('✅ Server is running');

    // Test 2: Test email configuration
    console.log('\n2. Testing email configuration...');
    
    // First, let's check if we have any invoices to test with
    const invoicesResponse = await fetch(`${API_BASE}/api/invoices`);
    if (invoicesResponse.ok) {
      const invoices = await invoicesResponse.json();
      console.log(`Found ${invoices.length} invoices in the system`);
      
      if (invoices.length > 0) {
        const testInvoiceId = invoices[0].id;
        console.log(`Testing with invoice ID: ${testInvoiceId}`);
        
        // Test 3: Test invoice email preparation
        console.log('\n3. Testing invoice email preparation...');
        const emailResponse = await fetch(`${API_BASE}/api/email/invoice/${testInvoiceId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            customMessage: 'This is a test email from TRADIX ERP'
          })
        });
        
        if (emailResponse.ok) {
          const emailData = await emailResponse.json();
          console.log('✅ Invoice email prepared successfully');
          console.log('Email data:', {
            customerEmail: emailData.data.customerEmail,
            documentNumber: emailData.data.documentNumber,
            hasPdf: !!emailData.data.pdfDataUrl
          });
        } else {
          const errorText = await emailResponse.text();
          console.log('❌ Invoice email preparation failed:', emailResponse.status);
          console.log('Error:', errorText.substring(0, 200));
        }
      } else {
        console.log('ℹ️  No invoices found. Create an invoice first to test email functionality.');
      }
    } else {
      console.log('❌ Could not fetch invoices:', invoicesResponse.status);
    }

    // Test 4: Test quotations
    console.log('\n4. Testing quotation email...');
    const quotationsResponse = await fetch(`${API_BASE}/api/quotations`);
    if (quotationsResponse.ok) {
      const quotations = await quotationsResponse.json();
      console.log(`Found ${quotations.length} quotations in the system`);
      
      if (quotations.length > 0) {
        const testQuotationId = quotations[0].id;
        console.log(`Testing with quotation ID: ${testQuotationId}`);
        
        const quotationEmailResponse = await fetch(`${API_BASE}/api/email/quotation/${testQuotationId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            customMessage: 'Please review our quotation'
          })
        });
        
        if (quotationEmailResponse.ok) {
          const quotationEmailData = await quotationEmailResponse.json();
          console.log('✅ Quotation email prepared successfully');
          console.log('Email data:', {
            customerEmail: quotationEmailData.data.customerEmail,
            documentNumber: quotationEmailData.data.documentNumber,
            hasPdf: !!quotationEmailData.data.pdfDataUrl
          });
        } else {
          console.log('❌ Quotation email preparation failed:', quotationEmailResponse.status);
        }
      }
    }

    console.log('\n🎉 Email test complete!');
    console.log('\nNext steps:');
    console.log('1. Configure your email settings in package.json or .env file');
    console.log('2. Update SMTP credentials for your email provider');
    console.log('3. Test sending actual emails from the application');

  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    console.log('\nMake sure the server is running: npm run dev');
  }
}

testEmail();
