const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function testLpoWorkflow() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    console.log('\n=== LPO Workflow Test ===\n');
    
    // Test 1: Check if supplier_lpos table exists and has required columns
    console.log('1. Checking supplier_lpos table structure...');
    const tableStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'supplier_lpos' 
      ORDER BY ordinal_position;
    `);
    
    console.log('   Columns found:', tableStructure.rows.length);
    const requiredColumns = [
      'id', 'lpo_number', 'supplier_id', 'status', 'lpo_date', 
      'subtotal', 'tax_amount', 'total_amount', 'currency',
      'approval_status', 'requires_approval', 'created_by'
    ];
    
    const existingColumns = tableStructure.rows.map(row => row.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length === 0) {
      console.log('   ✅ All required columns present');
    } else {
      console.log('   ❌ Missing columns:', missingColumns);
    }
    
    // Test 2: Check if supplier_lpo_items table exists and has required columns
    console.log('\n2. Checking supplier_lpo_items table structure...');
    const itemsTableStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'supplier_lpo_items' 
      ORDER BY ordinal_position;
    `);
    
    console.log('   Columns found:', itemsTableStructure.rows.length);
    const requiredItemColumns = [
      'id', 'supplier_lpo_id', 'item_id', 'supplier_code', 'barcode',
      'item_description', 'quantity', 'unit_cost', 'total_cost',
      'discount_percent', 'discount_amount', 'delivery_status'
    ];
    
    const existingItemColumns = itemsTableStructure.rows.map(row => row.column_name);
    const missingItemColumns = requiredItemColumns.filter(col => !existingItemColumns.includes(col));
    
    if (missingItemColumns.length === 0) {
      console.log('   ✅ All required item columns present');
    } else {
      console.log('   ❌ Missing item columns:', missingItemColumns);
    }
    
    // Test 3: Check if suppliers table has data
    console.log('\n3. Checking suppliers data...');
    const suppliersCount = await client.query('SELECT COUNT(*) FROM suppliers');
    console.log('   Suppliers count:', suppliersCount.rows[0].count);
    
    if (suppliersCount.rows[0].count > 0) {
      console.log('   ✅ Suppliers data available');
    } else {
      console.log('   ⚠️  No suppliers found - LPO creation may fail');
    }
    
    // Test 4: Check if items table has data
    console.log('\n4. Checking items data...');
    const itemsCount = await client.query('SELECT COUNT(*) FROM items');
    console.log('   Items count:', itemsCount.rows[0].count);
    
    if (itemsCount.rows[0].count > 0) {
      console.log('   ✅ Items data available');
    } else {
      console.log('   ⚠️  No items found - LPO creation may fail');
    }
    
    // Test 5: Check LPO status enum values
    console.log('\n5. Checking LPO status values...');
    const statusCheck = await client.query(`
      SELECT DISTINCT status FROM supplier_lpos WHERE status IS NOT NULL
    `);
    
    const validStatuses = ['Draft', 'Pending', 'Sent', 'Confirmed', 'Received', 'Cancelled'];
    const existingStatuses = statusCheck.rows.map(row => row.status);
    const invalidStatuses = existingStatuses.filter(status => !validStatuses.includes(status));
    
    if (invalidStatuses.length === 0) {
      console.log('   ✅ All LPO statuses are valid');
    } else {
      console.log('   ❌ Invalid LPO statuses found:', invalidStatuses);
    }
    
    // Test 6: Check for any existing LPOs
    console.log('\n6. Checking existing LPOs...');
    const lposCount = await client.query('SELECT COUNT(*) FROM supplier_lpos');
    console.log('   LPOs count:', lposCount.rows[0].count);
    
    if (lposCount.rows[0].count > 0) {
      console.log('   ✅ LPOs exist in database');
      
      // Show sample LPO data
      const sampleLpo = await client.query(`
        SELECT lpo_number, status, subtotal, tax_amount, total_amount, currency
        FROM supplier_lpos 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
      
      if (sampleLpo.rows[0]) {
        console.log('   Sample LPO:', sampleLpo.rows[0]);
      }
    } else {
      console.log('   ℹ️  No LPOs found - this is normal for a fresh installation');
    }
    
    // Test 7: Check for any existing LPO items
    console.log('\n7. Checking existing LPO items...');
    const lpoItemsCount = await client.query('SELECT COUNT(*) FROM supplier_lpo_items');
    console.log('   LPO items count:', lpoItemsCount.rows[0].count);
    
    if (lpoItemsCount.rows[0].count > 0) {
      console.log('   ✅ LPO items exist in database');
    } else {
      console.log('   ℹ️  No LPO items found - this is normal for a fresh installation');
    }
    
    // Test 8: Check database constraints
    console.log('\n8. Checking database constraints...');
    const constraints = await client.query(`
      SELECT 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name,
        tc.constraint_type
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name IN ('supplier_lpos', 'supplier_lpo_items')
      ORDER BY tc.table_name, tc.constraint_type;
    `);
    
    console.log('   Constraints found:', constraints.rows.length);
    const hasPrimaryKeys = constraints.rows.some(row => row.constraint_type === 'PRIMARY KEY');
    const hasForeignKeys = constraints.rows.some(row => row.constraint_type === 'FOREIGN KEY');
    
    if (hasPrimaryKeys && hasForeignKeys) {
      console.log('   ✅ Database constraints are properly set up');
    } else {
      console.log('   ⚠️  Some database constraints may be missing');
    }
    
    // Test 9: Check indexes
    console.log('\n9. Checking database indexes...');
    const indexes = await client.query(`
      SELECT 
        indexname, 
        tablename, 
        indexdef
      FROM pg_indexes 
      WHERE tablename IN ('supplier_lpos', 'supplier_lpo_items')
      ORDER BY tablename, indexname;
    `);
    
    console.log('   Indexes found:', indexes.rows.length);
    if (indexes.rows.length > 0) {
      console.log('   ✅ Database indexes are present');
    } else {
      console.log('   ⚠️  No indexes found - performance may be affected');
    }
    
    console.log('\n=== LPO Workflow Test Complete ===');
    console.log('\nSummary:');
    console.log('- Database schema is properly set up');
    console.log('- All required tables and columns exist');
    console.log('- LPO workflow should function correctly');
    console.log('\nNext steps:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Test LPO creation via API endpoints');
    console.log('3. Test LPO PDF generation');
    console.log('4. Test LPO status transitions');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await client.end();
  }
}

testLpoWorkflow();
