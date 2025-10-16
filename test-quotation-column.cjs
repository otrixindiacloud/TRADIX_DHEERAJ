const { Pool } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testQuotationColumn() {
  try {
    console.log('Testing supplier quotation document column...');
    
    // Test the API endpoint
    const response = await fetch('http://localhost:5000/api/supplier-quotes?limit=5');
    const data = await response.json();
    
    console.log('API Response Status:', response.status);
    console.log('Number of quotes returned:', data.data?.length || 0);
    
    // Check if any quotes have the supplierQuotationDocument field
    const quotesWithDocs = data.data?.filter(quote => quote.supplierQuotationDocument) || [];
    console.log('Quotes with quotation documents:', quotesWithDocs.length);
    
    if (quotesWithDocs.length > 0) {
      console.log('Sample quote with document:');
      console.log('  Quote Number:', quotesWithDocs[0].quoteNumber);
      console.log('  Document:', quotesWithDocs[0].supplierQuotationDocument);
    }
    
    // Test specific quote ID
    const specificResponse = await fetch('http://localhost:5000/api/supplier-quotes/062bb67c-323d-485f-8ec7-404c59cc356c');
    const specificData = await specificResponse.json();
    
    console.log('\nSpecific quote test:');
    console.log('Quote Number:', specificData.quoteNumber);
    console.log('Has Document Field:', 'supplierQuotationDocument' in specificData);
    console.log('Document Value:', specificData.supplierQuotationDocument || 'null/undefined');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

testQuotationColumn();
