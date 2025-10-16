const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Check if column already exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'supplier_quotes' 
      AND column_name = 'quotation_number'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('Column quotation_number already exists');
    } else {
      // Add the column
      await client.query(`
        ALTER TABLE supplier_quotes ADD COLUMN quotation_number VARCHAR(50)
      `);
      console.log('Successfully added quotation_number column');
    }
    
    await client.end();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
