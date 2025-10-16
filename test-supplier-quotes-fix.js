import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ 
  connectionString: "postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
});

async function testSupplierQuotesQuery() {
  try {
    console.log('Testing supplier quotes query...');
    
    const query = `
      SELECT 
        sq.id,
        sq.quote_number as "quoteNumber",
        sq.supplier_id as "supplierId",
        sq.status,
        sq.priority,
        sq.quote_date as "quoteDate",
        sq.valid_until as "validUntil",
        sq.subtotal,
        sq.total_amount as "totalAmount",
        sq.currency,
        s.name as "supplierName",
        s.email as "supplierEmail"
      FROM supplier_quotes sq
      LEFT JOIN suppliers s ON sq.supplier_id = s.id
      ORDER BY sq.created_at DESC
      LIMIT 5
    `;
    
    const result = await pool.query(query);
    console.log('Query successful! Found', result.rows.length, 'supplier quotes:');
    
    result.rows.forEach((row, i) => {
      console.log(`${i+1}. ${row.quoteNumber} - ${row.supplierName} (${row.status})`);
    });
    
  } catch (error) {
    console.error('Query failed:', error.message);
  } finally {
    await pool.end();
  }
}

testSupplierQuotesQuery();
