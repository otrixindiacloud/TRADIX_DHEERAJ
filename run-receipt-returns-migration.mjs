import pkg from 'pg';
const { Client } = pkg;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = "postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function runMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Read migration file
    const migrationSQL = readFileSync(
      join(__dirname, 'migrations', '0000_add_receipt_returns_tables.sql'),
      'utf-8'
    );

    console.log('Running migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration completed successfully!');
    console.log('Tables created:');
    console.log('  - receipt_returns (header table)');
    console.log('  - receipt_returns_items (line items table)');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

runMigration().catch(console.error);
