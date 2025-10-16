import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config();
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

neonConfig.webSocketConstructor = ws;

console.log("DATABASE_URL from env:", process.env.DATABASE_URL ? "SET" : "NOT SET");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigration() {
  try {
    console.log('Running migration: Add goods_receipt_id to material_receipt...');
    
    // Read the migration file
    const migrationPath = join(__dirname, 'migrations', '0011_add_goods_receipt_id_to_material_receipt.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('Executing SQL...');
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('   - Added goods_receipt_id column to material_receipt table');
    console.log('   - Added index on goods_receipt_id');
    console.log('   - Added column comment');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
