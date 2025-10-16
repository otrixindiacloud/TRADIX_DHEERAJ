const { buildEnhancedInvoicePdf } = require('./server/pdf/pdf-utils.ts');

// Test data matching the invoice structure
const testInvoice = {
  id: 'test-invoice-1',
  invoiceNumber: 'INV-987656P7MS',
  invoiceType: 'Final',
  salesOrderId: 'd9aac83a',
  deliveryId: '11dd53a0',
  customerId: 'test-customer-1',
  invoiceDate: new Date('2025-10-05'),
  status: 'Sent',
  currency: 'BHD',
  exchangeRate: '1.0000',
  subtotal: 421.50,
  discountPercentage: 0,
  discountAmount: 0,
  taxRate: 10,
  taxAmount: 42.15,
  totalAmount: 463.65,
  paidAmount: 0,
  outstandingAmount: 463.65
};

const testCustomer = {
  id: 'test-customer-1',
  name: 'MILAN',
  customerName: 'MILAN',
  address: 'EX KANDO POLYTHENE AND PROJECTS',
  email: 'milan4567@gmail.com',
  phone: '76543345',
  taxId: '23AADC653443'
};

const testItems = [
  {
    id: 'item-1',
    description: 'Item from Sales Order',
    quantity: 100,
    unitPrice: 2.130,
    discountPercentage: 0,
    taxRate: 10,
    supplierCode: 'AUTO-SUP',
    barcode: 'AUTO-1759653986540-0'
  },
  {
    id: 'item-2', 
    description: 'Item from Sales Order',
    quantity: 50,
    unitPrice: 4.170,
    discountPercentage: 0,
    taxRate: 10,
    supplierCode: 'AUTO-SUP',
    barcode: 'AUTO-1759653986540-1'
  }
];

// Test PDF generation
try {
  console.log('Testing PDF generation with fixed table structure...');
  
  const pdfContext = {
    invoice: testInvoice,
    items: testItems,
    customer: testCustomer,
    mode: 'enhanced'
  };
  
  const pdfBuffer = buildEnhancedInvoicePdf(pdfContext);
  console.log(`PDF generated successfully! Size: ${pdfBuffer.length} bytes`);
  
  // Write to file for inspection
  require('fs').writeFileSync('test-invoice-table-fix.pdf', pdfBuffer);
  console.log('PDF saved as test-invoice-table-fix.pdf');
  
} catch (error) {
  console.error('Error generating PDF:', error);
}
