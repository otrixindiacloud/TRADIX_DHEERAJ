const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations/0008_make_receipt_returns_fk_nullable.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration: 0008_make_receipt_returns_fk_nullable.sql');
    
    // Execute the SQL
    await client.query(sql);
    
    console.log('✓ Migration completed successfully');
    console.log('  - goods_receipt_id is now nullable');
    console.log('  - supplier_id is now nullable');
    
    await client.end();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

runMigration();
