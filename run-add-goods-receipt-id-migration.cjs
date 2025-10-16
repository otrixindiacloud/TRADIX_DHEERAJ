const { neon } = require('@neondatabase/serverless');
const { config } = require('dotenv');
const { join } = require('path');
const { readFileSync } = require('fs');

// Load environment variables
config();

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  try {
    console.log('Running migration: Add goods_receipt_id to material_receipt...');
    
    // Read the migration file
    const migrationPath = join(__dirname, 'migrations', '0011_add_goods_receipt_id_to_material_receipt.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Execute the migration
    await sql(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('   - Added goods_receipt_id column to material_receipt table');
    console.log('   - Added index on goods_receipt_id');
    console.log('   - Added column comment');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
