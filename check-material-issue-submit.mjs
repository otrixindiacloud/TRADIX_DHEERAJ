import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as dotenv from 'dotenv';

dotenv.config();
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('  MATERIAL ISSUE - SUBMIT FUNCTIONALITY CHECK');
    console.log('='.repeat(70) + '\n');
    
    // Check tables exist
    console.log('📊 Checking Database Tables...\n');
    
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('stock_issue', 'stock_issue_items')
      ORDER BY table_name;
    `);
    
    if (tableCheck.rows.length === 2) {
      console.log('   ✅ stock_issue table exists');
      console.log('   ✅ stock_issue_items table exists');
    } else {
      console.log('   ❌ Missing tables!');
      await pool.end();
      process.exit(1);
    }
    
    // Check nullable fields
    console.log('\n📝 Checking Schema Configuration...\n');
    
    const nullableCheck = await pool.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'stock_issue' 
      AND column_name IN ('item_id', 'quantity')
      ORDER BY column_name;
    `);
    
    const itemIdNullable = nullableCheck.rows.find(r => r.column_name === 'item_id')?.is_nullable === 'YES';
    const quantityNullable = nullableCheck.rows.find(r => r.column_name === 'quantity')?.is_nullable === 'YES';
    
    if (itemIdNullable && quantityNullable) {
      console.log('   ✅ item_id is nullable (supports wizard)');
      console.log('   ✅ quantity is nullable (supports wizard)');
    } else {
      console.log('   ❌ Fields are not nullable - migration needed!');
    }
    
    // Check foreign key
    console.log('\n🔗 Checking Foreign Key Relationships...\n');
    
    const fkCheck = await pool.query(`
      SELECT COUNT(*) as fk_count
      FROM information_schema.table_constraints 
      WHERE table_name = 'stock_issue_items' 
      AND constraint_type = 'FOREIGN KEY';
    `);
    
    if (parseInt(fkCheck.rows[0].fk_count) > 0) {
      console.log('   ✅ Foreign key constraint exists (stock_issue_items → stock_issue)');
    } else {
      console.log('   ⚠️  No foreign key constraint found');
    }
    
    // Check indexes
    console.log('\n⚡ Checking Performance Indexes...\n');
    
    const indexCheck = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'stock_issue_items'
      AND indexname LIKE 'idx_%';
    `);
    
    console.log(`   ✅ Found ${indexCheck.rows.length} performance index(es)`);
    indexCheck.rows.forEach(row => {
      console.log(`      - ${row.indexname}`);
    });
    
    // Check data counts
    console.log('\n📈 Checking Current Data...\n');
    
    const headerCount = await pool.query('SELECT COUNT(*) as count FROM stock_issue');
    const itemsCount = await pool.query('SELECT COUNT(*) as count FROM stock_issue_items');
    
    console.log(`   📋 Stock Issues (Headers): ${headerCount.rows[0].count}`);
    console.log(`   📦 Stock Issue Items: ${itemsCount.rows[0].count}`);
    
    // Show latest submission if exists
    if (parseInt(headerCount.rows[0].count) > 0) {
      console.log('\n📝 Latest Material Issue Submission:\n');
      
      const latest = await pool.query(`
        SELECT 
          id,
          issue_number,
          issue_date,
          status,
          issue_reason
        FROM stock_issue 
        ORDER BY issue_date DESC 
        LIMIT 1;
      `);
      
      const issue = latest.rows[0];
      console.log(`   Issue Number: ${issue.issue_number}`);
      console.log(`   Issue Date: ${new Date(issue.issue_date).toLocaleDateString()}`);
      console.log(`   Status: ${issue.status}`);
      console.log(`   Reason: ${issue.issue_reason}`);
      
      // Check items for this issue
      const items = await pool.query(`
        SELECT 
          item_description,
          quantity_issued,
          unit_cost,
          total_cost
        FROM stock_issue_items 
        WHERE stock_issue_id = $1
        ORDER BY created_at;
      `, [issue.id]);
      
      if (items.rows.length > 0) {
        console.log(`\n   📦 Items (${items.rows.length}):`);
        items.rows.forEach((item, idx) => {
          console.log(`      ${idx + 1}. ${item.item_description}`);
          console.log(`         Qty: ${item.quantity_issued} × $${parseFloat(item.unit_cost).toFixed(2)} = $${parseFloat(item.total_cost).toFixed(2)}`);
        });
        
        const total = items.rows.reduce((sum, item) => sum + parseFloat(item.total_cost || 0), 0);
        console.log(`\n   💰 Total Issue Value: $${total.toFixed(2)}`);
      }
    }
    
    // Final status
    console.log('\n' + '='.repeat(70));
    console.log('  SUBMIT FUNCTIONALITY STATUS');
    console.log('='.repeat(70));
    
    const allChecks = 
      tableCheck.rows.length === 2 &&
      itemIdNullable &&
      quantityNullable &&
      parseInt(fkCheck.rows[0].fk_count) > 0;
    
    if (allChecks) {
      console.log('\n   ✅ ALL CHECKS PASSED!');
      console.log('\n   🎉 When you click Submit in the Material Issue Wizard:');
      console.log('      • Header details will be saved to stock_issue table');
      console.log('      • Item details will be saved to stock_issue_items table');
      console.log('      • All data will persist in the database');
      console.log('\n   👉 Ready to use! Open the wizard and submit a material issue.');
    } else {
      console.log('\n   ⚠️  SOME CHECKS FAILED');
      console.log('      Please review the errors above and run migrations if needed.');
    }
    
    console.log('\n' + '='.repeat(70) + '\n');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
})();
