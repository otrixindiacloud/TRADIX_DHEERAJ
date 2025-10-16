const fs = require('fs');
const path = require('path');

// List of files to update
const filesToUpdate = [
  'server/storage/delivery-storage.ts',
  'server/storage/customer-storage.ts',
  'server/storage/purchase-invoice-storage.ts',
  'server/storage/supplier-lpo-storage.ts',
  'server/storage/invoice-storage.ts',
  'server/storage/supplier-quote-storage.ts',
  'server/storage/supplier-quote-storage-new.ts',
  'server/routes/supplier-quotes-new.ts',
  'server/routes/analytics-fixed.ts',
  'server/routes/audit.ts',
  'server/routes/settings.ts',
  'server/routes/table-validation.ts',
  'server/routes/users.ts',
  'server/services/pricing-engine.ts',
  'server/storage/acceptance-storage.ts',
  'server/storage/audit-storage.ts',
  'server/storage/base.ts',
  'server/storage/goods-receipt-storage.ts',
  'server/storage/inventory-items-storage.ts',
  'server/storage/inventory-storage.ts',
  'server/storage/issue-returns-storage.ts',
  'server/storage/item-storage.ts',
  'server/storage/material-receipts-storage.ts',
  'server/storage/material-request-storage.ts',
  'server/storage/physical-stock-storage.ts',
  'server/storage/pricing-storage.ts',
  'server/storage/purchase-order-storage.ts',
  'server/storage/receipt-returns-storage.ts',
  'server/storage/receipts-storage.ts',
  'server/storage/return-receipt-storage.ts',
  'server/storage/shipment-storage.ts',
  'server/storage/stock-issues-storage.ts',
  'server/storage/supplier-quote-storage-new-backup.ts',
  'server/storage/supplier-storage.ts',
  'server/storage/user-storage.ts',
  'server/utils/database-validator.ts',
  'server/storage/requisition-storage.ts',
  'server/storage/sales-order-storage.ts',
  'server/routes/analytics.ts',
  'server/storage/enquiry-storage.ts',
  'server/storage/quotation-storage.ts',
  'server/routes/supplier-quotes.ts'
];

function updateFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;

    // Replace various import patterns
    const patterns = [
      { from: "from './db'", to: "from './db-sqlite'" },
      { from: "from '../db'", to: "from '../db-sqlite'" },
      { from: "from '../../db'", to: "from '../../db-sqlite'" },
      { from: "from '../../../db'", to: "from '../../../db-sqlite'" },
      { from: "from './db.ts'", to: "from './db-sqlite.ts'" },
      { from: "from '../db.ts'", to: "from '../db-sqlite.ts'" },
      { from: "from '../../db.ts'", to: "from '../../db-sqlite.ts'" },
      { from: "from '../../../db.ts'", to: "from '../../../db-sqlite.ts'" }
    ];

    patterns.forEach(pattern => {
      if (content.includes(pattern.from)) {
        content = content.replace(new RegExp(pattern.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), pattern.to);
        updated = true;
      }
    });

    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
    } else {
      console.log(`⏭️  No changes needed: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
  }
}

console.log('🔄 Updating database imports to use SQLite...');
console.log('─'.repeat(60));

filesToUpdate.forEach(updateFile);

console.log('─'.repeat(60));
console.log('✅ Database import update complete!');
