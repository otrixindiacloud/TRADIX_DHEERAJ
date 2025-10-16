// Adds discount columns to enquiry_items if missing
// Usage: node run-enquiry-items-discount-migration.cjs

import { pool } from "./server/db.js";

async function columnExists(table, column) {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function main() {
  try {
    const hasPct = await columnExists('enquiry_items', 'discount_percent');
    const hasAmt = await columnExists('enquiry_items', 'discount_amount');

    if (!hasPct) {
      console.log("Adding enquiry_items.discount_percent ...");
      await pool.query(`ALTER TABLE enquiry_items ADD COLUMN discount_percent DECIMAL(5,2)`);
    }

    if (!hasAmt) {
      console.log("Adding enquiry_items.discount_amount ...");
      await pool.query(`ALTER TABLE enquiry_items ADD COLUMN discount_amount DECIMAL(10,2)`);
    }

    console.log("✅ Migration complete.");
  } catch (err) {
    console.error("Migration error:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();


