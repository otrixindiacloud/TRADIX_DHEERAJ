const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function checkColumns() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Check current columns in receipt_returns table
    const result = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'receipt_returns'
      ORDER BY ordinal_position
    `);
    
    console.log('\nCurrent columns in receipt_returns table:');
    console.log('=========================================');
    result.rows.forEach(row => {
      const length = row.character_maximum_length ? `(${row.character_maximum_length})` : '';
      console.log(`${row.column_name.padEnd(30)} ${row.data_type}${length}`);
    });
    
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkColumns();
