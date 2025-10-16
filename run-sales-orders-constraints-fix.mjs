import { neon } from '@neondatabase/serverless';
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runSalesOrdersConstraintsFix() {
  try {
    console.log("Running migration: Fix sales orders foreign key constraints for quotation deletion");
    
    const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";
    
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    
    console.log("Connecting to database...");
    const sql = neon(DATABASE_URL);
    
    const migrationPath = path.join(__dirname, "one-time-scripts", "fix-sales-orders-quotation-constraints.sql");
    const migrationContent = fs.readFileSync(migrationPath, "utf-8");
    
    // Remove comments and clean up the SQL
    let cleanedSQL = migrationContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    // Remove block comments
    cleanedSQL = cleanedSQL.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Split by semicolon and filter out empty statements
    const statements = cleanedSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        try {
          await sql(statement);
          console.log(`  ✅ Statement ${i + 1} executed successfully`);
        } catch (error) {
          // Some statements might fail if constraints don't exist, which is okay
          if (error.message.includes('does not exist') || 
              error.message.includes('constraint') && error.message.includes('does not exist')) {
            console.log(`  ⚠️  Statement ${i + 1} skipped (constraint does not exist)`);
          } else {
            console.error(`  ❌ Statement ${i + 1} failed:`, error.message);
            throw error;
          }
        }
      }
    }
    
    console.log('✅ Sales orders foreign key constraints fix completed successfully!');
    console.log('Fixed foreign key constraints:');
    console.log('  - sales_orders.quotation_id now has SET NULL on delete');
    console.log('');
    console.log('Quotations can now be deleted without 500 errors!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runSalesOrdersConstraintsFix();
