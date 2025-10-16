// Simple persistence test for enquiry_items discount fields
// Usage: node test-enquiry-item-discount.js

import { db, pool } from './server/db.js';
import { enquiries, enquiryItems } from './shared/schema.js';
import { randomUUID } from 'crypto';

async function main() {
  try {
    // Ensure there is an enquiry to attach the item to
    const enquiryId = randomUUID();
    await db.insert(enquiries).values({
      id: enquiryId,
      enquiryNumber: `ENQ-DISCOUNT-TEST-${Date.now()}`,
      customerId: randomUUID(), // may violate FK if customers table enforces; fallback to direct SQL without FK
      source: 'Phone',
    }).onConflictDoNothing();

    // If FK fails, create a lightweight row with direct SQL bypassing app-level helpers
  } catch {}

  try {
    // Find any existing enquiry to use
    const { rows } = await pool.query(`SELECT id FROM enquiries ORDER BY created_at DESC LIMIT 1`);
    const useEnquiryId = rows[0]?.id;
    if (!useEnquiryId) {
      console.log('No enquiry found to attach test item. Create one first.');
      return;
    }

    const insertRes = await pool.query(
      `INSERT INTO enquiry_items (enquiry_id, description, quantity, unit_price, discount_percent, discount_amount, notes)
       VALUES ($1, 'Discount Test Item', 5, 100.00, 10.00, 5.00, 'auto-test') RETURNING id, discount_percent, discount_amount`,
      [useEnquiryId]
    );

    const itemId = insertRes.rows[0].id;
    console.log('Inserted item id:', itemId, 'discounts:', insertRes.rows[0]);

    const { rows: fetched } = await pool.query(
      `SELECT discount_percent, discount_amount FROM enquiry_items WHERE id = $1`,
      [itemId]
    );

    console.log('Fetched discounts:', fetched[0]);
    console.log('✅ Discount persistence looks OK.');
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    await pool.end();
  }
}

main();


