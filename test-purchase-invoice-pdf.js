import { generatePurchaseInvoicePdf } from './server/pdf/pdf-utils.ts';
import fs from 'fs';

// Test data for purchase invoice
const testPurchaseInvoice = {
  id: 'test-purchase-invoice-1',
  invoiceNumber: 'PI-20251015-LYBR3',
  supplierInvoiceNumber: 'SUP-INV-12345',
  supplierId: 'supplier-123',
  supplierName: 'Test Supplier Ltd',
  invoiceDate: '2025-10-15',
  dueDate: '2025-11-15',
  status: 'Approved',
  paymentStatus: 'Unpaid',
  currency: 'BHD',
  subtotal: '4893.00',
  taxAmount: '0.00',
  discountAmount: '0.00',
  totalAmount: '4893.00',
  paymentTerms: 'Generated from shipment SHP-TEMP-176E6086577, Supplier: cdtn, Customer: Unknown Customer, LPO LPO-04136BDQUA',
  notes: 'Generated from completed goods receipt CHN-20251015-NZNQ, LPO LPO-04136BDQUA'
};

const testItems = [
  {
    id: 'item-1',
    itemDescription: 'ptn\nItem ID: a4c64947-3621-4b0e-bb4e-62520-008c75',
    quantity: 0.00,
    unitPrice: '0.000',
    totalPrice: '0.00',
    unitOfMeasure: 'PCS',
    taxRate: '0',
    discountRate: '0',
    discountAmount: '0.00'
  },
  {
    id: 'item-2', 
    itemDescription: 'data cable\nItem ID: a4c64947-3621-4b0e-bb4e-62520-008c75',
    quantity: 0.00,
    unitPrice: '0.000',
    totalPrice: '0.00',
    unitOfMeasure: 'PCS',
    taxRate: '0',
    discountRate: '0',
    discountAmount: '0.00'
  }
];

const testSupplier = {
  id: 'supplier-123',
  name: 'Test Supplier Ltd',
  supplierName: 'Test Supplier Ltd',
  address: 'P.O. Box 1234, Test City, Test Country',
  email: 'supplier@test.com',
  phone: '+973 1234 5678',
  contactPerson: 'John Doe',
  contactEmail: 'john@test.com',
  contactPhone: '+973 9876 5432'
};

// Generate PDF
try {
  console.log('Generating purchase invoice PDF...');
  const pdfResult = generatePurchaseInvoicePdf({
    invoice: testPurchaseInvoice,
    items: testItems,
    supplier: testSupplier,
    mode: 'enhanced'
  });
  
  // Save to file
  fs.writeFileSync('./test-purchase-invoice.pdf', pdfResult.buffer);
  console.log('✅ PDF generated successfully: test-purchase-invoice.pdf');
  console.log(`File size: ${pdfResult.byteLength} bytes`);
  console.log(`File name: ${pdfResult.fileName}`);
  
} catch (error) {
  console.error('❌ Error generating PDF:', error);
}