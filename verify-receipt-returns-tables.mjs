import pkg from 'pg';
const { Client } = pkg;

const DATABASE_URL = "postgresql://neondb_owner:npg_4qUzlEaM3vPc@ep-small-moon-ad292p30.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function verifyTables() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Check receipt_returns table
    const headerResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'receipt_returns'
      ORDER BY ordinal_position;
    `);

    console.log('📋 receipt_returns table columns:');
    console.table(headerResult.rows);

    // Check receipt_returns_items table
    const itemsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'receipt_returns_items'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 receipt_returns_items table columns:');
    console.table(itemsResult.rows);

    // Check indexes
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename IN ('receipt_returns', 'receipt_returns_items')
      ORDER BY tablename, indexname;
    `);

    console.log('\n🔍 Indexes:');
    console.table(indexResult.rows);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

verifyTables().catch(console.error);
