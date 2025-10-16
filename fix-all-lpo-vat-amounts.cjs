/**
 * Migration script to fix all LPO VAT amounts
 * This script updates all existing LPOs to have correct tax amounts calculated from their items
 */

import { storage } from './server/storage/index.js';

async function fixAllLpoVatAmounts() {
  console.log('🔧 Starting LPO VAT amounts migration...');
  console.log('=' .repeat(50));

  try {
    // Get all LPOs
    const lpos = await storage.getSupplierLpos(1000, 0);
    console.log(`📋 Found ${lpos.length} LPOs to process`);

    let successCount = 0;
    let errorCount = 0;

    for (const lpo of lpos) {
      try {
        console.log(`\n🔄 Processing LPO: ${lpo.lpoNumber} (${lpo.id})`);
        
        // Update tax amount from items
        const updatedLpo = await storage.updateLpoTaxAmountFromItems(lpo.id);
        
        if (updatedLpo) {
          console.log(`  ✅ Updated: Tax Amount = ${updatedLpo.taxAmount}, Total = ${updatedLpo.totalAmount}`);
          successCount++;
        } else {
          console.log(`  ⚠️  No update needed or LPO not found`);
        }
      } catch (error) {
        console.error(`  ❌ Error updating LPO ${lpo.lpoNumber}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`  ✅ Successfully updated: ${successCount} LPOs`);
    console.log(`  ❌ Errors: ${errorCount} LPOs`);
    console.log(`  📋 Total processed: ${lpos.length} LPOs`);
    
    if (errorCount === 0) {
      console.log('\n🎉 All LPOs have been successfully updated!');
    } else {
      console.log(`\n⚠️  ${errorCount} LPOs had errors. Please check the logs above.`);
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
fixAllLpoVatAmounts()
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
