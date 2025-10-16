const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function checkConstraints() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Check constraints on receipt_returns table
    const result = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'receipt_returns'
      AND column_name IN ('goods_receipt_id', 'supplier_id', 'return_date', 'return_reason')
      ORDER BY ordinal_position
    `);
    
    console.log('\nColumn constraints for receipt_returns:');
    console.log('==========================================');
    result.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(20)} ${row.data_type.padEnd(20)} Nullable: ${row.is_nullable}`);
    });
    
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkConstraints();
