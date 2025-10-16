import { db } from "./server/db";
import { sql } from "drizzle-orm";

try {
  // Check if stock_issue table exists (material_issue)
  const result = await db.execute(sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'stock_issue'
    ORDER BY ordinal_position;
  `);
  
  console.log('=== stock_issue table (material_issue) columns ===');
  if (result.rows.length === 0) {
    console.log('Table does not exist!');
  } else {
    console.log(result.rows);
  }
  
  // Check if stock_issue_items table exists (material_issue_items)
  const result2 = await db.execute(sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'stock_issue_items'
    ORDER BY ordinal_position;
  `);
  
  console.log('\n=== stock_issue_items table (material_issue_items) columns ===');
  if (result2.rows.length === 0) {
    console.log('Table does not exist!');
  } else {
    console.log(result2.rows);
  }
  
  process.exit(0);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
