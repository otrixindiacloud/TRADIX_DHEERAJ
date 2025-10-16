/**
 * Test script to check database connection and table existence
 */

import { db } from './server/db.ts';
import { goodsReceiptHeaders } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing Database Connection...');
    console.log('─'.repeat(60));
    
    // Test basic connection
    console.log('📋 Step 1: Testing basic database connection...');
    const result = await db.select().from(goodsReceiptHeaders).limit(1);
    console.log('✅ Database connection successful');
    console.log(`📊 Found ${result.length} goods receipt headers`);
    
    // Test table structure
    console.log('\n📋 Step 2: Testing table structure...');
    try {
      const testInsert = await db.insert(goodsReceiptHeaders).values({
        receiptNumber: `TEST-${Date.now()}`,
        supplierId: '550e8400-e29b-41d4-a716-446655440000',
        receiptDate: '2025-01-14',
        status: 'Draft'
      }).returning();
      console.log('✅ Test insert successful:', testInsert[0].id);
      
      // Clean up test data
      await db.delete(goodsReceiptHeaders).where(eq(goodsReceiptHeaders.id, testInsert[0].id));
      console.log('✅ Test data cleaned up');
      
    } catch (insertError) {
      console.error('❌ Test insert failed:', insertError);
      console.error('Error details:', {
        message: insertError.message,
        code: insertError.code,
        detail: insertError.detail
      });
    }
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  }
}

// Run the test
testDatabaseConnection();
