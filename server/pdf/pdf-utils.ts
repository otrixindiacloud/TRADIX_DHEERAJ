import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, InvoiceItem, Item, Customer, Quotation, QuotationItem } from '../../shared/schema';

// Core reusable interfaces
export interface PdfGenerateResult {
  buffer: Buffer;
  byteLength: number;
  fileName: string;
  contentType: string; // always application/pdf for now
}

export interface InvoicePdfContext {
  invoice: Invoice;
  items: (InvoiceItem & { item?: Item })[];
  customer: Customer;
  related?: { salesOrder?: any; delivery?: any };
  mode?: 'enhanced' | 'simple';
}

export interface QuotationPdfContext {
  quotation: Quotation;
  items: (QuotationItem & { item?: Item })[];
  customer: Customer;
  mode?: 'enhanced' | 'simple';
}

// Currency formatting centralised
export function fmtCurrency(amount: number | string | null | undefined, currency = 'BHD') {
  const n = amount == null ? 0 : (typeof amount === 'string' ? parseFloat(amount) : amount);
  if (Number.isNaN(n)) return `${currency} 0.00`;
  return `${currency} ${n.toFixed(2)}`;
}

export function fmtDate(date: string | Date | null | undefined) {
  if (!date) return '';
  try { return new Date(date).toLocaleDateString('en-GB'); } catch { return ''; }
}

function baseDoc(): any { return new jsPDF(); }

// Convert number to words (simple, supports up to billions) for amount in words section
function numberToWords(num: number): string {
  if (!Number.isFinite(num)) return '';
  if (num === 0) return 'Zero';
  const belowTwenty = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','Ten','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function words(n: number): string {
    if (n < 20) return belowTwenty[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10?'-'+belowTwenty[n%10]:'');
    if (n < 1000) return belowTwenty[Math.floor(n/100)] + ' Hundred' + (n%100? ' ' + words(n%100):'');
    if (n < 1_000_000) return words(Math.floor(n/1000)) + ' Thousand' + (n%1000? ' ' + words(n%1000):'');
    if (n < 1_000_000_000) return words(Math.floor(n/1_000_000)) + ' Million' + (n%1_000_000? ' ' + words(n%1_000_000):'');
    return words(Math.floor(n/1_000_000_000)) + ' Billion' + (n%1_000_000_000? ' ' + words(n%1_000_000_000):'');
  }
  return words(Math.floor(num));
}

function amountInWords(total: number, currency: string) {
  const integerPart = Math.floor(total);
  const fractional = Math.round((total - integerPart) * 100);
  const words = numberToWords(integerPart) || 'Zero';
  return `${currency} ${words} ${fractional > 0 ? fractional + '/100' : ''}`.trim();
}

// Enhanced invoice PDF - Clean Tax Invoice format matching quotation layout
export function buildEnhancedInvoicePdf(ctx: InvoicePdfContext): Buffer {
  const { invoice, items, customer } = ctx;
  const doc = baseDoc();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  // Precompute gross totals for discount proration when only header discountAmount exists
  const globalDiscAmount = Number((invoice as any).discountAmount) || 0;
  const headerSubtotal = Number((invoice as any).subtotal) || 0;
  const totalGrossForProration = items.reduce((sum, it) => {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitPrice) || 0;
    return sum + (qty * unit);
  }, 0);
  
  // Company Header - Left Side (Golden Tag)
  doc.setFontSize(22).setFont('helvetica', 'bold');
  doc.setTextColor(218, 165, 32); // Gold color
  doc.text('GOLDEN TAG', 15, 20);
  
  // Company Details - Left Side
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Trading & Supply Company', 15, 27);
  doc.text('Kingdom of Bahrain', 15, 32);
  doc.text('Mobile: +973 XXXX XXXX', 15, 37);
  doc.text('Email: info@goldentag.com', 15, 42);
  
  // Document Type and Date - Right Side
  doc.setFontSize(18).setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  // Check invoice type to display appropriate title
  const invoiceType = (invoice as any).invoiceType || (invoice as any).type || 'Standard';
  const documentTitle = invoiceType === 'Proforma' ? 'PROFORMA INVOICE' : 'INVOICE';
  doc.text(documentTitle, pageWidth - 15, 20, { align: 'right' });
  
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const invoiceDate = fmtDate((invoice as any).invoiceDate || invoice.createdAt);
  doc.text(`Date: ${invoiceDate}`, pageWidth - 15, 30, { align: 'right' });
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, pageWidth - 15, 35, { align: 'right' });
  const dueDate = fmtDate((invoice as any).dueDate);
  if (dueDate) {
    doc.text(`Due Date: ${dueDate}`, pageWidth - 15, 40, { align: 'right' });
  }
  
  // Horizontal line separator
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, 48, pageWidth - 15, 48);
  
  doc.setFontSize(8).setFont('helvetica','normal');

  // Meta table (Invoice No, Date, Customer Name, Sales Person, Payment Terms, Due Date)
  const customerName = (customer as any).customerName || customer.name || '';
  const salesPerson = (invoice as any).salesPerson || (invoice as any).createdBy || '';
  const paymentTerms = (invoice as any).terms ? ((invoice as any).terms.split('\n')[0].slice(0,40)) : '30 Days';
  const invoiceDateFormatted = fmtDate((invoice as any).invoiceDate || invoice.createdAt);
  const dueDateFormatted = fmtDate((invoice as any).dueDate);
  
  autoTable(doc, {
    startY: 56,
    head: [[ 'Invoice No', 'Invoice Date', 'Customer Name', 'Sales Person', 'Payment Terms', 'Due Date' ]],
    body: [[
      invoice.invoiceNumber,
      invoiceDateFormatted,
      customerName,
      String(salesPerson).slice(0,12),
      paymentTerms,
      dueDateFormatted || 'N/A'
    ]],
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [255,255,255], textColor:0, fontStyle:'bold' },
    margin: { left: 15, right: 15 }
  });

  const afterMeta = (doc as any).lastAutoTable.finalY + 5;
  
  // Professional Customer Address & Contact section with proper formatting
  const custName = (customer as any).customerName || customer.name || 'N/A';
  const custAddress = customer.address || 'N/A';
  const custEmail = customer.email || 'N/A';
  const custPhone = (customer as any).phone || customer.phone || 'N/A';
  const contactPerson = (invoice as any).contactPerson || (customer as any).contactPerson || 'N/A';
  const contactEmail = (customer as any).contactEmail || customer.email || 'N/A';
  const contactPhone = (customer as any).contactPhone || customer.phone || 'N/A';
  
  // Build formatted address block
  const addressBlock = [
    custName,
    custAddress,
    custEmail,
    custPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  // Build formatted contact block
  const contactBlock = [
    contactPerson,
    contactEmail,
    contactPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  autoTable(doc, {
    startY: afterMeta,
    body: [
      [ 
        { content: 'Customer Name & Address:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }, 
        { content: 'Customer Contact Person:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }
      ],
      [ 
        { content: addressBlock || 'No information available', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }, 
        { content: contactBlock || 'No contact information', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }
      ]
    ],
    styles: { cellPadding: 0, lineColor: [200, 200, 200], lineWidth: 0.1 },
    columnStyles: { 0: { cellWidth: (pageWidth-30)/2 }, 1: { cellWidth: (pageWidth-30)/2 } },
    theme: 'grid',
    margin: { left: 15, right: 15 }
  });

  const afterAddress = (doc as any).lastAutoTable.finalY + 5;
  
  // Enhanced Items table with comprehensive columns matching quotation format
  const currency = (invoice as any).currency || 'BHD';
  const itemRows = items.map((it,i)=> {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitPrice) || 0;
    // Robust discount fallbacks: support both percentage and absolute amount from item or invoice
    const rawDiscPerc = (
      (it as any).discountPercentage ??
      (it as any).discountPercent ??
      (invoice as any).discountPercentage ??
      (invoice as any).discountPercent ??
      0
    );
    const discPerc = Number(rawDiscPerc) || 0;
    const gross = qty * unit;
    // Prefer explicit discountAmount on the line if present, otherwise compute from percentage
    let explicitDiscAmt = Number((it as any).discountAmount ?? (it as any).discountAmountBase) || 0;
    const percDiscAmt = (gross * discPerc) / 100;
    // If no line-level discount and invoice has header discount amount, prorate by gross share
    if (!(explicitDiscAmt > 0) && globalDiscAmount > 0) {
      const basis = headerSubtotal > 0 ? headerSubtotal : (totalGrossForProration || gross || 1);
      explicitDiscAmt = (gross / basis) * globalDiscAmount;
    }
    const discAmt = explicitDiscAmt > 0 ? explicitDiscAmt : percDiscAmt;
    const net = gross - discAmt;
    const vatPerc = Number((it as any).taxRate) || Number((invoice as any).taxRate) || 10;
    const vatAmt = net * vatPerc / 100;

    // Build enhanced description ensuring base item description always first
    const isGeneric = (txt?: string) => {
      if (!txt) return true;
      const v = String(txt).trim().toLowerCase();
      return v === 'generic item' || v === 'delivery item' || v === 'item from sales order' || v === 'item';
    };
    const descParts: string[] = [];
    // Prefer original sales order/master item descriptions over placeholders
    let baseName = (it as any).salesOrderItemDescription
      || (it as any).itemDescription
      || (it as any).item?.description
      || it.description
      || (it as any).productName
      || (it as any).item?.itemName
      || (it as any).name
      || 'Item';
    if (isGeneric(baseName)) {
      baseName = (it as any).item?.description || (it as any).productName || it.description || baseName;
    }
    descParts.push(baseName);
    if (it.description && it.description !== baseName && !isGeneric(it.description)) descParts.push(it.description);
    const originalName = (it as any).originalName || (it as any).originalItemName || (it as any).oemName;
    if (originalName && originalName !== baseName) {
      descParts.push(`Original: ${originalName}`);
    }
    // Original quantity (if differs)
    const originalQty = (it as any).originalQuantity ?? (it as any).sourceQuantity ?? (it as any).baseQuantity;
    if (originalQty != null && !Number.isNaN(Number(originalQty)) && Number(originalQty) !== qty) {
      descParts.push(`Original Qty: ${Number(originalQty).toFixed(2)}`);
    }
    // Original unit cost (if differs)
    const originalUnitRaw = (it as any).originalUnitPrice ?? (it as any).baseUnitPrice ?? (it as any).sourceUnitPrice ?? (it as any).item?.unitPrice;
    if (originalUnitRaw != null && !Number.isNaN(Number(originalUnitRaw)) && Number(originalUnitRaw) !== unit) {
      descParts.push(`Original Unit Cost: ${currency} ${Number(originalUnitRaw).toFixed(3)}`);
    }
    // Try to include original source references (quotation / enquiry) if available
    const sourceQuote = (it as any).quotationItemNumber || (it as any).quotationReference;
    const sourceEnquiry = (it as any).enquiryItemNumber || (it as any).enquiryReference;
    if (sourceQuote) descParts.push(`Quote Ref: ${sourceQuote}`);
    if (sourceEnquiry) descParts.push(`Enquiry Ref: ${sourceEnquiry}`);
    // Optional secondary display (productName)
    if ((it as any).productName && (it as any).productName !== baseName) descParts.push((it as any).productName);
    // Specifications / technical details
    const specRaw = (it as any).specifications || (it as any).specification || (it as any).itemSpecification || (it as any).technicalDetails;
    if (specRaw) {
      const specStr = String(specRaw).trim();
      if (specStr && !/^(n\/a|none)$/i.test(specStr)) {
        descParts.push(`Specs: ${specStr}`);
      }
    }
    // Notes / additional description
    const notes = (it as any).notes || (it as any).remarks || (it as any).additionalDescription;
    if (notes) {
      const notesStr = String(notes).trim();
      if (notesStr && notesStr.length > 0 && notesStr.toLowerCase() !== 'n/a') {
        descParts.push(`Notes: ${notesStr}`);
      }
    }
    // Supplier / catalog meta
    if ((it as any).supplierCode) descParts.push(`Supplier Code: ${(it as any).supplierCode}`);
    if ((it as any).barcode) descParts.push(`Barcode: ${(it as any).barcode}`);
    if ((it as any).item?.category) descParts.push(`Category: ${(it as any).item.category}`);
    // Collapse multiple blank lines & join
    const enhancedDesc = descParts.filter(p => p && p.trim().length > 0).join('\n');

    return [
      (i+1).toString(),
      enhancedDesc,
      `${qty.toFixed(2)} PCS`,
      `${currency} ${unit.toFixed(3)}`,
      `${(Number.isFinite(discPerc) ? discPerc : 0).toFixed(1)}%`,
      `${currency} ${(Number.isFinite(discAmt) ? discAmt : 0).toFixed(2)}`,
      `${currency} ${net.toFixed(2)}`,
      vatPerc > 0 ? `${vatPerc.toFixed(1)}%` : '0%',
      `${currency} ${vatAmt.toFixed(2)}`
    ];
  });
  
  autoTable(doc, {
    startY: afterAddress,
    head: [[ 'S.I.', 'Item Description & Specifications', 'Qty', 'Unit Cost', 'Disc %', 'Disc Amt', 'Net Total', 'VAT %', 'VAT Amt' ]],
    body: itemRows,
    styles: { 
      fontSize: 7, 
      cellPadding: 4, 
      valign:'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      textColor: [0, 0, 0]
    },
    headStyles: { 
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle:'bold',
      halign: 'center',
      fontSize: 8,
      cellPadding: 4,
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 10, halign:'center' },
      1: { cellWidth: 53, halign: 'left' },
      2: { cellWidth: 18, halign:'center' },
  3: { cellWidth: 20, halign:'right' },
      4: { cellWidth: 14, halign:'center' },
      5: { cellWidth: 18, halign:'right' },
      6: { cellWidth: 20, halign:'right' },
      7: { cellWidth: 14, halign:'center' },
      8: { cellWidth: 20, halign:'right' }
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    margin: { left: 15, right: 15 },
    pageBreak: 'auto',
    tableWidth: pageWidth - 30,
    showHead: 'everyPage'
  });

  const afterItems = (doc as any).lastAutoTable.finalY + 4;
  
  // Calculate totals from items
  let calculatedSubtotal = 0;
  let calculatedDiscount = 0;
  let calculatedVAT = 0;
  
  items.forEach(it => {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitPrice) || 0;
    const discPerc = Number((it as any).discountPercentage ?? (it as any).discountPercent ?? (invoice as any).discountPercentage ?? (invoice as any).discountPercent) || 0;
    const gross = Math.round((qty * unit) * 100) / 100;
    let explicitDiscAmt = Number((it as any).discountAmount ?? (it as any).discountAmountBase) || 0;
    if (!(explicitDiscAmt > 0) && globalDiscAmount > 0) {
      const basis = headerSubtotal > 0 ? headerSubtotal : (totalGrossForProration || gross || 1);
      explicitDiscAmt = Math.round(((gross / basis) * globalDiscAmount) * 100) / 100;
    }
    const discAmt = explicitDiscAmt > 0 ? explicitDiscAmt : Math.round((gross * discPerc / 100) * 100) / 100;
    const net = Math.round((gross - discAmt) * 100) / 100;
    const vatPerc = Number((it as any).taxRate) || Number((invoice as any).taxRate) || 10;
    const vatAmt = Math.round((net * vatPerc / 100) * 100) / 100;
    
    calculatedSubtotal += gross;
    calculatedDiscount += discAmt;
    calculatedVAT += vatAmt;
  });
  
  const subtotal = Math.round((Number((invoice as any).subtotal) || calculatedSubtotal) * 100) / 100;
  const discountAmount = Math.round((Number((invoice as any).discountAmount) || calculatedDiscount) * 100) / 100;
  const taxAmount = Math.round((Number((invoice as any).taxAmount) || calculatedVAT) * 100) / 100;
  const netAmount = Math.round((subtotal - discountAmount) * 100) / 100;
  const totalAmount = Math.round((Number((invoice as any).totalAmount) || (netAmount + taxAmount)) * 100) / 100;
  
  // Summary table (align right)
  autoTable(doc, {
    startY: afterItems,
    theme: 'plain',
    body: [
      ['Total Amount', `${currency} ${subtotal.toFixed(2)}`],
      ['Discount Amount', `${currency} ${discountAmount.toFixed(2)}`],
      ['Net Amount', `${currency} ${netAmount.toFixed(2)}`],
      ['VAT Amount', `${currency} ${taxAmount.toFixed(2)}`],
      ['Grand Total', `${currency} ${totalAmount.toFixed(2)}`]
    ],
    styles: { fontSize:7, cellPadding:2 },
    columnStyles: { 0: { halign:'right', cellWidth: 40, fontStyle:'bold' }, 1: { halign:'right', cellWidth: 25, fontStyle:'bold' } },
    margin: { left: pageWidth - 15 - 65, right: 15 }
  });

  const afterSummary = (doc as any).lastAutoTable.finalY + 6;
  
  // Amount in words
  doc.setFont('helvetica','bold').setFontSize(7).text(`${currency} In Words:`, 15, afterSummary);
  doc.setFont('helvetica','normal');
  doc.text(amountInWords(totalAmount, currency) + ' ONLY', 15, afterSummary + 4);

  // Remarks / Notes box
  const remarks = (invoice as any).notes || (invoice as any).terms || '';
  const remarksLines = doc.splitTextToSize('Remarks:\n' + (remarks || 'Generation from enquiry [NO-2024-191]'), pageWidth - 30);
  autoTable(doc, {
    startY: afterSummary + 8,
    body: [[ { content: remarksLines.join('\n'), styles: { fontSize:7, halign:'left' } }]],
    styles: { cellPadding: 3 },
    margin: { left: 15, right: 15 },
    theme: 'grid'
  });

  const afterRemarks = (doc as any).lastAutoTable.finalY + 6;
  
  // Signature sections
  const sigY = afterRemarks + 10;
  doc.setFont('helvetica','normal').text('_________________________', 15, sigY);
  doc.text('_________________________', pageWidth/2 + 20, sigY);
  doc.setFont('helvetica','bold').setFontSize(7).text('Authorized Signatory', 15, sigY + 5);
  doc.text('Customer Signature Date & Stamp', pageWidth/2 + 20, sigY + 5);
  
  // Footer with company information
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, pageHeight - 25, pageWidth - 15, pageHeight - 25);
  
  doc.setFontSize(7).setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 20, { align: 'center' });
  doc.text('Golden Tag - Your Trusted Trading Partner', pageWidth / 2, pageHeight - 15, { align: 'center' });
  doc.setFontSize(6);
  doc.text('Kingdom of Bahrain | Mobile: +973 XXXX XXXX | Email: info@goldentag.com', pageWidth / 2, pageHeight - 10, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}

export function buildSimpleInvoicePdf(ctx: InvoicePdfContext): Buffer {
  const { invoice } = ctx;
  const doc = baseDoc();
  doc.setFontSize(16).setFont('helvetica','bold').text('INVOICE',20,20);
  doc.setFontSize(10).setFont('helvetica','normal').text(`Invoice #: ${invoice.invoiceNumber}`,20,30);
  return Buffer.from(doc.output('arraybuffer'));
}

export function generateInvoicePdf(ctx: InvoicePdfContext): PdfGenerateResult {
  const buffer = (ctx.mode === 'simple' ? buildSimpleInvoicePdf(ctx) : buildEnhancedInvoicePdf(ctx));
  const invoiceType = (ctx.invoice as any).invoiceType || (ctx.invoice as any).type || 'Standard';
  const filePrefix = invoiceType === 'Proforma' ? 'proforma-invoice' : 'invoice';
  return { buffer, byteLength: buffer.length, fileName: `${filePrefix}-${ctx.invoice.invoiceNumber}.pdf`, contentType: 'application/pdf' };
}

export function generateQuotationPdf(ctx: QuotationPdfContext): PdfGenerateResult {
  if (ctx.mode === 'simple') {
    const { quotation, items, customer } = ctx;
    const doc = baseDoc();
    doc.setFontSize(18).setFont('helvetica','bold').text('QUOTATION',20,20);
    doc.setFontSize(10).setFont('helvetica','normal');
    doc.text(`Quote #: ${(quotation as any).quotationNumber || quotation.quoteNumber}`,20,30);
    doc.text(`Date: ${fmtDate((quotation as any).quotationDate || (quotation as any).quoteDate || quotation.createdAt)}`,20,36);
    doc.setFont('helvetica','bold').text('Customer:',20,48);
    doc.setFont('helvetica','normal').text((customer as any).customerName || customer.name || '',20,54);
    const rows = items.map((it,i)=>[
      (i+1).toString(),
      it.description || '',
      it.quantity.toString(),
      fmtCurrency(it.unitPrice, (quotation as any).currency || 'BHD'),
      fmtCurrency(it.lineTotal, (quotation as any).currency || 'BHD')
    ]);
    autoTable(doc, { startY: 70, head: [['#','Description','Qty','Unit','Total']], body: rows, styles:{fontSize:8}, headStyles:{fillColor:[255,255,255], textColor:0}});
    const buffer = Buffer.from(doc.output('arraybuffer'));
    return { buffer, byteLength: buffer.length, fileName: `quotation-${(quotation as any).quotationNumber || quotation.quoteNumber}.pdf`, contentType: 'application/pdf' };
  }

  // Enhanced template replicating provided layout image
  const { quotation, items, customer } = ctx;
  const doc = baseDoc();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Company Header - Left Side (Golden Tag)
  doc.setFontSize(22).setFont('helvetica', 'bold');
  doc.setTextColor(218, 165, 32); // Gold color
  doc.text('GOLDEN TAG', 15, 20);
  
  // Company Details - Left Side
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Trading & Supply Company', 15, 27);
  doc.text('Kingdom of Bahrain', 15, 32);
  doc.text('Mobile: +973 XXXX XXXX', 15, 37);
  doc.text('Email: info@goldentag.com', 15, 42);
  
  // Document Type and Date - Right Side
  doc.setFontSize(18).setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('QUOTATION', pageWidth - 15, 20, { align: 'right' });
  
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const qDate = fmtDate((quotation as any).quoteDate || quotation.createdAt);
  doc.text(`Date: ${qDate}`, pageWidth - 15, 30, { align: 'right' });
  doc.text(`Quote #: ${(quotation as any).quotationNumber || quotation.quoteNumber}`, pageWidth - 15, 35, { align: 'right' });
  const validUntilDate = fmtDate((quotation as any).validUntil);
  if (validUntilDate) {
    doc.text(`Valid Until: ${validUntilDate}`, pageWidth - 15, 40, { align: 'right' });
  }
  
  // Horizontal line separator
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, 48, pageWidth - 15, 48);
  
  doc.setFontSize(8).setFont('helvetica','normal');

  // Meta table (Quotation No, Date, Customer Name, Sales Person, Payment Terms, Quote Validity / Lead Time placeholders)
  const customerName = (customer as any).customerName || customer.name || '';
  const salesPerson = (quotation as any).salesPerson || (quotation as any).createdBy || '';
  const paymentTerms = (quotation as any).terms ? ((quotation as any).terms.split('\n')[0].slice(0,40)) : '30 Days';
  const leadTime = (quotation as any).leadTime || '10 days after receiving agreed LPO';
  const quoteDateFormatted = fmtDate((quotation as any).quoteDate || quotation.createdAt);
  const validUntil = fmtDate((quotation as any).validUntil);
  autoTable(doc, {
    startY: 56,
    head: [[ 'Quotation No', 'Quotation Date', 'Customer Name', 'Sales Person', 'Payment Terms', 'Lead Time / Validity' ]],
    body: [[
      (quotation as any).quotationNumber || quotation.quoteNumber,
      quoteDateFormatted,
      customerName,
      String(salesPerson).slice(0,12),
      paymentTerms,
      validUntil || leadTime
    ]],
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [255,255,255], textColor:0, fontStyle:'bold' },
    margin: { left: 15, right: 15 }
  });

  const afterMeta = (doc as any).lastAutoTable.finalY + 5;
  
  // Professional Customer Address & Contact section with proper formatting
  const custName = (customer as any).customerName || customer.name || 'N/A';
  const custAddress = customer.address || 'N/A';
  const custEmail = customer.email || 'N/A';
  const custPhone = (customer as any).phone || customer.phone || 'N/A';
  
  const contactPerson = (quotation as any).contactPerson || (customer as any).contactPerson || 'N/A';
  const contactEmail = (customer as any).contactEmail || customer.email || 'N/A';
  const contactPhone = (customer as any).contactPhone || customer.phone || 'N/A';
  
  // Build formatted address block
  const addressBlock = [
    custName,
    custAddress,
    custEmail,
    custPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  // Build formatted contact block
  const contactBlock = [
    contactPerson,
    contactEmail,
    contactPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  autoTable(doc, {
    startY: afterMeta,
    body: [
      [ 
        { content: 'Customer Name & Address:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }, 
        { content: 'Customer Contact Person:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }
      ],
      [ 
        { content: addressBlock || 'No information available', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }, 
        { content: contactBlock || 'No contact information', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }
      ]
    ],
    styles: { cellPadding: 0, lineColor: [200, 200, 200], lineWidth: 0.1 },
    columnStyles: { 0: { cellWidth: (pageWidth-30)/2 }, 1: { cellWidth: (pageWidth-30)/2 } },
    theme: 'grid',
    margin: { left: 15, right: 15 }
  });

  const afterAddress = (doc as any).lastAutoTable.finalY + 5;
  // Enhanced Items table with comprehensive columns for professional quotation
  const currency = (quotation as any).currency || 'BHD';
  const itemRows = items.map((it,i)=> {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitPrice) || 0;
    const discPerc = Number((it as any).discountPercentage) || Number((quotation as any).discountPercentage) || 0;
    const gross = qty * unit;
    const discAmt = gross * discPerc / 100;
    const net = gross - discAmt;
    const vatPerc = Number((it as any).taxRate) || Number((quotation as any).taxRate) || 10;
    const vatAmt = net * vatPerc / 100;
    
    // Enhanced description with specifications
    let enhancedDesc = it.description || 'Product Description';
    if ((it as any).supplierCode) enhancedDesc += `\nCode: ${(it as any).supplierCode}`;
    if ((it as any).barcode) enhancedDesc += `\nBarcode: ${(it as any).barcode}`;
    if ((it as any).item?.category) enhancedDesc += `\nCategory: ${(it as any).item.category}`;
    if ((it as any).specifications) enhancedDesc += `\nSpecs: ${(it as any).specifications}`;
    
    return [
      (i+1).toString(),
      enhancedDesc,
      `${qty.toFixed(2)} PCS`,
      `${currency} ${unit.toFixed(3)}`,
      discPerc > 0 ? `${discPerc.toFixed(1)}%` : '0%',
      `${currency} ${discAmt.toFixed(2)}`,
      `${currency} ${net.toFixed(2)}`,
      vatPerc > 0 ? `${vatPerc.toFixed(1)}%` : '0%',
      `${currency} ${vatAmt.toFixed(2)}`
    ];
  });
  
  autoTable(doc, {
    startY: afterAddress,
    head: [[ 'S.I.', 'Item Description & Specifications', 'Qty', 'Unit Rate', 'Disc. %', 'Disc. Amt', 'Net Total', 'VAT %', 'VAT Amt' ]],
    body: itemRows,
    styles: { 
      fontSize: 7, 
      cellPadding: 4, 
      valign:'middle',
      lineColor: [0, 0, 0], // Black borders
      lineWidth: 0.1,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      textColor: [0, 0, 0] // Black text
    },
    headStyles: { 
      fillColor: [255, 255, 255], // White header background
      textColor: [0, 0, 0], // Black text
      fontStyle:'bold',
      halign: 'center',
      fontSize: 8,
      cellPadding: 4,
      lineColor: [0, 0, 0], // Black borders
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 10, halign:'center' }, // S.I.
      1: { cellWidth: 55, halign: 'left' }, // Item Description & Specifications
      2: { cellWidth: 18, halign:'center' }, // Qty
      3: { cellWidth: 20, halign:'right' }, // Unit Rate
      4: { cellWidth: 12, halign:'center' }, // Disc. %
      5: { cellWidth: 18, halign:'right' }, // Disc. Amt
      6: { cellWidth: 20, halign:'right' }, // Net Total
      7: { cellWidth: 12, halign:'center' }, // VAT %
      8: { cellWidth: 20, halign:'right' }  // VAT Amt
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250] // Light gray alternating rows
    },
    margin: { left: 15, right: 15 },
    pageBreak: 'auto',
    tableWidth: pageWidth - 30,
    showHead: 'everyPage'
  });

  const afterItems = (doc as any).lastAutoTable.finalY + 4;
  // Summary tables (align right) – Total, Discount, Net, VAT, Grand Total
  // Calculate from items to ensure accuracy
  let calculatedSubtotal = 0;
  let calculatedDiscount = 0;
  let calculatedVAT = 0;
  
  items.forEach(it => {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitPrice) || 0;
    const discPerc = Number((it as any).discountPercentage) || Number((quotation as any).discountPercentage) || 0;
    const gross = qty * unit;
    const discAmt = gross * discPerc / 100;
    const net = gross - discAmt;
    const vatPerc = Number((it as any).taxRate) || Number((quotation as any).taxRate) || 10;
    const vatAmt = net * vatPerc / 100;
    
    calculatedSubtotal += gross;
    calculatedDiscount += discAmt;
    calculatedVAT += vatAmt;
  });
  
  const subtotal = Number((quotation as any).subtotal) || calculatedSubtotal;
  const discountAmount = Number((quotation as any).discountAmount) || calculatedDiscount;
  const taxAmount = Number((quotation as any).taxAmount) || calculatedVAT;
  const netAmount = subtotal - discountAmount;
  const totalAmount = Number((quotation as any).totalAmount) || (netAmount + taxAmount);
  
  autoTable(doc, {
    startY: afterItems,
    theme: 'plain',
    body: [
      ['Total Amount', `${currency} ${subtotal.toFixed(2)}`],
      ['Discount Amount', `${currency} ${discountAmount.toFixed(2)}`],
      ['Net Amount', `${currency} ${netAmount.toFixed(2)}`],
      ['VAT Amount', `${currency} ${taxAmount.toFixed(2)}`],
      ['Grand Total', `${currency} ${totalAmount.toFixed(2)}`]
    ],
    styles: { fontSize:7, cellPadding:2 },
    columnStyles: { 0: { halign:'right', cellWidth: 40, fontStyle:'bold' }, 1: { halign:'right', cellWidth: 25, fontStyle:'bold' } },
    margin: { left: pageWidth - 15 - 65, right: 15 }
  });

  const afterSummary = (doc as any).lastAutoTable.finalY + 6;
  // Amount in words
  doc.setFont('helvetica','bold').setFontSize(7).text(`${currency} In Words:`, 15, afterSummary);
  doc.setFont('helvetica','normal');
  doc.text(amountInWords(totalAmount, currency) + ' ONLY', 15, afterSummary + 4);

  // Remarks / Notes box
  const remarks = (quotation as any).notes || (quotation as any).terms || '';
  const remarksLines = doc.splitTextToSize('Remarks:\n' + (remarks || '---'), pageWidth - 30);
  autoTable(doc, {
    startY: afterSummary + 8,
    body: [[ { content: remarksLines.join('\n'), styles: { fontSize:7, halign:'left' } }]],
    styles: { cellPadding: 3 },
    margin: { left: 15, right: 15 },
    theme: 'grid'
  });

  const afterRemarks = (doc as any).lastAutoTable.finalY + 6;
  // Terms line (validity) & signatures
  const validity = validUntil ? `This quote is valid until ${validUntil}` : 'This quote is valid for 15 days';
  doc.setFont('helvetica','normal').setFontSize(7).text(validity, 15, afterRemarks);
  const sigY = afterRemarks + 14;
  doc.setFont('helvetica','normal').text('_________________________', 15, sigY);
  doc.text('_________________________', pageWidth/2 + 20, sigY);
  doc.setFont('helvetica','bold').setFontSize(7).text('Authorized Signatory', 15, sigY + 5);
  doc.text('Customer Signature Date & Stamp', pageWidth/2 + 20, sigY + 5);
  
  // Footer with company information
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, pageHeight - 25, pageWidth - 15, pageHeight - 25);
  
  doc.setFontSize(7).setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 20, { align: 'center' });
  doc.text('Golden Tag - Your Trusted Trading Partner', pageWidth / 2, pageHeight - 15, { align: 'center' });
  doc.setFontSize(6);
  doc.text('Kingdom of Bahrain | Mobile: +973 XXXX XXXX | Email: info@goldentag.com', pageWidth / 2, pageHeight - 10, { align: 'center' });

  const buffer = Buffer.from(doc.output('arraybuffer'));
  return { buffer, byteLength: buffer.length, fileName: `quotation-${(quotation as any).quotationNumber || quotation.quoteNumber}.pdf`, contentType: 'application/pdf' };
}

// Purchase Invoice PDF Context
export interface PurchaseInvoicePdfContext {
  invoice: any; // PurchaseInvoice type
  items: any[]; // PurchaseInvoiceItem type
  supplier: any; // Supplier type
  mode?: 'enhanced' | 'simple';
}

// Purchase Invoice PDF Generation
export function buildEnhancedPurchaseInvoicePdf(ctx: PurchaseInvoicePdfContext): Buffer {
  const { invoice, items, supplier } = ctx;
  const doc = baseDoc();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Company Header - Left Side (Golden Tag)
  doc.setFontSize(22).setFont('helvetica', 'bold');
  doc.setTextColor(218, 165, 32); // Gold color
  doc.text('GOLDEN TAG', 15, 20);
  
  // Company Details - Left Side
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Trading & Supply Company', 15, 27);
  doc.text('Kingdom of Bahrain', 15, 32);
  doc.text('Mobile: +973 XXXX XXXX', 15, 37);
  doc.text('Email: info@goldentag.com', 15, 42);
  
  // Document Type and Date - Right Side
  doc.setFontSize(18).setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('PURCHASE INVOICE', pageWidth - 15, 20, { align: 'right' });
  
  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const invoiceDate = fmtDate(invoice.invoiceDate || invoice.createdAt);
  doc.text(`Date: ${invoiceDate}`, pageWidth - 15, 30, { align: 'right' });
  doc.text(`Invoice #: ${invoice.invoiceNumber || 'N/A'}`, pageWidth - 15, 35, { align: 'right' });
  const dueDate = fmtDate(invoice.dueDate);
  if (dueDate) {
    doc.text(`Due Date: ${dueDate}`, pageWidth - 15, 40, { align: 'right' });
  }
  
  // Horizontal line separator
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, 48, pageWidth - 15, 48);
  
  doc.setFontSize(8).setFont('helvetica','normal');

  // Meta table
  const supplierName = (supplier as any).supplierName || supplier.name || '';
  const paymentTerms = invoice.paymentTerms || '30 Days';
  const invoiceDateFormatted = fmtDate(invoice.invoiceDate || invoice.createdAt);
  const dueDateFormatted = fmtDate(invoice.dueDate);
  const status = invoice.status || 'Draft';
  
  autoTable(doc, {
    startY: 56,
    head: [[ 'Invoice No', 'Invoice Date', 'Supplier Name', 'Status', 'Payment Terms', 'Due Date' ]],
    body: [[
      invoice.invoiceNumber || 'N/A',
      invoiceDateFormatted,
      supplierName,
      status,
      paymentTerms,
      dueDateFormatted || 'N/A'
    ]],
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [255,255,255], textColor:0, fontStyle:'bold' },
    margin: { left: 15, right: 15 }
  });

  const afterMeta = (doc as any).lastAutoTable.finalY + 5;
  
  // Professional Supplier Address & Contact section with proper formatting
  const suppName = (supplier as any).supplierName || supplier.name || 'N/A';
  const suppAddress = supplier.address || 'N/A';
  const suppEmail = supplier.email || 'N/A';
  const suppPhone = supplier.phone || 'N/A';
  
  const contactPerson = (supplier as any).contactPerson || 'N/A';
  const contactEmail = (supplier as any).contactEmail || supplier.email || 'N/A';
  const contactPhone = (supplier as any).contactPhone || supplier.phone || 'N/A';
  
  // Build formatted address block
  const addressBlock = [
    suppName,
    suppAddress,
    suppEmail,
    suppPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  // Build formatted contact block
  const contactBlock = [
    contactPerson,
    contactEmail,
    contactPhone
  ].filter(line => line && line !== 'N/A').join('\n');
  
  autoTable(doc, {
    startY: afterMeta,
    body: [
      [ 
        { content: 'Supplier Name & Address:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }, 
        { content: 'Supplier Contact Person:', styles: { fontStyle: 'bold', fontSize: 8, halign:'left', cellPadding: { top: 3, left: 5, right: 5, bottom: 1 } } }
      ],
      [ 
        { content: addressBlock || 'No information available', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }, 
        { content: contactBlock || 'No contact information', styles: { fontSize: 7, halign:'left', cellPadding: { top: 1, left: 5, right: 5, bottom: 3 } } }
      ]
    ],
    styles: { cellPadding: 0, lineColor: [200, 200, 200], lineWidth: 0.1 },
    columnStyles: { 0: { cellWidth: (pageWidth-30)/2 }, 1: { cellWidth: (pageWidth-30)/2 } },
    theme: 'grid',
    margin: { left: 15, right: 15 }
  });

  const afterAddress = (doc as any).lastAutoTable.finalY + 5;
  
  // Enhanced Items table
  const currency = invoice.currency || 'BHD';
  const itemRows = items.map((it:any,i:number)=> {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitPrice) || 0;
    const gross = qty * unit;
    // Handle both discountPercentage and discountRate field names
    const discPerc = Number(it.discountPercentage || it.discountRate) || (gross > 0 ? 5 : 0);
    const discAmt = gross * discPerc / 100;
    const net = gross - discAmt;
    // Use default 10% VAT if not specified and we have valid amounts
    const vatPerc = Number(it.taxRate) || (gross > 0 ? 10 : 0);
    const vatAmt = net * vatPerc / 100;
    
    

    // Build enriched description using multiple possible sources
    const descParts: string[] = [];
    const baseName = it.item?.itemName || it.itemName || it.description || it.itemDescription || 'Item';
    descParts.push(baseName);
  const originalName = it.originalName || it.originalItemName || it.oemName;
  if (originalName && originalName !== baseName) descParts.push(`Original: ${originalName}`);
  if (it.item?.itemCode) descParts.push(`Code: ${it.item.itemCode}`);
    const itemId = it.itemId || it.item?.id;
    if (itemId) descParts.push(`Item ID: ${itemId}`);
    if (it.itemCode && it.itemCode !== it.item?.itemCode) descParts.push(`Item Code: ${it.itemCode}`);
    // Source references (goods receipt, PO, supplier quote)
    const originalQty = it.originalQuantity ?? it.sourceQuantity ?? it.baseQuantity;
    if (originalQty != null && !Number.isNaN(Number(originalQty)) && Number(originalQty) !== qty) {
      descParts.push(`Original Qty: ${Number(originalQty).toFixed(2)}`);
    }
    const originalUnitRaw = it.originalUnitPrice ?? it.baseUnitPrice ?? it.sourceUnitPrice ?? it.item?.unitPrice;
    if (originalUnitRaw != null && !Number.isNaN(Number(originalUnitRaw)) && Number(originalUnitRaw) !== unit) {
      descParts.push(`Original Unit Rate: ${currency} ${Number(originalUnitRaw).toFixed(3)}`);
    }
    if (it.goodsReceiptItemId) descParts.push(`GR Item ID: ${it.goodsReceiptItemId}`);
    if (it.purchaseOrderItemId) descParts.push(`PO Item ID: ${it.purchaseOrderItemId}`);
    if (it.supplierQuoteItemId) descParts.push(`SQ Item ID: ${it.supplierQuoteItemId}`);
    // Specifications & technical details
    const specs = it.specifications || it.specification || it.itemSpecification || it.technicalDetails;
    if (specs && String(specs).trim() && !/^(n\/a|none)$/i.test(String(specs))) {
      descParts.push(`Specs: ${String(specs).trim()}`);
    }
    // Packaging / UOM extra
    if (it.packaging) descParts.push(`Pack: ${it.packaging}`);
    if (it.unitOfMeasure && !/pcs/i.test(it.unitOfMeasure)) descParts.push(`UOM: ${it.unitOfMeasure}`);
    // Supplier meta
    if (it.supplierPartNumber) descParts.push(`Supplier PN: ${it.supplierPartNumber}`);
    if (it.manufacturerPartNumber) descParts.push(`MFR PN: ${it.manufacturerPartNumber}`);
    if (it.brand) descParts.push(`Brand: ${it.brand}`);
    if (it.countryOfOrigin) descParts.push(`Origin: ${it.countryOfOrigin}`);
    // Notes
    if (it.notes) {
      const notesStr = String(it.notes).trim();
      if (notesStr && notesStr.length > 0) descParts.push(`Notes: ${notesStr}`);
    }
    // original name already added above if different
  const enrichedDescription = descParts.filter(Boolean).join('\n');

    return [
      (i+1).toString(),
      enrichedDescription,
      `${qty.toFixed(2)} ${ (it.unitOfMeasure || 'PCS').toUpperCase() }`,
      `${currency} ${unit.toFixed(3)}`,
      discPerc > 0 ? `${discPerc.toFixed(1)}%` : '0%',
      `${currency} ${discAmt.toFixed(2)}`,
      `${currency} ${net.toFixed(2)}`,
      vatPerc > 0 ? `${vatPerc.toFixed(1)}%` : '0%',
      `${currency} ${vatAmt.toFixed(2)}`
    ];
  });
  
  autoTable(doc, {
    startY: afterAddress,
    head: [[ 'S\nI', 'Item Description & Specifications', 'Qty', 'Unit\nCost', 'Disc\n%', 'Disc\nAmt', 'Net Total', 'VAT\n%', 'VAT Amt' ]],
    body: itemRows,
    styles: { 
      fontSize: 7, 
      cellPadding: 4, 
      valign:'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      textColor: [0, 0, 0]
    },
    headStyles: { 
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle:'bold',
      halign: 'center',
      fontSize: 8,
      cellPadding: 4,
      lineColor: [0, 0, 0],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 10, halign:'center' },
      1: { cellWidth: 53, halign: 'left' },
      2: { cellWidth: 18, halign:'center' },
      3: { cellWidth: 20, halign:'right' },
      4: { cellWidth: 14, halign:'center' },
      5: { cellWidth: 18, halign:'right' },
      6: { cellWidth: 20, halign:'right' },
      7: { cellWidth: 14, halign:'center' },
      8: { cellWidth: 20, halign:'right' }
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    margin: { left: 15, right: 15 },
    pageBreak: 'auto',
    tableWidth: pageWidth - 30,
    showHead: 'everyPage'
  });

  const afterItems = (doc as any).lastAutoTable.finalY + 4;
  
  // Calculate totals
  let calculatedSubtotal = 0;
  let calculatedDiscount = 0;
  let calculatedVAT = 0;
  
  items.forEach((it:any) => {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitPrice) || 0;
    const gross = qty * unit;
    // Handle both discountPercentage and discountRate field names
    const discPerc = Number(it.discountPercentage || it.discountRate) || (gross > 0 ? 5 : 0);
    const discAmt = gross * discPerc / 100;
    const net = gross - discAmt;
    // Use default 10% VAT if not specified and we have valid amounts
    const vatPerc = Number(it.taxRate) || (gross > 0 ? 10 : 0);
    const vatAmt = net * vatPerc / 100;
    
    calculatedSubtotal += gross;
    calculatedDiscount += discAmt;
    calculatedVAT += vatAmt;
  });
  
  const subtotal = Number(invoice.subtotal) || calculatedSubtotal;
  const discountAmount = Number(invoice.discountAmount) || calculatedDiscount;
  const taxAmount = Number(invoice.taxAmount) || calculatedVAT;
  const netAmount = subtotal - discountAmount;
  const totalAmount = Number(invoice.totalAmount) || (netAmount + taxAmount);
  
  // Summary table
  autoTable(doc, {
    startY: afterItems,
    theme: 'plain',
    body: [
      ['Total Amount', `${currency} ${subtotal.toFixed(2)}`],
      ['Discount Amount', `${currency} ${discountAmount.toFixed(2)}`],
      ['Net Amount', `${currency} ${netAmount.toFixed(2)}`],
      ['VAT Amount', `${currency} ${taxAmount.toFixed(2)}`],
      ['Grand Total', `${currency} ${totalAmount.toFixed(2)}`]
    ],
    styles: { fontSize:7, cellPadding:2 },
    columnStyles: { 0: { halign:'right', cellWidth: 40, fontStyle:'bold' }, 1: { halign:'right', cellWidth: 25, fontStyle:'bold' } },
    margin: { left: pageWidth - 15 - 65, right: 15 }
  });

  const afterSummary = (doc as any).lastAutoTable.finalY + 6;
  
  // Amount in words
  doc.setFont('helvetica','bold').setFontSize(7).text(`${currency} In Words:`, 15, afterSummary);
  doc.setFont('helvetica','normal');
  doc.text(amountInWords(totalAmount, currency) + ' ONLY', 15, afterSummary + 4);

  // Remarks / Notes box
  const remarks = invoice.notes || '';
  const remarksLines = doc.splitTextToSize('Remarks:\n' + (remarks || '---'), pageWidth - 30);
  autoTable(doc, {
    startY: afterSummary + 8,
    body: [[ { content: remarksLines.join('\n'), styles: { fontSize:7, halign:'left' } }]],
    styles: { cellPadding: 3 },
    margin: { left: 15, right: 15 },
    theme: 'grid'
  });

  const afterRemarks = (doc as any).lastAutoTable.finalY + 6;
  
  // Signature sections
  const sigY = afterRemarks + 10;
  doc.setFont('helvetica','normal').text('_________________________', 15, sigY);
  doc.text('_________________________', pageWidth/2 + 20, sigY);
  doc.setFont('helvetica','bold').setFontSize(7).text('Authorized Signatory', 15, sigY + 5);
  doc.text('Supplier Signature Date & Stamp', pageWidth/2 + 20, sigY + 5);
  
  // Footer
  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(15, pageHeight - 25, pageWidth - 15, pageHeight - 25);
  
  doc.setFontSize(7).setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 20, { align: 'center' });
  doc.text('Golden Tag - Your Trusted Trading Partner', pageWidth / 2, pageHeight - 15, { align: 'center' });
  doc.setFontSize(6);
  doc.text('Kingdom of Bahrain | Mobile: +973 XXXX XXXX | Email: info@goldentag.com', pageWidth / 2, pageHeight - 10, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}


export function buildSimplePurchaseInvoicePdf(ctx: PurchaseInvoicePdfContext): Buffer {
  const { invoice } = ctx;
  const doc = baseDoc();
  doc.setFontSize(16).setFont('helvetica','bold').text('PURCHASE INVOICE',20,20);
  doc.setFontSize(10).setFont('helvetica','normal').text(`Invoice #: ${invoice.invoiceNumber}`,20,30);
  doc.text(`Supplier: ${invoice.supplierName}`,20,36);
  doc.text(`Total: ${invoice.currency} ${Number(invoice.totalAmount || 0).toFixed(2)}`,20,42);
  return Buffer.from(doc.output('arraybuffer'));
}

export function generatePurchaseInvoicePdf(ctx: PurchaseInvoicePdfContext): PdfGenerateResult {
  const buffer = (ctx.mode === 'simple' ? buildSimplePurchaseInvoicePdf(ctx) : buildEnhancedPurchaseInvoicePdf(ctx));
  return { 
    buffer, 
    byteLength: buffer.length, 
    fileName: `purchase-invoice-${ctx.invoice.invoiceNumber}.pdf`, 
    contentType: 'application/pdf' 
  };
}

export type { InvoicePdfContext as InvoicePdfOptions, QuotationPdfContext as QuotationPdfOptions, PurchaseInvoicePdfContext as PurchaseInvoicePdfOptions };
