import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ 
  connectionString: "postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
});

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Check if supplier_quotes table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'supplier_quotes'
    `);
    
    console.log('supplier_quotes table exists:', tableCheck.rows.length > 0);
    
    if (tableCheck.rows.length > 0) {
      // Check table structure
      const structure = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'supplier_quotes'
        ORDER BY ordinal_position
      `);
      
      console.log('Table structure:');
      structure.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type}`);
      });
      
      // Try to select from the table
      const count = await pool.query('SELECT COUNT(*) FROM supplier_quotes');
      console.log('Number of records:', count.rows[0].count);
    } else {
      console.log('Table does not exist. Need to create it.');
    }
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await pool.end();
  }
}

testDatabase();
