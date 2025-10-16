import { neon } from '@neondatabase/serverless';
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    console.log("Running migration: 0010_create_material_receipt_tables.sql");
    
    const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";
    
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    
    console.log("Connecting to database...");
    const sql = neon(DATABASE_URL);
    
    const migrationPath = path.join(__dirname, "migrations", "0010_create_material_receipt_tables.sql");
    const migrationContent = fs.readFileSync(migrationPath, "utf-8");
    
    // Remove comments
    let cleanedSQL = migrationContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    // Remove block comments
    cleanedSQL = cleanedSQL.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Split by semicolon but keep the CREATE TABLE statements together
    const statements = [];
    let currentStatement = '';
    let inCreateTable = false;
    
    for (const line of cleanedSQL.split('\n')) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('CREATE TABLE')) {
        inCreateTable = true;
      }
      
      currentStatement += line + '\n';
      
      if (trimmedLine.endsWith(';')) {
        if (inCreateTable && !trimmedLine.includes(');')) {
          // Continue collecting the CREATE TABLE statement
          continue;
        }
        
        const statement = currentStatement.trim();
        if (statement && statement !== ';') {
          statements.push(statement);
        }
        currentStatement = '';
        inCreateTable = false;
      }
    }
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        const preview = statement.replace(/\s+/g, ' ').substring(0, 60);
        console.log(`  [${i + 1}/${statements.length}] ${preview}...`);
        try {
          await sql(statement);
          console.log(`    ✓ Success`);
        } catch (error) {
          console.error(`    ✗ Error:`, error.message);
          throw error;
        }
      }
    }
    
    console.log("\n✅ Migration completed successfully!");
    console.log("Tables created:");
    console.log("  - material_receipt");
    console.log("  - material_receipt_items");
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
