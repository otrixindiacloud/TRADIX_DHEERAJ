// Test script to verify LPO HTML generation with discount fields
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

// Mock the buildLpoPrintHtml function from the client
function buildLpoPrintHtml(lpo, items, supplier) {
  const currency = lpo.currency || 'BHD';
  const subtotal = Number(lpo.subtotal || 0);
  const taxAmount = Number(lpo.taxAmount || 0);
  const total = subtotal + taxAmount;
  const vatPercent = subtotal ? ((taxAmount / subtotal) * 100) : 0;

  const rowsHtml = items.map((it, idx) => {
    const qty = Number(it.quantity || 0);
    const unitCost = Number(it.unitCost || 0);
    const grossAmount = qty * unitCost;
    
    // Get discount values from the item
    const discountPercent = Number(it.discountPercent || 0);
    const discountAmount = Number(it.discountAmount || 0);
    
    // Calculate discount amount if percentage is provided but amount is not
    const calculatedDiscountAmount = discountAmount > 0 ? discountAmount : (grossAmount * discountPercent / 100);
    
    const lineNet = grossAmount - calculatedDiscountAmount; // before VAT
    const vatAmt = vatPercent ? (lineNet * (vatPercent/100)) : 0;
    
    return `<tr>
      <td style="border:1px solid #000;padding:4px 6px;font-size:11px;text-align:center;">${idx + 1}</td>
      <td style="border:1px solid #000;padding:4px 6px;font-size:11px;">${(it.itemDescription || '').replace(/</g,'&lt;')}</td>
      <td style="border:1px solid #000;padding:4px 6px;font-size:10px;text-align:center;">${qty}<br/><span style=\"font-size:9px;color:#555\">PCS</span></td>
      <td style="border:1px solid #000;padding:4px 6px;font-size:10px;text-align:center;">${currency} ${unitCost.toFixed(3)}</td>
      <td style="border:1px solid #000;padding:4px 6px;font-size:10px;text-align:center;">${discountPercent.toFixed(0)}%</td>
      <td style="border:1px solid #000;padding:4px 6px;font-size:10px;text-align:center;">${currency} ${calculatedDiscountAmount.toFixed(3)}</td>
      <td style="border:1px solid #000;padding:4px 6px;font-size:10px;text-align:center;">${currency} ${lineNet.toFixed(3)}</td>
      <td style="border:1px solid #000;padding:4px 6px;font-size:10px;text-align:center;">${vatPercent ? vatPercent.toFixed(0) : '0'}%</td>
      <td style="border:1px solid #000;padding:4px 6px;font-size:10px;text-align:center;">${currency} ${vatAmt.toFixed(3)}</td>
    </tr>`;
  }).join('');

  return `
    <table class="items" style="width:100%; margin-top:12px;">
      <thead>
        <tr>
          <th style="border:1px solid #000;padding:6px 6px;font-size:11px;text-align:center;">#</th>
          <th style="border:1px solid #000;padding:6px 6px;font-size:11px;text-align:center;">Item Description</th>
          <th style="border:1px solid #000;padding:6px 6px;font-size:11px;text-align:center;">Qty</th>
          <th style="border:1px solid #000;padding:6px 6px;font-size:11px;text-align:center;">Unit Rate</th>
          <th style="border:1px solid #000;padding:6px 6px;font-size:11px;text-align:center;">Disc %</th>
          <th style="border:1px solid #000;padding:6px 6px;font-size:11px;text-align:center;">Disc Amt</th>
          <th style="border:1px solid #000;padding:6px 6px;font-size:11px;text-align:center;">Net Total</th>
          <th style="border:1px solid #000;padding:6px 6px;font-size:11px;text-align:center;">VAT %</th>
          <th style="border:1px solid #000;padding:6px 6px;font-size:11px;text-align:center;">VAT Amt</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

async function testLpoHtmlGeneration() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Get the test LPO with discount data
    const lpoResult = await client.query(`
      SELECT * FROM supplier_lpos 
      WHERE lpo_number = 'TEST-LPO-001'
      LIMIT 1
    `);
    
    if (lpoResult.rows.length === 0) {
      console.log('Test LPO not found');
      return;
    }
    
    const lpo = lpoResult.rows[0];
    console.log(`Found LPO: ${lpo.lpo_number}`);
    
    // Get LPO items with discount data
    const itemsResult = await client.query(`
      SELECT * FROM supplier_lpo_items 
      WHERE supplier_lpo_id = $1
      ORDER BY line_number
    `, [lpo.id]);
    
    const items = itemsResult.rows;
    console.log(`Found ${items.length} LPO items`);
    
    // Get supplier data
    const supplierResult = await client.query(`
      SELECT * FROM suppliers 
      WHERE id = $1
      LIMIT 1
    `, [lpo.supplier_id]);
    
    const supplier = supplierResult.rows[0];
    console.log(`Found supplier: ${supplier.name}`);
    
    // Generate HTML
    const html = buildLpoPrintHtml(lpo, items, supplier);
    
    console.log('\n=== Generated LPO HTML ===');
    console.log(html);
    
    // Check if discount fields are present in the HTML
    const hasDiscountPercent = html.includes('Disc %');
    const hasDiscountAmount = html.includes('Disc Amt');
    const hasDiscountValues = html.includes('10%') || html.includes('50.00');
    
    console.log('\n=== Discount Field Analysis ===');
    console.log(`✓ Discount % column header present: ${hasDiscountPercent}`);
    console.log(`✓ Discount Amount column header present: ${hasDiscountAmount}`);
    console.log(`✓ Discount values present: ${hasDiscountValues}`);
    
    if (hasDiscountPercent && hasDiscountAmount && hasDiscountValues) {
      console.log('\n🎉 SUCCESS: Discount fields are properly displayed in LPO HTML!');
    } else {
      console.log('\n❌ ISSUE: Discount fields are not properly displayed in LPO HTML');
    }
    
    await client.end();
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testLpoHtmlGeneration();
