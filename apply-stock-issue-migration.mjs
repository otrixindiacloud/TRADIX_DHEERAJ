
import { Pool, neonConfig } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import ws from 'ws';

dotenv.config();
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    console.log('Applying migration: Make stock_issue fields nullable...');
    const statements = [
      "ALTER TABLE stock_issue ALTER COLUMN item_id DROP NOT NULL",
      "ALTER TABLE stock_issue ALTER COLUMN quantity DROP NOT NULL",
      `CREATE TABLE IF NOT EXISTS stock_issue_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        stock_issue_id UUID NOT NULL REFERENCES stock_issue(id) ON DELETE CASCADE,
        item_id UUID,
        item_description TEXT,
        quantity_issued INTEGER NOT NULL DEFAULT 0,
        unit_cost NUMERIC(10, 2) DEFAULT 0,
        total_cost NUMERIC(10, 2) DEFAULT 0,
        issue_reason TEXT,
        condition_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      "CREATE INDEX IF NOT EXISTS idx_stock_issue_items_stock_issue_id ON stock_issue_items(stock_issue_id)",
      "CREATE INDEX IF NOT EXISTS idx_stock_issue_items_item_id ON stock_issue_items(item_id)",
      "COMMENT ON TABLE stock_issue IS 'Material Issue table - stores header details for stock/material issues'",
      "COMMENT ON TABLE stock_issue_items IS 'Material Issue Items table - stores line items for each stock/material issue'",
      "COMMENT ON COLUMN stock_issue.item_id IS 'Legacy field - nullable to support wizard with multiple items in stock_issue_items'",
      "COMMENT ON COLUMN stock_issue.quantity IS 'Legacy field - nullable to support wizard with multiple items in stock_issue_items'"
    ];

    for (const statement of statements) {
      console.log(`Executing: ${statement}`);
      await pool.query(statement);
    }
    
    console.log('✅ Migration applied successfully!');
    console.log('');
    console.log('Tables updated:');
    console.log('  - stock_issue: item_id and quantity are now nullable');
    console.log('  - stock_issue_items: verified/created for storing line items');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
})();
