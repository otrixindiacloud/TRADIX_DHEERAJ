const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function testLpoDiscountFix() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Check if discount columns exist
    const checkColumns = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'supplier_lpo_items' 
      AND column_name IN ('discount_percent', 'discount_amount')
      ORDER BY column_name
    `);
    
    console.log('Discount columns in supplier_lpo_items:');
    checkColumns.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (default: ${row.column_default})`);
    });
    
    // Check if there are any existing LPO items with discount data
    const existingItems = await client.query(`
      SELECT id, item_description, discount_percent, discount_amount, unit_cost, total_cost
      FROM supplier_lpo_items 
      WHERE discount_percent > 0 OR discount_amount > 0
      LIMIT 5
    `);
    
    console.log(`\nFound ${existingItems.rows.length} LPO items with discount data:`);
    existingItems.rows.forEach(item => {
      console.log(`- ${item.item_description}: ${item.discount_percent}% discount, ${item.discount_amount} amount`);
    });
    
    // Test creating an LPO item with discount data
    console.log('\nTesting LPO item creation with discount data...');
    
    // First, get a supplier LPO ID
    const lpoResult = await client.query(`
      SELECT id FROM supplier_lpos LIMIT 1
    `);
    
    if (lpoResult.rows.length > 0) {
      const lpoId = lpoResult.rows[0].id;
      
      // Insert a test LPO item with discount
      const insertResult = await client.query(`
        INSERT INTO supplier_lpo_items (
          supplier_lpo_id, supplier_code, barcode, item_description, 
          quantity, unit_cost, total_cost, discount_percent, discount_amount,
          line_number, delivery_status
        ) VALUES (
          $1, 'TEST-SUP', 'TEST-ITEM-001', 'Test Item with Discount',
          10, 100.00, 1000.00, 15.00, 50.00,
          1, 'Pending'
        ) RETURNING id, discount_percent, discount_amount
      `, [lpoId]);
      
      console.log('Created test LPO item with discount:');
      console.log(`- ID: ${insertResult.rows[0].id}`);
      console.log(`- Discount %: ${insertResult.rows[0].discount_percent}%`);
      console.log(`- Discount Amount: ${insertResult.rows[0].discount_amount}`);
      
      // Clean up test data
      await client.query(`
        DELETE FROM supplier_lpo_items WHERE id = $1
      `, [insertResult.rows[0].id]);
      
      console.log('Test data cleaned up');
    } else {
      console.log('No supplier LPOs found to test with');
    }
    
    await client.end();
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testLpoDiscountFix();
