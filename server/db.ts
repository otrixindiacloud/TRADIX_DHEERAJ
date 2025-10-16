import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

console.log("DATABASE_URL from env:", process.env.DATABASE_URL ? "SET" : "NOT SET");
console.log("NODE_ENV:", process.env.NODE_ENV);

// Require DATABASE_URL to be set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required. Please set your PostgreSQL connection string.');
}

let pool: Pool | null = null;
let db: any = null;

try {
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 10, // Limit concurrent connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000, // Increased timeout to 15 seconds
    ssl: {
      rejectUnauthorized: false // Required for Neon and other cloud providers
    }
  });

  // Add error handling for the pool
  pool.on('error', (err) => {
    console.error('Database pool error:', err);
  });

  pool.on('connect', () => {
    console.log('Database connection established');
  });

  db = drizzle({ client: pool, schema });
  console.log('[DB] Using PostgreSQL database');
} catch (error) {
  console.error('[DB] PostgreSQL connection failed:', error);
  console.error('[DB] This might be due to network issues or database unavailability.');
  console.error('[DB] Please check your internet connection and database URL.');
  throw new Error('Failed to connect to PostgreSQL database. Please check your DATABASE_URL and network connection.');
}

export { db as drizzleDb };
export { db };

// Export pool for backward compatibility
export { pool };

// Export pool for session store
export const sessionPool = pool;