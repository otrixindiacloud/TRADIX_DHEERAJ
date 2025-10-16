// Automated test: create enquiry item with percent only, verify percent and amount via API
// Usage: node test-enquiry-item-percent.mjs

import { db, pool } from './server/db.js';
import { enquiries, customers } from './shared/schema.js';
import fetch from 'node-fetch';

async function ensureCustomer() {
  const { rows } = await pool.query(`SELECT id FROM customers LIMIT 1`);
  if (rows.length) return rows[0].id;
  const res = await pool.query(`INSERT INTO customers (id, name, customer_type) VALUES (gen_random_uuid(), 'Test Customer', 'Retail') RETURNING id`);
  return res.rows[0].id;
}

async function ensureEnquiry() {
  const custId = await ensureCustomer();
  const res = await pool.query(`INSERT INTO enquiries (id, enquiry_number, customer_id, source) VALUES (gen_random_uuid(), $1, $2, 'Phone') RETURNING id`, [
    `ENQ-PCT-TEST-${Date.now()}`,
    custId
  ]);
  return res.rows[0].id;
}

async function main() {
  try {
    const enquiryId = await ensureEnquiry();

    // Create item via API with only discountPercent
    const respCreate = await fetch('http://localhost:3000/api/enquiry-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enquiryId,
        description: 'Percent Only',
        quantity: 10,
        unitPrice: 100,
        discountPercent: 5
      })
    });
    const created = await respCreate.json();

    // Fetch items via API and locate created row
    const respList = await fetch(`http://localhost:3000/api/enquiries/${enquiryId}/items`);
    const items = await respList.json();
    const item = items.find((i) => i.id === created.id);

    console.log('Item from API:', item);
    const pct = parseFloat(item.discountPercent);
    const amt = parseFloat(item.discountAmount);
    if (pct.toFixed(2) !== '5.00') throw new Error(`Expected 5.00% got ${pct}`);
    if (amt.toFixed(2) !== '50.00') throw new Error(`Expected 50.00 got ${amt}`);
    console.log('✅ Percent and amount correct.');
  } catch (e) {
    console.error('❌ Test failed:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();


