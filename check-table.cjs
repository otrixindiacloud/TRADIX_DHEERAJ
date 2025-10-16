const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/tradi_erp'
});

async function checkTable() {
  try {
    // Check if supplier_quotes table exists
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'supplier_quotes'
      );
    `);
    
    console.log('supplier_quotes table exists:', result.rows[0].exists);
    
    if (result.rows[0].exists) {
      // Check table structure
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'supplier_quotes'
        ORDER BY ordinal_position;
      `);
      
      console.log('Table columns:');
      columns.rows.forEach(row => {
        console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTable();
