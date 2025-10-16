const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function runLpoSchemaFix() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Read the migration file
    const fs = require('fs');
    const migrationSQL = fs.readFileSync('migrations/0019_fix_supplier_lpo_schema.sql', 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    console.log('Successfully applied LPO schema fix migration');
    
    await client.end();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runLpoSchemaFix();
