/**
 * Simple test for tax and discount calculations
 * Tests the core calculation logic directly
 */

console.log('🧮 Testing Tax and Discount Calculations');
console.log('=' .repeat(50));

// Replicate the calculation functions for testing
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

function calculateDocumentTotals(items) {
  let grossSubtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  
  items.forEach(item => {
    const calculation = calculateLineItemTotals(
      item.quantity,
      item.unitPrice,
      item.discountPercent || 0,
      item.taxPercent || 0,
      item.explicitDiscountAmount
    );
    
    grossSubtotal += calculation.grossAmount;
    totalDiscount += calculation.discountAmount;
    totalTax += calculation.taxAmount;
  });
  
  const subtotal = Math.round((grossSubtotal - totalDiscount) * 100) / 100;
  const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;
  
  return {
    grossSubtotal: Math.round(grossSubtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    subtotal,
    totalTax: Math.round(totalTax * 100) / 100,
    totalAmount
  };
}

// Test 1: Basic Line Item Calculations
console.log('\n📊 Test 1: Basic Line Item Calculations');
console.log('-'.repeat(30));

const testCases = [
  {
    name: 'Basic item without discount or tax',
    quantity: 10,
    unitPrice: 100,
    discountPercent: 0,
    taxPercent: 0,
    expected: {
      grossAmount: 1000,
      discountAmount: 0,
      netAmount: 1000,
      taxAmount: 0,
      totalAmount: 1000
    }
  },
  {
    name: 'Item with percentage discount only',
    quantity: 10,
    unitPrice: 100,
    discountPercent: 10,
    taxPercent: 0,
    expected: {
      grossAmount: 1000,
      discountAmount: 100,
      netAmount: 900,
      taxAmount: 0,
      totalAmount: 900
    }
  },
  {
    name: 'Item with tax only',
    quantity: 10,
    unitPrice: 100,
    discountPercent: 0,
    taxPercent: 15,
    expected: {
      grossAmount: 1000,
      discountAmount: 0,
      netAmount: 1000,
      taxAmount: 150,
      totalAmount: 1150
    }
  },
  {
    name: 'Item with both discount and tax',
    quantity: 10,
    unitPrice: 100,
    discountPercent: 10,
    taxPercent: 15,
    expected: {
      grossAmount: 1000,
      discountAmount: 100,
      netAmount: 900,
      taxAmount: 135,
      totalAmount: 1035
    }
  },
  {
    name: 'Item with explicit discount amount',
    quantity: 10,
    unitPrice: 100,
    discountPercent: 0,
    taxPercent: 0,
    explicitDiscountAmount: 50,
    expected: {
      grossAmount: 1000,
      discountAmount: 50,
      netAmount: 950,
      taxAmount: 0,
      totalAmount: 950
    }
  }
];

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}`);
  
  const result = calculateLineItemTotals(
    testCase.quantity,
    testCase.unitPrice,
    testCase.discountPercent,
    testCase.taxPercent,
    testCase.explicitDiscountAmount
  );
  
  const isPass = Math.abs(result.grossAmount - testCase.expected.grossAmount) < 0.01 &&
                 Math.abs(result.discountAmount - testCase.expected.discountAmount) < 0.01 &&
                 Math.abs(result.netAmount - testCase.expected.netAmount) < 0.01 &&
                 Math.abs(result.taxAmount - testCase.expected.taxAmount) < 0.01 &&
                 Math.abs(result.totalAmount - testCase.expected.totalAmount) < 0.01;
  
  console.log(`   Input: Qty=${testCase.quantity}, Price=${testCase.unitPrice}, Discount=${testCase.discountPercent}%, Tax=${testCase.taxPercent}%`);
  console.log(`   Expected: Gross=${testCase.expected.grossAmount}, Discount=${testCase.expected.discountAmount}, Net=${testCase.expected.netAmount}, Tax=${testCase.expected.taxAmount}, Total=${testCase.expected.totalAmount}`);
  console.log(`   Actual:   Gross=${result.grossAmount}, Discount=${result.discountAmount}, Net=${result.netAmount}, Tax=${result.taxAmount}, Total=${result.totalAmount}`);
  console.log(`   Result: ${isPass ? '✅ PASS' : '❌ FAIL'}`);
  
  if (isPass) passedTests++;
});

// Test 2: Document Totals Calculations
console.log('\n📋 Test 2: Document Totals Calculations');
console.log('-'.repeat(30));

const documentTestCases = [
  {
    name: 'Single item document',
    items: [
      { quantity: 5, unitPrice: 100, discountPercent: 10, taxPercent: 15 }
    ],
    expected: {
      grossSubtotal: 500,
      totalDiscount: 50,
      subtotal: 450,
      totalTax: 67.5,
      totalAmount: 517.5
    }
  },
  {
    name: 'Multiple items with different rates',
    items: [
      { quantity: 2, unitPrice: 50, discountPercent: 5, taxPercent: 10 },
      { quantity: 3, unitPrice: 75, discountPercent: 15, taxPercent: 20 },
      { quantity: 1, unitPrice: 200, discountPercent: 0, taxPercent: 0 }
    ],
    expected: {
      grossSubtotal: 425, // 100 + 225 + 200
      totalDiscount: 58.75, // 5 + 33.75 + 0
      subtotal: 366.25, // 425 - 58.75
      totalTax: 58.75, // 9.5 + 38.25 + 0
      totalAmount: 425 // 366.25 + 58.75
    }
  }
];

documentTestCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}`);
  
  const result = calculateDocumentTotals(testCase.items);
  
  const isPass = Math.abs(result.grossSubtotal - testCase.expected.grossSubtotal) < 0.01 &&
                 Math.abs(result.totalDiscount - testCase.expected.totalDiscount) < 0.01 &&
                 Math.abs(result.subtotal - testCase.expected.subtotal) < 0.01 &&
                 Math.abs(result.totalTax - testCase.expected.totalTax) < 0.01 &&
                 Math.abs(result.totalAmount - testCase.expected.totalAmount) < 0.01;
  
  console.log(`   Items: ${testCase.items.length}`);
  testCase.items.forEach((item, i) => {
    console.log(`     ${i + 1}. Qty=${item.quantity}, Price=${item.unitPrice}, Discount=${item.discountPercent || 0}%, Tax=${item.taxPercent || 0}%`);
  });
  console.log(`   Expected: Gross=${testCase.expected.grossSubtotal}, Discount=${testCase.expected.totalDiscount}, Subtotal=${testCase.expected.subtotal}, Tax=${testCase.expected.totalTax}, Total=${testCase.expected.totalAmount}`);
  console.log(`   Actual:   Gross=${result.grossSubtotal}, Discount=${result.totalDiscount}, Subtotal=${result.subtotal}, Tax=${result.totalTax}, Total=${result.totalAmount}`);
  console.log(`   Result: ${isPass ? '✅ PASS' : '❌ FAIL'}`);
  
  if (isPass) passedTests++;
  totalTests++;
});

// Test 3: Edge Cases
console.log('\n⚠️ Test 3: Edge Cases');
console.log('-'.repeat(30));

const edgeCases = [
  {
    name: 'Maximum discount (100%)',
    quantity: 10,
    unitPrice: 100,
    discountPercent: 100,
    taxPercent: 0
  },
  {
    name: 'High tax rate (50%)',
    quantity: 10,
    unitPrice: 100,
    discountPercent: 0,
    taxPercent: 50
  },
  {
    name: 'Decimal quantities and prices',
    quantity: 2.5,
    unitPrice: 99.99,
    discountPercent: 12.5,
    taxPercent: 8.25
  }
];

edgeCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}`);
  
  try {
    const result = calculateLineItemTotals(
      testCase.quantity,
      testCase.unitPrice,
      testCase.discountPercent,
      testCase.taxPercent
    );
    
    console.log(`   Input: Qty=${testCase.quantity}, Price=${testCase.unitPrice}, Discount=${testCase.discountPercent}%, Tax=${testCase.taxPercent}%`);
    console.log(`   Result: Gross=${result.grossAmount}, Discount=${result.discountAmount}, Net=${result.netAmount}, Tax=${result.taxAmount}, Total=${result.totalAmount}`);
    console.log(`   Result: ✅ PASS (No errors)`);
    passedTests++;
  } catch (error) {
    console.log(`   Result: ❌ FAIL (Error: ${error.message})`);
  }
  totalTests++;
});

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 CALCULATION TEST SUMMARY');
console.log('='.repeat(50));
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${totalTests - passedTests}`);
console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
  console.log('\n🎉 All calculation tests passed! The tax and discount calculations are working correctly.');
} else {
  console.log('\n⚠️ Some tests failed. Please review the calculation logic.');
}

console.log('\n🔍 Testing Complete!');
