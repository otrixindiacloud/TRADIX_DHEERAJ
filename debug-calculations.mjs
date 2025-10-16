/**
 * Debug calculation issues
 */

function calculateLineItemTotals(
  quantity,
  unitPrice,
  discountPercent = 0,
  taxPercent = 0,
  explicitDiscountAmount
) {
  const grossAmount = Math.round((quantity * unitPrice) * 100) / 100;
  
  let discountAmount = 0;
  if (explicitDiscountAmount && explicitDiscountAmount > 0) {
    discountAmount = Math.round(explicitDiscountAmount * 100) / 100;
  } else {
    discountAmount = Math.round((grossAmount * discountPercent / 100) * 100) / 100;
  }
  
  const netAmount = Math.round((grossAmount - discountAmount) * 100) / 100;
  const taxAmount = Math.round((netAmount * taxPercent / 100) * 100) / 100;
  const totalAmount = Math.round((netAmount + taxAmount) * 100) / 100;
  
  return {
    grossAmount,
    discountAmount,
    netAmount,
    totalAmount,
    taxAmount
  };
}

console.log('🔍 Debugging Calculation Issues');
console.log('=' .repeat(50));

// Debug the failing test case
const items = [
  { quantity: 2, unitPrice: 50, discountPercent: 5, taxPercent: 10 },
  { quantity: 3, unitPrice: 75, discountPercent: 15, taxPercent: 20 },
  { quantity: 1, unitPrice: 200, discountPercent: 0, taxPercent: 0 }
];

console.log('\n📊 Item-by-item breakdown:');
let totalGross = 0;
let totalDiscount = 0;
let totalTax = 0;

items.forEach((item, index) => {
  const result = calculateLineItemTotals(
    item.quantity,
    item.unitPrice,
    item.discountPercent,
    item.taxPercent
  );
  
  console.log(`\nItem ${index + 1}: Qty=${item.quantity}, Price=${item.unitPrice}, Discount=${item.discountPercent}%, Tax=${item.taxPercent}%`);
  console.log(`  Gross: ${item.quantity} × ${item.unitPrice} = ${result.grossAmount}`);
  console.log(`  Discount: ${result.grossAmount} × ${item.discountPercent}% = ${result.discountAmount}`);
  console.log(`  Net: ${result.grossAmount} - ${result.discountAmount} = ${result.netAmount}`);
  console.log(`  Tax: ${result.netAmount} × ${item.taxPercent}% = ${result.taxAmount}`);
  console.log(`  Total: ${result.netAmount} + ${result.taxAmount} = ${result.totalAmount}`);
  
  totalGross += result.grossAmount;
  totalDiscount += result.discountAmount;
  totalTax += result.taxAmount;
});

console.log('\n📋 Document totals:');
console.log(`Total Gross: ${totalGross}`);
console.log(`Total Discount: ${totalDiscount}`);
console.log(`Subtotal: ${totalGross - totalDiscount}`);
console.log(`Total Tax: ${totalTax}`);
console.log(`Grand Total: ${(totalGross - totalDiscount) + totalTax}`);

// Expected values
console.log('\n🎯 Expected values:');
console.log('Item 1: 2 × 50 = 100, Discount: 100 × 5% = 5, Net: 95, Tax: 95 × 10% = 9.5, Total: 104.5');
console.log('Item 2: 3 × 75 = 225, Discount: 225 × 15% = 33.75, Net: 191.25, Tax: 191.25 × 20% = 38.25, Total: 229.5');
console.log('Item 3: 1 × 200 = 200, Discount: 0, Net: 200, Tax: 0, Total: 200');
console.log('Total Gross: 100 + 225 + 200 = 525');
console.log('Total Discount: 5 + 33.75 + 0 = 38.75');
console.log('Subtotal: 525 - 38.75 = 486.25');
console.log('Total Tax: 9.5 + 38.25 + 0 = 47.75');
console.log('Grand Total: 486.25 + 47.75 = 534');

console.log('\n❌ The test case expectation was wrong!');
console.log('The actual calculation is correct.');
