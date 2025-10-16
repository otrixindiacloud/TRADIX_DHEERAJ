const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkSupplierLposTable() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Check table structure
    const tableStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'supplier_lpos' 
      ORDER BY ordinal_position;
    `);

    console.log('supplier_lpos table structure:');
    tableStructure.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check for customer-related columns specifically
    const customerColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'supplier_lpos' 
      AND column_name ILIKE '%customer%'
      ORDER BY ordinal_position;
    `);

    console.log('\nCustomer-related columns:');
    if (customerColumns.rows.length === 0) {
      console.log('  No customer-related columns found');
    } else {
      customerColumns.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type}`);
      });
    }

    // Count records
    const count = await client.query('SELECT COUNT(*) FROM supplier_lpos');
    console.log(`\nNumber of supplier LPO records: ${count.rows[0].count}`);

  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkSupplierLposTable();