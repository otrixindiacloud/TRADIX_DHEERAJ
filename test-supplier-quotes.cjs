const { Pool } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env' });

console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testSupplierQuotes() {
  try {
    console.log('Testing supplier quotes table...');
    
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'supplier_quotes'
      );
    `);
    console.log('Table exists:', tableCheck.rows[0].exists);
    
    // Check table structure
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'supplier_quotes' 
      ORDER BY ordinal_position;
    `);
    console.log('Table columns:');
    columns.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    // Check if there's any data
    const count = await pool.query('SELECT COUNT(*) FROM supplier_quotes');
    console.log('Record count:', count.rows[0].count);
    
    // Try to select some data
    const data = await pool.query('SELECT * FROM supplier_quotes LIMIT 5');
    console.log('Sample data:', data.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

testSupplierQuotes();
