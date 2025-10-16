// Test script for email API
const testEmailAPI = async () => {
  const baseUrl = 'http://localhost:5000';
  
  console.log('🧪 Testing Email API...\n');

  // Test 1: Health check
  try {
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${baseUrl}/api/email/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check passed:', healthData);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }

  // Test 2: Test with a real invoice ID (if any exist)
  try {
    console.log('\n2. Testing invoice email endpoint...');
    
    // First, get a list of invoices to find a real ID
    const invoicesResponse = await fetch(`${baseUrl}/api/invoices`);
    if (invoicesResponse.ok) {
      const invoicesData = await invoicesResponse.json();
      if (invoicesData.length > 0) {
        const testInvoiceId = invoicesData[0].id;
        console.log(`Using invoice ID: ${testInvoiceId}`);
        
        const emailResponse = await fetch(`${baseUrl}/api/email/invoice/${testInvoiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: 'test@example.com',
            customMessage: 'Test email message'
          })
        });
        
        if (emailResponse.ok) {
          const emailData = await emailResponse.json();
          console.log('✅ Invoice email test passed:', emailData.message);
        } else {
          const errorData = await emailResponse.text();
          console.log('❌ Invoice email test failed:', emailResponse.status, errorData);
        }
      } else {
        console.log('⚠️ No invoices found to test with');
      }
    } else {
      console.log('❌ Could not fetch invoices:', invoicesResponse.status);
    }
  } catch (error) {
    console.log('❌ Invoice email test failed:', error.message);
  }

  // Test 3: Test with a real quotation ID (if any exist)
  try {
    console.log('\n3. Testing quotation email endpoint...');
    
    const quotationsResponse = await fetch(`${baseUrl}/api/quotations`);
    if (quotationsResponse.ok) {
      const quotationsData = await quotationsResponse.json();
      if (quotationsData.length > 0) {
        const testQuotationId = quotationsData[0].id;
        console.log(`Using quotation ID: ${testQuotationId}`);
        
        const emailResponse = await fetch(`${baseUrl}/api/email/quotation/${testQuotationId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: 'test@example.com',
            customMessage: 'Test quotation email'
          })
        });
        
        if (emailResponse.ok) {
          const emailData = await emailResponse.json();
          console.log('✅ Quotation email test passed:', emailData.message);
        } else {
          const errorData = await emailResponse.text();
          console.log('❌ Quotation email test failed:', emailResponse.status, errorData);
        }
      } else {
        console.log('⚠️ No quotations found to test with');
      }
    } else {
      console.log('❌ Could not fetch quotations:', quotationsResponse.status);
    }
  } catch (error) {
    console.log('❌ Quotation email test failed:', error.message);
  }

  console.log('\n🏁 Email API testing completed!');
};

// Run the test
testEmailAPI().catch(console.error);
