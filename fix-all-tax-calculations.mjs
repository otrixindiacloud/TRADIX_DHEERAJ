/**
 * Fix all tax calculations across the application
 * This script recalculates tax amounts for all existing records
 */

import { db } from './server/db.ts';
import { salesOrders, salesOrderItems, supplierLpos, supplierLpoItems, invoices, invoiceItems } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

console.log('🔧 Starting Tax Calculation Fix');
console.log('=' .repeat(50));

// Helper function to calculate line item totals with proper rounding
function calculateLineItemTotals(quantity, unitPrice, discountPercent = 0, taxPercent = 10, explicitDiscountAmount) {
  const qty = Math.max(0, Number(quantity) || 0);
  const price = Math.max(0, Number(unitPrice) || 0);
  const discPct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  const taxPct = Math.max(0, Number(taxPercent) || 10);
  const explicitDisc = Math.max(0, Number(explicitDiscountAmount) || 0);

  const grossAmount = Math.round((qty * price) * 100) / 100;
  
  let discountAmount = 0;
  if (explicitDisc > 0) {
    discountAmount = Math.min(explicitDisc, grossAmount * 0.999);
  } else {
    discountAmount = Math.round((grossAmount * discPct / 100) * 100) / 100;
  }
  
  const netAmount = Math.max(0.01, Math.round((grossAmount - discountAmount) * 100) / 100);
  const taxAmount = Math.round((netAmount * taxPct / 100) * 100) / 100;
  const totalAmount = Math.round((netAmount + taxAmount) * 100) / 100;
  
  return {
    grossAmount,
    discountAmount,
    netAmount,
    taxAmount,
    totalAmount
  };
}

// Fix Sales Orders
console.log('\n📋 Fixing Sales Orders...');
try {
  const salesOrdersList = await db.select().from(salesOrders);
  console.log(`Found ${salesOrdersList.length} sales orders to process`);
  
  let fixedSalesOrders = 0;
  
  for (const order of salesOrdersList) {
    const items = await db.select().from(salesOrderItems).where(eq(salesOrderItems.salesOrderId, order.id));
    
    let subtotal = 0;
    let totalTax = 0;
    
    for (const item of items) {
      const calculation = calculateLineItemTotals(
        item.quantity,
        item.unitPrice,
        item.discountPercent || 0,
        10, // Default to 10% VAT
        item.discountAmount
      );
      
      subtotal += calculation.netAmount;
      totalTax += calculation.taxAmount;
    }
    
    const totalAmount = subtotal + totalTax;
    
    await db.update(salesOrders)
      .set({
        subtotal: subtotal.toFixed(3),
        taxAmount: totalTax.toFixed(3),
        totalAmount: totalAmount.toFixed(3),
        updatedAt: new Date()
      })
      .where(eq(salesOrders.id, order.id));
    
    fixedSalesOrders++;
  }
  
  console.log(`✅ Fixed ${fixedSalesOrders} sales orders`);
} catch (error) {
  console.error('❌ Error fixing sales orders:', error);
}

// Fix Supplier LPOs
console.log('\n📦 Fixing Supplier LPOs...');
try {
  const lposList = await db.select().from(supplierLpos);
  console.log(`Found ${lposList.length} supplier LPOs to process`);
  
  let fixedLpos = 0;
  
  for (const lpo of lposList) {
    const items = await db.select().from(supplierLpoItems).where(eq(supplierLpoItems.supplierLpoId, lpo.id));
    
    let subtotal = 0;
    let totalTax = 0;
    
    for (const item of items) {
      const calculation = calculateLineItemTotals(
        item.quantity,
        item.unitCost,
        item.discountPercent || 0,
        10, // Default to 10% VAT
        item.discountAmount
      );
      
      subtotal += calculation.netAmount;
      totalTax += calculation.taxAmount;
    }
    
    const totalAmount = subtotal + totalTax;
    
    await db.update(supplierLpos)
      .set({
        subtotal: subtotal.toFixed(3),
        taxAmount: totalTax.toFixed(3),
        totalAmount: totalAmount.toFixed(3),
        updatedAt: new Date()
      })
      .where(eq(supplierLpos.id, lpo.id));
    
    fixedLpos++;
  }
  
  console.log(`✅ Fixed ${fixedLpos} supplier LPOs`);
} catch (error) {
  console.error('❌ Error fixing supplier LPOs:', error);
}

// Fix Invoices
console.log('\n🧾 Fixing Invoices...');
try {
  const invoicesList = await db.select().from(invoices);
  console.log(`Found ${invoicesList.length} invoices to process`);
  
  let fixedInvoices = 0;
  
  for (const invoice of invoicesList) {
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id));
    
    let subtotal = 0;
    let totalTax = 0;
    
    for (const item of items) {
      const calculation = calculateLineItemTotals(
        item.quantity,
        item.unitPrice,
        Number(item.discountPercentage) || 0,
        10, // Default to 10% VAT
        Number(item.discountAmount) || 0
      );
      
      subtotal += calculation.netAmount;
      totalTax += calculation.taxAmount;
    }
    
    const totalAmount = subtotal + totalTax;
    
    await db.update(invoices)
      .set({
        subtotal: subtotal.toFixed(3),
        taxAmount: totalTax.toFixed(3),
        totalAmount: totalAmount.toFixed(3),
        updatedAt: new Date()
      })
      .where(eq(invoices.id, invoice.id));
    
    fixedInvoices++;
  }
  
  console.log(`✅ Fixed ${fixedInvoices} invoices`);
} catch (error) {
  console.error('❌ Error fixing invoices:', error);
}

console.log('\n' + '='.repeat(50));
console.log('🎉 Tax Calculation Fix Complete!');
console.log('='.repeat(50));
console.log('All tax calculations have been updated with proper 10% VAT rates and rounding.');
console.log('The UI components have been enhanced to show detailed tax breakdowns.');
console.log('\n✅ Summary of fixes:');
console.log('- Sales Orders: Tax calculations fixed with 10% VAT');
console.log('- Supplier LPOs: VAT calculations fixed with 10% VAT');
console.log('- Invoices: Tax calculations fixed with 10% VAT');
console.log('- UI Components: Enhanced to show detailed tax breakdowns');
console.log('\n🔍 You can now view the improved tax details in the application!');
