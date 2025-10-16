const fs = require('fs');
const path = require('path');

// Files to update
const filesToUpdate = [
  'server/storage/delivery-storage.ts',
  'server/storage/invoice-storage.ts',
  'server/routes/supplier-quotes.ts',
  'server/storage/quotation-storage.ts',
  'server/storage/enquiry-storage.ts',
  'server/routes/analytics.ts',
  'server/storage/sales-order-storage.ts',
  'server/storage/supplier-lpo-storage.ts',
  'server/storage/requisition-storage.ts',
  'server/utils/database-validator.ts',
  'server/storage/user-storage.ts',
  'server/storage/supplier-storage.ts',
  'server/storage/supplier-quote-storage.ts',
  'server/storage/supplier-quote-storage-new.ts',
  'server/storage/supplier-quote-storage-new-backup.ts',
  'server/storage/stock-issues-storage.ts',
  'server/storage/shipment-storage.ts',
  'server/storage/return-receipt-storage.ts',
  'server/storage/receipts-storage.ts',
  'server/storage/receipt-returns-storage.ts',
  'server/storage/purchase-order-storage.ts',
  'server/storage/purchase-invoice-storage.ts',
  'server/storage/pricing-storage.ts',
  'server/storage/physical-stock-storage.ts',
  'server/storage/material-request-storage.ts',
  'server/storage/material-receipts-storage.ts',
  'server/storage/item-storage.ts',
  'server/storage/issue-returns-storage.ts',
  'server/storage/inventory-storage.ts',
  'server/storage/inventory-items-storage.ts',
  'server/storage/goods-receipt-storage.ts',
  'server/storage/customer-storage.ts',
  'server/storage/base.ts',
  'server/storage/audit-storage.ts',
  'server/storage/acceptance-storage.ts',
  'server/services/pricing-engine.ts',
  'server/routes/users.ts',
  'server/routes/table-validation.ts',
  'server/routes/supplier-quotes-new.ts',
  'server/routes/settings.ts',
  'server/routes/auth.ts',
  'server/routes/audit.ts',
  'server/routes/analytics-fixed.ts'
];

filesToUpdate.forEach(filePath => {
  try {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Replace various import patterns
      content = content.replace(/import\s*{\s*db\s*}\s*from\s*['"]\.\.\/db['"];?/g, 'import { db } from "../db-local";');
      content = content.replace(/import\s*{\s*db\s*}\s*from\s*['"]\.\.\/db\.js['"];?/g, 'import { db } from "../db-local";');
      content = content.replace(/import\s*{\s*db\s*,\s*pool\s*}\s*from\s*['"]\.\.\/db['"];?/g, 'import { db } from "../db-local";');
      content = content.replace(/import\s*{\s*drizzleDb\s*}\s*from\s*['"]\.\.\/db['"];?/g, 'import { db as drizzleDb } from "../db-local";');
      
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated ${filePath}`);
    } else {
      console.log(`⚠️  File not found: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
  }
});

console.log('✅ Database import updates complete!');
