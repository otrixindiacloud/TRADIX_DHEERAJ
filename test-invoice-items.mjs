import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function testInvoiceItems() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Get a sample purchase invoice with items
    const invoices = await client.query(`
      SELECT id, invoice_number, supplier_id 
      FROM purchase_invoices 
      LIMIT 5
    `);
    
    console.log('\nFound invoices:', invoices.rows.length);
    
    if (invoices.rows.length > 0) {
      const invoice = invoices.rows[0];
      console.log('\nTesting invoice:', invoice.invoice_number);
      
      // Get items for this invoice
      const items = await client.query(`
        SELECT 
          id, item_description, quantity, unit_price, total_price,
          barcode, supplier_code, unit_of_measure,
          storage_location, batch_number, expiry_date, condition,
          tax_rate, tax_amount, discount_rate, discount_amount,
          notes
        FROM purchase_invoice_items
        WHERE purchase_invoice_id = $1
        ORDER BY item_description
      `, [invoice.id]);
      
      console.log('\nItems found:', items.rows.length);
      if (items.rows.length > 0) {
        console.log('\nSample item data:');
        console.log(JSON.stringify(items.rows[0], null, 2));
      } else {
        console.log('\nNo items found for this invoice');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

testInvoiceItems();
