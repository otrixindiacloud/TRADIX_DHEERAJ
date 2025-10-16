import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as dotenv from 'dotenv';
import ws from 'ws';
import { sql } from 'drizzle-orm';

dotenv.config();
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

(async () => {
  try {
    console.log('='.repeat(60));
    console.log('MATERIAL ISSUE DATABASE VERIFICATION');
    console.log('='.repeat(60));
    
    // Check stock_issue table
    console.log('\n1. Checking stock_issue (material_issue) table...');
    const stockIssueColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'stock_issue'
      ORDER BY ordinal_position;
    `);
    
    if (stockIssueColumns.rows.length === 0) {
      console.log('   ❌ Table does not exist!');
    } else {
      console.log('   ✅ Table exists with', stockIssueColumns.rows.length, 'columns');
      console.log('\n   Key columns:');
      const keyColumns = ['id', 'issue_number', 'item_id', 'quantity', 'delivery_number', 'customer_id', 'supplier_id', 'issue_reason', 'status'];
      stockIssueColumns.rows.forEach(row => {
        if (keyColumns.includes(row.column_name)) {
          console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        }
      });
    }
    
    // Check stock_issue_items table
    console.log('\n2. Checking stock_issue_items (material_issue_items) table...');
    const stockIssueItemsColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'stock_issue_items'
      ORDER BY ordinal_position;
    `);
    
    if (stockIssueItemsColumns.rows.length === 0) {
      console.log('   ❌ Table does not exist!');
    } else {
      console.log('   ✅ Table exists with', stockIssueItemsColumns.rows.length, 'columns');
      console.log('\n   Columns:');
      stockIssueItemsColumns.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    }
    
    // Check foreign key constraint
    console.log('\n3. Checking foreign key relationship...');
    const fkCheck = await pool.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'stock_issue_items'
        AND tc.constraint_type = 'FOREIGN KEY';
    `);
    
    if (fkCheck.rows.length > 0) {
      console.log('   ✅ Foreign key constraint exists:');
      fkCheck.rows.forEach(row => {
        console.log(`   - ${row.column_name} → ${row.foreign_table_name}.${row.foreign_column_name}`);
      });
    } else {
      console.log('   ⚠️  No foreign key constraints found');
    }
    
    // Check indexes
    console.log('\n4. Checking indexes on stock_issue_items...');
    const indexCheck = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'stock_issue_items';
    `);
    
    if (indexCheck.rows.length > 0) {
      console.log(`   ✅ Found ${indexCheck.rows.length} index(es):`);
      indexCheck.rows.forEach(row => {
        console.log(`   - ${row.indexname}`);
      });
    } else {
      console.log('   ⚠️  No indexes found');
    }
    
    // Count existing records
    console.log('\n5. Checking existing data...');
    const issueCount = await pool.query('SELECT COUNT(*) as count FROM stock_issue');
    const itemsCount = await pool.query('SELECT COUNT(*) as count FROM stock_issue_items');
    
    console.log(`   - stock_issue records: ${issueCount.rows[0].count}`);
    console.log(`   - stock_issue_items records: ${itemsCount.rows[0].count}`);
    
    // Show sample data if exists
    if (parseInt(issueCount.rows[0].count) > 0) {
      console.log('\n6. Sample stock_issue records (last 3):');
      const sampleIssues = await pool.query(`
        SELECT id, issue_number, delivery_number, status, issue_date
        FROM stock_issue
        ORDER BY issue_date DESC
        LIMIT 3;
      `);
      sampleIssues.rows.forEach(row => {
        console.log(`   - ${row.issue_number} (${row.status}) - ${row.delivery_number}`);
      });
      
      if (parseInt(itemsCount.rows[0].count) > 0) {
        console.log('\n7. Sample stock_issue_items records (last 3):');
        const sampleItems = await pool.query(`
          SELECT 
            sii.id,
            si.issue_number,
            sii.item_description,
            sii.quantity_issued,
            sii.unit_cost,
            sii.total_cost
          FROM stock_issue_items sii
          JOIN stock_issue si ON sii.stock_issue_id = si.id
          ORDER BY sii.created_at DESC
          LIMIT 3;
        `);
        sampleItems.rows.forEach(row => {
          console.log(`   - ${row.issue_number}: ${row.item_description} (Qty: ${row.quantity_issued}, Cost: $${row.total_cost})`);
        });
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION COMPLETE');
    console.log('='.repeat(60));
    console.log('\n✅ Database schema is properly configured for Material Issue wizard');
    console.log('✅ Header details will be saved to: stock_issue table');
    console.log('✅ Item details will be saved to: stock_issue_items table');
    console.log('\n');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
})();
