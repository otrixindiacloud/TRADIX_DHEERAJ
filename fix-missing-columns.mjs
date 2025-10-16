import { Pool } from 'pg';

// Use the same connection string as the server
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require",
});

async function fixMissingColumns() {
  const client = await pool.connect();
  
  try {
    console.log('Adding missing referral columns...');
    
    // Add referral_customer_id column if it doesn't exist
    console.log('Adding referral_customer_id column...');
    await client.query(`
      ALTER TABLE enquiries 
      ADD COLUMN IF NOT EXISTS referral_customer_id UUID NULL REFERENCES customers(id);
    `);
    console.log('referral_customer_id column added successfully');
    
    // Verify the columns exist
    const checkResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'enquiries' 
      AND column_name IN ('referral_customer_id', 'referral_name');
    `);
    
    console.log('Verification - existing columns:');
    checkResult.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixMissingColumns().catch(console.error);
