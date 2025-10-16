const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
});

async function testSchema() {
  try {
    console.log('Testing supplier_quotes table structure...');
    
    // Get column information
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'supplier_quotes' 
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in supplier_quotes table:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Test a simple query
    console.log('\nTesting simple query...');
    const simpleResult = await pool.query('SELECT COUNT(*) as count FROM supplier_quotes');
    console.log('Total supplier quotes:', simpleResult.rows[0].count);
    
    // Test with actual data
    const dataResult = await pool.query('SELECT * FROM supplier_quotes LIMIT 1');
    console.log('Sample row:', dataResult.rows[0]);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

testSchema();
