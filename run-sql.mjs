import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as dotenv from 'dotenv';
dotenv.config();
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sql = process.argv.slice(2).join(' ');

if (!sql) {
  console.error('No SQL provided');
  process.exit(1);
}

(async () => {
  try {
    console.log('Running SQL:\n', sql);
    const result = await pool.query(sql);
    console.log('Result:', result);
    await pool.end();
  } catch (error) {
    console.error('Error executing SQL:', error.message);
    await pool.end();
    process.exit(1);
  }
})();
