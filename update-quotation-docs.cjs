const { Pool } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function updateQuotationDocs() {
  try {
    console.log('Updating supplier quotation documents...');
    
    // Update a few quotes with sample quotation documents
    await pool.query(
      'UPDATE supplier_quotes SET supplier_quotation_document = $1 WHERE id = $2',
      ['https://example.com/quotation-1.pdf', '062bb67c-323d-485f-8ec7-404c59cc356c']
    );
    console.log('Updated quote 1');
    
    await pool.query(
      'UPDATE supplier_quotes SET supplier_quotation_document = $1 WHERE id = $2',
      ['https://example.com/quotation-2.pdf', '9c7e6692-ea8a-4c7e-8cd0-e25a31916797']
    );
    console.log('Updated quote 2');
    
    await pool.query(
      'UPDATE supplier_quotes SET supplier_quotation_document = $1 WHERE id = $2',
      ['/uploads/supplier-quotation-3.pdf', '8b32e244-f513-4577-aeac-b4b7a95cf5e8']
    );
    console.log('Updated quote 3');
    
    await pool.query(
      'UPDATE supplier_quotes SET supplier_quotation_document = $1 WHERE id = $2',
      ['https://supplier-docs.com/quote-4.pdf', '8ea9dd86-d860-4bef-bf91-083ede00bf2c']
    );
    console.log('Updated quote 4');
    
    // Verify the updates
    const result = await pool.query(
      'SELECT id, quote_number, supplier_quotation_document FROM supplier_quotes WHERE supplier_quotation_document IS NOT NULL LIMIT 5'
    );
    console.log('Updated quotes:');
    result.rows.forEach(row => {
      console.log(`  ${row.quote_number}: ${row.supplier_quotation_document}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

updateQuotationDocs();
