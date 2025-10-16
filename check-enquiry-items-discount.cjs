// Quick check for enquiry_items discount columns
// Usage: node check-enquiry-items-discount.cjs

const { pool } = require("./server/db.js");

async function main() {
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'enquiry_items'
       ORDER BY ordinal_position;`
    );

    const cols = rows.map(r => r.column_name);
    const hasPct = cols.includes("discount_percent");
    const hasAmt = cols.includes("discount_amount");

    console.log("enquiry_items columns:", cols.join(", "));
    console.log("discount_percent exists:", hasPct);
    console.log("discount_amount exists:", hasAmt);

    if (hasPct && hasAmt) {
      console.log("✅ Discount columns already present.");
    } else {
      console.log("⚠️  One or both discount columns are missing.");
      console.log("Run: node run-enquiry-items-discount-migration.cjs");
    }
  } catch (err) {
    console.error("Error checking enquiry_items columns:", err);
  } finally {
    await pool.end();
  }
}

main();


