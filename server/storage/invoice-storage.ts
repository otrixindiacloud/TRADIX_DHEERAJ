import { db } from "../db";
import { invoices, invoiceItems, InsertInvoice, InsertInvoiceItem, salesOrders, deliveryItems, deliveries, salesOrderItems, items as itemsTable, enquiryItems, customers, InvoiceItem, quotationItems, quotations } from '@shared/schema';
import { and, desc, eq, sql, inArray } from 'drizzle-orm';
import { BaseStorage } from './base';

// Helper to coerce numeric strings -> number safely
function num(val: any): number { if (val === null || val === undefined) return 0; const n = typeof val === 'number' ? val : parseFloat(val); return isNaN(n) ? 0 : n; }

export class InvoiceStorage extends BaseStorage {
  // Basic list with lightweight filtering & pagination
  async getInvoices(filters?: { status?: string; customerId?: string; type?: string; salesOrderId?: string; dateFrom?: string; dateTo?: string; search?: string; currency?: string; limit?: number; offset?: number; }) {
    const limit = filters?.limit ?? 50; const offset = filters?.offset ?? 0;
    let q: any = db.select().from(invoices);
    const conds: any[] = [];
    if (filters) {
      if (filters.status) conds.push(eq(invoices.status, filters.status as any));
      if (filters.type) conds.push(eq(invoices.invoiceType, filters.type as any));
      if (filters.customerId) conds.push(eq(invoices.customerId, filters.customerId));
      if (filters.salesOrderId) conds.push(eq(invoices.salesOrderId, filters.salesOrderId));
      if (filters.currency) conds.push(eq(invoices.currency, filters.currency));
      if (filters.dateFrom) conds.push(sql`${invoices.invoiceDate} >= ${filters.dateFrom}`);
      if (filters.dateTo) conds.push(sql`${invoices.invoiceDate} <= ${filters.dateTo}`);
      if (filters.search) conds.push(sql`${invoices.invoiceNumber} ILIKE ${`%${filters.search}%`}`);
      if (conds.length) q = (q as any).where(and(...conds));
    }
    return (q as any).orderBy(desc(invoices.createdAt)).limit(limit).offset(offset);
  }

  async getInvoice(id: string) {
    const r = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    return r[0];
  }

  async getInvoiceByNumber(invoiceNumber: string) {
    const r = await db.select().from(invoices).where(eq(invoices.invoiceNumber, invoiceNumber)).limit(1);
    return r[0];
  }

  // Comprehensive invoice data fetching with all related information
  async getInvoiceWithCompleteDetails(invoiceNumber: string) {
    try {
      console.log(`[InvoiceStorage] Fetching complete details for invoice: ${invoiceNumber}`);
      
      // Get the invoice
      const invoice = await this.getInvoiceByNumber(invoiceNumber);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Get invoice items
  const invoiceItemsData = await this.getInvoiceItems(invoice.id);
      console.log(`[InvoiceStorage] Found ${invoiceItemsData.length} invoice items`);

      // Get customer details
      const customerData = await db
        .select()
        .from(customers)
        .where(eq(customers.id, invoice.customerId))
        .limit(1);
      const customer = customerData[0] || null;

      // Get sales order details if exists
      let salesOrder = null;
      if (invoice.salesOrderId) {
        const salesOrderData = await db
          .select()
          .from(salesOrders)
          .where(eq(salesOrders.id, invoice.salesOrderId))
          .limit(1);
        salesOrder = salesOrderData[0] || null;

        // Get sales order items if sales order exists
        if (salesOrder) {
          const salesOrderItemsData = await db
            .select()
            .from(salesOrderItems)
            .where(eq(salesOrderItems.salesOrderId, salesOrder.id));
          salesOrder.items = salesOrderItemsData;
        }
      }

      // Get delivery details if exists
      let delivery = null;
      if (invoice.deliveryId) {
        const deliveryData = await db
          .select()
          .from(deliveries)
          .where(eq(deliveries.id, invoice.deliveryId))
          .limit(1);
        delivery = deliveryData[0] || null;

        // Get delivery items if delivery exists
        if (delivery) {
          const deliveryItemsData = await db
            .select()
            .from(deliveryItems)
            .where(eq(deliveryItems.deliveryId, delivery.id));
          delivery.items = deliveryItemsData;
        }
      }

      // Get item details for each invoice item
      const enrichedInvoiceItems = await Promise.all(
        invoiceItemsData.map(async (item) => {
          const existingDetails = (item as any).itemDetails || null;
          if (existingDetails) {
            return {
              ...item,
              productName: (item as any).productName ?? existingDetails.description ?? item.description,
              itemDetails: existingDetails
            };
          }

          const itemData = await db
            .select()
            .from(itemsTable)
            .where(eq(itemsTable.id, item.itemId))
            .limit(1);
          const resolvedDetails = itemData[0] || null;
          return {
            ...item,
            productName: (item as any).productName ?? resolvedDetails?.description ?? item.description,
            itemDetails: resolvedDetails
          };
        })
      );

      // Compile complete invoice data
      const completeInvoiceData = {
        invoice: {
          ...invoice,
          items: enrichedInvoiceItems
        },
        customer,
        salesOrder,
        delivery,
        metadata: {
          totalItems: enrichedInvoiceItems.length,
          hasSalesOrder: !!salesOrder,
          hasDelivery: !!delivery,
          hasCustomer: !!customer,
          fetchedAt: new Date().toISOString()
        }
      };

      console.log(`[InvoiceStorage] Successfully fetched complete invoice data for: ${invoiceNumber}`);
      return completeInvoiceData;
    } catch (error) {
      console.error(`[InvoiceStorage] Error fetching complete invoice data:`, error);
      throw error;
    }
  }

  async createInvoice(data: InsertInvoice) {
    const invoiceNumber = data.invoiceNumber || this.generateNumber('INV');
    const now = new Date();
    const record: any = { ...data, invoiceNumber, createdAt: now, updatedAt: now };
    try {
      const inserted = await db.insert(invoices).values(record).returning();
      return inserted[0];
    } catch (err: any) {
      // If FK constraint on created_by fails (system test user not in users table), retry with null
      if (err?.code === '23503' && String(err?.detail || '').includes('created_by')) {
        const fallback = { ...record, createdBy: null };
        const inserted = await db.insert(invoices).values(fallback).returning();
        return inserted[0];
      }
      throw err;
    }
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice>) {
    const updated = await db.update(invoices).set({ ...data, updatedAt: new Date() }).where(eq(invoices.id, id)).returning();
    return updated[0];
  }

  async deleteInvoice(id: string) {
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  // Generation from delivery: derive customer, sales order, sums from delivered items
  async generateInvoiceFromDelivery(deliveryId: string, invoiceType: string = 'Final', userId?: string, selectedDeliveryItemIds?: string[]) {
    console.log(`[DEBUG] Starting invoice generation for delivery: ${deliveryId}`);
    
    let deliveryRec: any;
    let soId: string;
    let so: any;
    let items: any[];
    
    try {
      const deliveryRecArr = await db.select().from(deliveries).where(eq(deliveries.id, deliveryId)).limit(1);
      deliveryRec = deliveryRecArr[0];
      if (!deliveryRec) throw new Error('Delivery not found');
      console.log(`[DEBUG] Found delivery: ${deliveryRec.deliveryNumber}`);
      soId = deliveryRec.salesOrderId;
      console.log(`[DEBUG] Sales order ID: ${soId}`);
      
      // Sales order ID is required for invoice generation
      if (!soId) {
        throw new Error('Delivery must be linked to a sales order to generate an invoice');
      }
      
      const soArr = await db.select().from(salesOrders).where(eq(salesOrders.id, soId)).limit(1);
      so = soArr[0];
      if (!so) {
        throw new Error('Sales order not found for the delivery');
      }
      console.log(`[DEBUG] Found sales order: ${so.orderNumber}`);
      items = await db.select().from(deliveryItems).where(eq(deliveryItems.deliveryId, deliveryId));
      console.log(`[DEBUG] Found ${items.length} delivery items`);
      
      // Filter items if specific delivery items are selected for partial invoice
      if (selectedDeliveryItemIds && selectedDeliveryItemIds.length > 0) {
        items = items.filter(item => selectedDeliveryItemIds.includes(item.id));
        console.log(`[DEBUG] Filtered to ${items.length} selected delivery items for partial invoice`);
      }
      
      console.log(`[DEBUG] Delivery items data:`, items.map(item => ({
        id: item.id,
        itemId: item.itemId,
        salesOrderItemId: item.salesOrderItemId,
        description: item.description,
        barcode: item.barcode,
        supplierCode: item.supplierCode
      })));
    } catch (error) {
      console.error(`[DEBUG] Error in initial data fetching:`, error);
      throw error;
    }
    
    // If no delivery items found, create them from sales order items
    let itemsToProcess = items;
    if (items.length === 0 && soId) {
      console.log(`[DEBUG] No delivery items found, creating from sales order items`);
      const salesOrderItemsData = await db.select().from(salesOrderItems).where(eq(salesOrderItems.salesOrderId, soId));
      console.log(`[DEBUG] Found ${salesOrderItemsData.length} sales order items`);
      
      // Create virtual delivery items from sales order items
      itemsToProcess = [];
      for (const soItem of salesOrderItemsData) {
        // Skip if specific items are selected and this item is not in the selection
        if (selectedDeliveryItemIds && selectedDeliveryItemIds.length > 0) {
          // For virtual items, we'll use the salesOrderItemId as the identifier
          if (!selectedDeliveryItemIds.includes(soItem.id)) {
            continue;
          }
        }
        // Try to get the actual item data from the items table
        let itemData = null;
        if (soItem.itemId) {
          try {
            const itemResult = await db.select().from(itemsTable).where(eq(itemsTable.id, soItem.itemId)).limit(1);
            if (itemResult.length > 0) {
              itemData = itemResult[0];
            }
          } catch (error) {
            console.log(`[DEBUG] Error fetching item data for ${soItem.itemId}:`, error);
          }
        }
        
        // Use actual item data if available, otherwise use sales order item data
        const barcode = itemData?.barcode || soItem.barcode || `SO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const supplierCode = itemData?.supplierCode || soItem.supplierCode || `SO-${Date.now()}`;
        const description = soItem.description || itemData?.description || soItem.specialInstructions || 'Item from Sales Order';
        
        itemsToProcess.push({
          id: `virtual-${soItem.id}`,
          deliveryId: deliveryId,
          salesOrderItemId: soItem.id,
          itemId: soItem.itemId,
          lineNumber: soItem.lineNumber || itemsToProcess.length + 1,
          barcode: barcode,
          supplierCode: supplierCode,
          description: description,
          orderedQuantity: soItem.quantity,
          pickedQuantity: soItem.quantity,
          deliveredQuantity: soItem.quantity,
          unitPrice: soItem.unitPrice,
          totalPrice: soItem.totalPrice,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      console.log(`[DEBUG] Created ${itemsToProcess.length} virtual delivery items`);
    }
    
    // Attempt to get pricing from related sales order items if present
    // Preload related quotation header and items (if any) so we can apply discounts properly
    let quotationHeader: any = null;
    let quotationItemsRows: any[] = [];
    if (so?.quotationId) {
      try {
        const qHdrArr: any[] = await db.select().from(quotations).where(eq(quotations.id, so.quotationId)).limit(1);
        quotationHeader = qHdrArr[0] || null;
      } catch (e) {
        console.log('[DEBUG] Could not fetch quotation header:', e);
      }
      try {
        // Fetch quotation items list
        quotationItemsRows = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, so.quotationId));
        console.log(`[DEBUG] Preloaded ${quotationItemsRows.length} quotation items for discount mapping`);
      } catch (e) {
        console.log('[DEBUG] Could not fetch quotation items upfront:', e);
        quotationItemsRows = [];
      }
    }

    // Compute a gross basis for proration when quotation has header discountAmount
    let precomputedGrossBasis = 0;
    if (items && items.length) {
      for (const di of items as any[]) {
        // We'll estimate gross using SO unit price when available
        let soItemUnitPrice = 0;
        try {
          if (di.salesOrderItemId) {
            const soItemArr = await db.select().from(salesOrderItems).where(eq(salesOrderItems.id, di.salesOrderItemId)).limit(1);
            soItemUnitPrice = num(soItemArr[0]?.unitPrice);
          }
        } catch {}
        const qty = num((di as any).deliveredQuantity || (di as any).pickedQuantity || (di as any).orderedQuantity || 0);
        const unit = soItemUnitPrice || num((di as any).unitPrice);
        precomputedGrossBasis += qty * unit;
      }
    }
    let subtotal = 0; // subtotal after discount (net)
    let taxTotal = 0;
    let totalDiscount = 0;
    const invoiceItemsToInsert: any[] = [];
    let lineNumber = 1;
    for (const di of itemsToProcess as any[]) {
      console.log(`[DEBUG] Processing delivery item: ${di.id}`);
      console.log(`[DEBUG] Current subtotal before processing item: ${subtotal}`);
      let soItemArr: any[] = [];
      const isValidSalesOrderItemId = di.salesOrderItemId && 
        di.salesOrderItemId !== null && 
        di.salesOrderItemId !== undefined && 
        di.salesOrderItemId !== 'null' &&
        typeof di.salesOrderItemId === 'string' &&
        di.salesOrderItemId.length > 0 &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(di.salesOrderItemId);
      
      if (isValidSalesOrderItemId) {
        try {
          soItemArr = await db.select().from(salesOrderItems).where(eq(salesOrderItems.id, di.salesOrderItemId)).limit(1);
        } catch (soItemError) {
          console.log(`[DEBUG] Error fetching sales order item ${di.salesOrderItemId}:`, soItemError);
          soItemArr = [];
        }
      }
  const soItem: any = soItemArr[0];
      // Attempt to fetch linked enquiry item (via salesOrderItem -> maybe has enquiryItemId or fallback by itemId & description)
      let linkedEnquiryItem: any = null;
      try {
        if (soItem?.enquiryItemId) {
          const enquiryItemRows: any[] = await db.select().from(enquiryItems).where(eq(enquiryItems.id, soItem.enquiryItemId)).limit(1);
          linkedEnquiryItem = enquiryItemRows[0] || null;
        } else if (soItem?.itemId) {
          const enquiryItemRows: any[] = await db.select().from(enquiryItems).where(eq(enquiryItems.itemId, soItem.itemId)).limit(1);
          linkedEnquiryItem = enquiryItemRows[0] || null;
        }
      } catch (enqErr) {
        console.log(`[DEBUG] Unable to fetch linked enquiry item for sales order item ${soItem?.id}:`, enqErr);
      }
      console.log(`[DEBUG] Sales order item: ${soItem?.id || 'None'}`);
      console.log(`[DEBUG] Sales order item data:`, soItem ? {
        id: soItem.id,
        itemId: soItem.itemId,
        quantity: soItem.quantity,
        unitPrice: soItem.unitPrice,
        totalPrice: soItem.totalPrice
      } : 'None');
      
      const qty = num(di.deliveredQuantity || di.pickedQuantity || di.orderedQuantity || soItem?.quantity || 0);
      const unitPrice = num(soItem?.unitPrice || di.unitPrice || 0);
      const lineGross = qty * unitPrice;
      
      console.log(`[DEBUG] Quantity calculation: deliveredQuantity=${di.deliveredQuantity}, pickedQuantity=${di.pickedQuantity}, orderedQuantity=${di.orderedQuantity}, soItem.quantity=${soItem?.quantity}, final qty=${qty}`);
      console.log(`[DEBUG] Unit price calculation: soItem.unitPrice=${soItem?.unitPrice}, di.unitPrice=${di.unitPrice}, final unitPrice=${unitPrice}`);
      console.log(`[DEBUG] Line gross calculation: qty=${qty} * unitPrice=${unitPrice} = ${lineGross}`);
      
      // Add error logging if qty or unitPrice is 0
      if (qty === 0) {
        console.log(`[ERROR] Quantity is 0 for delivery item ${di.id}:`, {
          deliveredQuantity: di.deliveredQuantity,
          pickedQuantity: di.pickedQuantity,
          orderedQuantity: di.orderedQuantity,
          soItemQuantity: soItem?.quantity
        });
      }
      if (unitPrice === 0) {
        console.log(`[ERROR] Unit price is 0 for delivery item ${di.id}:`, {
          soItemUnitPrice: soItem?.unitPrice,
          diUnitPrice: di.unitPrice
        });
      }
      const lineTotal = qty * unitPrice; // Correct total calculation
      const barcode = di.barcode || soItem?.barcode || `AUTO-${lineNumber}`;
      const supplierCode = di.supplierCode || soItem?.supplierCode || 'AUTO-SUP';
  // Get itemId first
  const itemId = soItem?.itemId || di.itemId || null;
  
  // Try to get original quotation item description if available
  let quotationItemDescription = null;
  // We'll also try to capture discount info from related quotation item if available
      let matchingQuotationItem: any = null;
      if (so?.quotationId && quotationItemsRows.length) {
        // Try to match by description (best effort) then fall back to first
        const norm = (s: any) => (s ? String(s).replace(/\s+/g, ' ').trim().toLowerCase() : '');
        const soDesc = norm(soItem?.description);
        matchingQuotationItem = quotationItemsRows.find(qi => norm(qi.description) === soDesc) || quotationItemsRows[0];
        if (matchingQuotationItem && matchingQuotationItem.description) {
          quotationItemDescription = matchingQuotationItem.description;
          console.log(`[DEBUG] Using quotation item description for invoice: ${quotationItemDescription.substring(0, 50)}...`);
        }
      }

  // Compose richer description: priority order -> item master description, quotation item description, sales order item description, delivery item description, enquiry item description
  // plus notes/specifications appended.
  let baseDesc: string = 'Item';
  
  // First try to get the actual item master description
  if (itemId) {
    try {
      const itemArr: any[] = await db.select().from(itemsTable).where(eq(itemsTable.id, itemId)).limit(1);
      const item: any = itemArr[0];
      if (item && item.description && item.description !== 'Generic Item' && item.description !== 'Item from Sales Order') {
        baseDesc = item.description;
        console.log(`[DEBUG] Using item master description: ${baseDesc.substring(0, 50)}...`);
      }
    } catch (error) {
      console.log(`[DEBUG] Error fetching item master description:`, error);
    }
  }
  
  // Fallback to other sources if item master description is not suitable
  if (baseDesc === 'Item' || baseDesc === 'Generic Item' || baseDesc === 'Item from Sales Order') {
    baseDesc = quotationItemDescription || soItem?.description || di.description || linkedEnquiryItem?.description || 'Item';
    console.log(`[DEBUG] Using fallback description: ${baseDesc.substring(0, 50)}...`);
  }
  const extraNotes: string[] = [];
  if (linkedEnquiryItem?.notes) extraNotes.push(linkedEnquiryItem.notes);
  if (soItem?.notes) extraNotes.push(soItem.notes);
  if (di?.pickingNotes) extraNotes.push(di.pickingNotes);
  const composedDescription = extraNotes.length ? `${baseDesc}\n${extraNotes.join('\n')}` : baseDesc;
      console.log(`[DEBUG] Item ID: ${itemId}, Barcode: ${barcode}, Supplier Code: ${supplierCode}`);
      
      // Check if the item exists in the items table - validate itemId more strictly
      const isValidItemId = itemId && 
        itemId !== null && 
        itemId !== undefined && 
        itemId !== 'null' && 
        itemId !== 'undefined' &&
        typeof itemId === 'string' &&
        itemId.length > 0 &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemId);
      
      if (isValidItemId) {
        try {
          const itemArr: any[] = await db.select().from(itemsTable).where(eq(itemsTable.id, itemId)).limit(1);
          const item: any = itemArr[0];
          console.log(`[DEBUG] Item master data:`, item ? {
            id: item.id,
            supplierCode: item.supplierCode,
            barcode: item.barcode,
            description: item.description
          } : 'Item not found in master data');
          
          // If item exists, use its data for better accuracy
          if (item) {
            const finalBarcode = di.barcode || item.barcode || `AUTO-${lineNumber}`;
            const finalSupplierCode = di.supplierCode || item.supplierCode || 'AUTO-SUP';
            const finalDescription = di.description || item.description || 'Item';
            
            console.log(`[DEBUG] Using item master data - Barcode: ${finalBarcode}, Supplier Code: ${finalSupplierCode}, Description: ${finalDescription}`);
          }
        } catch (itemError) {
          console.log(`[DEBUG] Error fetching item ${itemId}:`, itemError);
          console.log(`[DEBUG] Continuing without item master data for itemId: ${itemId}`);
        }
      }
      
      if (!isValidItemId) {
        console.log(`[DEBUG] WARNING: No itemId found for delivery item ${di.id}, attempting to create minimal item...`);
        console.log(`[DEBUG] Taking minimal item creation path for item ${di.id}`);
        
        // Try to create a minimal item as a last resort
        try {
          const minimalItem = {
            supplierCode: di.supplierCode || 'AUTO-SUP',
            barcode: di.barcode || `AUTO-${Date.now()}-${lineNumber}`,
            description: di.description || 'Auto-generated item for invoice',
            category: 'Auto-generated',
            unitOfMeasure: 'EA',
            costPrice: '0.00',
            isActive: true
          };
          
          const [createdItem]: any[] = await db.insert(itemsTable).values(minimalItem as any).returning();
          console.log(`[DEBUG] Created minimal item: ${createdItem.id}`);
          
          // Update the itemId for this delivery item
          const updatedItemId = createdItem.id;
          console.log(`[DEBUG] Using created item ID: ${updatedItemId}`);
          
          // Continue with the created item
          const finalBarcode = di.barcode || createdItem.barcode || `AUTO-${lineNumber}`;
          const finalSupplierCode = di.supplierCode || createdItem.supplierCode || 'AUTO-SUP';
          const finalDescription = di.description || createdItem.description || 'Item';
          
      // Determine discount percent/amount from various sources
      const rawDiscPerc = (
        (soItem as any)?.discountPercentage ??
        (soItem as any)?.discountPercent ??
        (matchingQuotationItem as any)?.discountPercentage ??
        (matchingQuotationItem as any)?.discountPercent ??
        (di as any)?.discountPercentage ??
        (di as any)?.discountPercent ??
        (quotationHeader as any)?.discountPercentage ??
        0
      );
      const discPerc = num(rawDiscPerc);
      // Use explicit amount from line sources; otherwise, if quotation header has discountAmount, prorate by gross basis
      let explicitDiscAmt = num((soItem as any)?.discountAmount ?? (di as any)?.discountAmount ?? (matchingQuotationItem as any)?.discountAmount);
      if (!(explicitDiscAmt > 0) && num((quotationHeader as any)?.discountAmount) > 0) {
        const basis = num((quotationHeader as any)?.subtotal) || precomputedGrossBasis || lineGross || 1;
        explicitDiscAmt = (lineGross / basis) * num((quotationHeader as any)?.discountAmount);
      }
      const percDiscAmt = (lineGross * discPerc) / 100;
      let lineDiscount = explicitDiscAmt > 0 ? explicitDiscAmt : percDiscAmt;
      // Guard: discount should never be 100% of the gross amount (cap at 99.9%)
      const maxDiscount = lineGross * 0.999;
      if (lineDiscount >= lineGross) {
        console.log(`[WARNING] Discount ${lineDiscount} equals or exceeds gross ${lineGross} for item ${di.id}, capping at 99.9%`);
        lineDiscount = maxDiscount;
      }
      console.log(`[DEBUG] Discount calc for item ${di.id}: lineGross=${lineGross}, discPerc=${discPerc}, explicitDiscAmt=${explicitDiscAmt}, percDiscAmt=${percDiscAmt}, lineDiscount=${lineDiscount}`);
      totalDiscount += lineDiscount;
      const lineNet = Math.max(0.01, lineGross - lineDiscount); // Ensure minimum of 0.01
      console.log(`[DEBUG] After item ${di.id}: lineNet=${lineNet}, lineGross=${lineGross}, lineDiscount=${lineDiscount}, subtotal now=${subtotal + lineNet}`);
      subtotal += lineNet; // Use net amount after discount for subtotal

      const lineTax = Math.round((lineNet * 0.10) * 100) / 100;
      taxTotal += lineTax;
          invoiceItemsToInsert.push({
            invoiceId: 'TEMP',
            deliveryItemId: di.id.startsWith('virtual-') ? null : di.id,
            salesOrderItemId: di.salesOrderItemId || soItem?.id || null,
            itemId: updatedItemId,
            barcode: finalBarcode,
            supplierCode: finalSupplierCode,
            description: finalDescription,
            lineNumber,
            quantity: qty,
            unitPrice: unitPrice,
        totalPrice: lineNet,
        discountPercentage: String(discPerc),
        discountAmount: lineDiscount,
            taxRate: '10',
            taxAmount: lineTax,
        unitPriceBase: unitPrice,
        totalPriceBase: lineNet,
        discountAmountBase: lineDiscount,
            taxAmountBase: lineTax,
            returnQuantity: 0,
            notes: null
          });
          lineNumber++;
          continue;
        } catch (createError) {
          console.log(`[DEBUG] ERROR: Failed to create minimal item:`, createError);
          console.log(`[DEBUG] WARNING: Skipping delivery item ${di.id} due to missing itemId and failed item creation`);
          continue;
        }
      }
      
      console.log(`[DEBUG] Taking normal item processing path for item ${di.id}`);
      
      // Ensure we have all required fields - but be more lenient with barcode and supplierCode
      // since they might not be available in sales order items due to schema limitations
      if (!baseDesc) {
        console.log(`[DEBUG] WARNING: Missing description for delivery item ${di.id}, skipping...`);
        continue;
      }
      
      const rawDiscPerc2 = (
        (soItem as any)?.discountPercentage ??
        (soItem as any)?.discountPercent ??
        (matchingQuotationItem as any)?.discountPercentage ??
        (matchingQuotationItem as any)?.discountPercent ??
        (di as any)?.discountPercentage ??
        (di as any)?.discountPercent ??
        (quotationHeader as any)?.discountPercentage ??
        0
      );
      const discPerc2 = num(rawDiscPerc2);
      let explicitDiscAmt2 = num((soItem as any)?.discountAmount ?? (di as any)?.discountAmount ?? (matchingQuotationItem as any)?.discountAmount);
      if (!(explicitDiscAmt2 > 0) && num((quotationHeader as any)?.discountAmount) > 0) {
        const basis2 = num((quotationHeader as any)?.subtotal) || precomputedGrossBasis || lineGross || 1;
        explicitDiscAmt2 = Math.round(((lineGross / basis2) * num((quotationHeader as any)?.discountAmount)) * 100) / 100;
      }
      const percDiscAmt2 = Math.round(((lineGross * discPerc2) / 100) * 100) / 100;
      let lineDiscount2 = explicitDiscAmt2 > 0 ? explicitDiscAmt2 : percDiscAmt2;
      // Guard: discount should never be 100% of the gross amount (cap at 99.9%)
      const maxDiscount2 = lineGross * 0.999;
      if (lineDiscount2 >= lineGross) {
        console.log(`[WARNING] Discount ${lineDiscount2} equals or exceeds gross ${lineGross} for item ${di.id}, capping at 99.9%`);
        lineDiscount2 = maxDiscount2;
      }
      console.log(`[DEBUG] Discount calc for item ${di.id} (path 2): lineGross=${lineGross}, discPerc2=${discPerc2}, explicitDiscAmt2=${explicitDiscAmt2}, percDiscAmt2=${percDiscAmt2}, lineDiscount2=${lineDiscount2}`);
      totalDiscount += lineDiscount2;
      const lineNet2 = Math.max(0.01, Math.round((lineGross - lineDiscount2) * 100) / 100); // Ensure minimum of 0.01
      console.log(`[DEBUG] After item ${di.id} (path 2): lineNet2=${lineNet2}, lineGross=${lineGross}, lineDiscount2=${lineDiscount2}, subtotal now=${subtotal + lineNet2}`);
      subtotal += lineNet2; // Use net amount after discount for subtotal

      const lineTax = Math.round((lineNet2 * 0.10) * 100) / 100;
      taxTotal += lineTax;
      invoiceItemsToInsert.push({
        invoiceId: 'TEMP',
        deliveryItemId: di.id.startsWith('virtual-') ? null : di.id,
        salesOrderItemId: di.salesOrderItemId || soItem?.id || null,
        itemId: itemId,
        barcode,
        supplierCode,
        description: composedDescription,
        lineNumber,
        quantity: qty,
        unitPrice: unitPrice,
        totalPrice: lineNet2,
        discountPercentage: String(discPerc2),
        discountAmount: lineDiscount2,
        taxRate: '10',
        taxAmount: lineTax,
        unitPriceBase: unitPrice,
        totalPriceBase: lineNet2,
        discountAmountBase: lineDiscount2,
        taxAmountBase: lineTax,
        returnQuantity: 0,
        notes: linkedEnquiryItem?.notes || soItem?.notes || null
      });
      lineNumber++;
    }
    console.log(`[DEBUG] Subtotal calculated: ${subtotal}`);
    console.log(`[DEBUG] Invoice items to insert: ${invoiceItemsToInsert.length}`);
    console.log(`[DEBUG] Items processed: ${itemsToProcess.length}`);
    console.log(`[DEBUG] Invoice items total prices:`, invoiceItemsToInsert.map(item => ({
      deliveryItemId: item.deliveryItemId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice
    })));
    
    if (invoiceItemsToInsert.length === 0) {
      console.log(`[DEBUG] ERROR: No valid items found for invoice generation`);
      console.log(`[DEBUG] Items to process:`, itemsToProcess.map(item => ({
        id: item.id,
        itemId: item.itemId,
        barcode: item.barcode,
        supplierCode: item.supplierCode,
        description: item.description
      })));
      
      // Provide more helpful error message
      if (itemsToProcess.length === 0) {
        throw new Error('No delivery items found for this delivery. Please ensure the delivery has items before generating an invoice.');
      } else {
        throw new Error(`Found ${itemsToProcess.length} delivery items but none could be processed for invoice generation. This may be due to missing item references or invalid data.`);
      }
    }
    
    // Validate that we have all required data
    if (!so.customerId) {
      throw new Error('Sales order is missing customer ID');
    }
    
    // Additional validation for required fields
    if (!soId) {
      throw new Error('Sales order ID is required for invoice generation');
    }
    
    if (subtotal <= 0) {
      console.log(`[ERROR] Subtotal is ${subtotal}, invoice items count: ${invoiceItemsToInsert.length}`);
      console.log(`[ERROR] Items processed: ${itemsToProcess.length}`);
      console.log(`[ERROR] Debug info for each item:`);
      for (let i = 0; i < itemsToProcess.length; i++) {
        const di = itemsToProcess[i];
        const soItem = Array.isArray(salesOrderItems) ? 
          salesOrderItems.find(soi => soi.id === di.salesOrderItemId) : 
          null;
        const qty = num(di.deliveredQuantity || di.pickedQuantity || di.orderedQuantity || soItem?.quantity || 0);
        const unitPrice = num(soItem?.unitPrice || di.unitPrice || 0);
        const lineGross = qty * unitPrice;
        console.log(`[ERROR] Item ${i+1}: qty=${qty}, unitPrice=${unitPrice}, lineGross=${lineGross}`);
      }
      // Calculate subtotal from invoice items as a fallback
      const calculatedSubtotal = invoiceItemsToInsert.reduce((sum, item) => sum + num(item.totalPrice), 0);
      console.log(`[ERROR] Calculated subtotal from invoice items: ${calculatedSubtotal}`);
      
      // If we have invoice items with valid totals, use that as the subtotal
      if (calculatedSubtotal > 0) {
        console.log(`[FIX] Using calculated subtotal ${calculatedSubtotal} instead of accumulated subtotal ${subtotal}`);
        subtotal = calculatedSubtotal;
      } else {
        throw new Error(`Invoice subtotal must be greater than zero. Subtotal: ${subtotal}, Calculated: ${calculatedSubtotal}, Items: ${invoiceItemsToInsert.length}, ItemsToProcess: ${itemsToProcess.length}, LineGross values: ${itemsToProcess.map(di => {
          const soItem = Array.isArray(salesOrderItems) ? salesOrderItems.find(soi => soi.id === di.salesOrderItemId) : null;
          const qty = num(di.deliveredQuantity || di.pickedQuantity || di.orderedQuantity || soItem?.quantity || 0);
          const unitPrice = num(soItem?.unitPrice || di.unitPrice || 0);
          const lineGross = qty * unitPrice;
          return `${di.id}:${lineGross}`;
        }).join(',')}`);
      }
    }
    
    console.log(`[DEBUG] Validation passed - proceeding with invoice creation`);
    console.log(`[DEBUG] Sales Order ID: ${soId}`);
    console.log(`[DEBUG] Customer ID: ${so.customerId}`);
    console.log(`[DEBUG] Subtotal: ${subtotal}`);
    
    const invoiceNumber = this.generateNumber('INV');
    console.log(`[DEBUG] Generated invoice number: ${invoiceNumber}`);
    const invoiceInsert: any = {
      invoiceNumber,
      invoiceType,
      salesOrderId: soId, // This is now guaranteed to be non-null
      deliveryId,
      customerId: so.customerId, // Use sales order customer ID as primary source
      status: 'Draft',
      currency: so.currency || 'BHD',
      exchangeRate: so.exchangeRate || '1.0000',
      baseCurrency: so.baseCurrency || 'BHD',
      subtotal: subtotal,
      taxRate: '10',
      taxAmount: taxTotal,
      discountPercentage: '0',
      discountAmount: totalDiscount,
      totalAmount: subtotal + taxTotal,
      paidAmount: 0,
      remainingAmount: subtotal + taxTotal,
      outstandingAmount: subtotal + taxTotal,
      subtotalBase: subtotal,
      taxAmountBase: taxTotal,
      discountAmountBase: totalDiscount,
      totalAmountBase: subtotal + taxTotal,
      autoGenerated: true,
      generatedFromDeliveryId: deliveryId,
      createdBy: userId || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    console.log(`[DEBUG] Inserting invoice with customerId: ${invoiceInsert.customerId}`);
    let invoice: any;
    try {
      const inserted = await db.insert(invoices).values(invoiceInsert).returning();
      invoice = inserted[0];
      console.log(`[DEBUG] Invoice created successfully: ${invoice.id}`);
    } catch (err: any) {
      console.log(`[DEBUG] Invoice creation failed:`, err);
      console.log(`[DEBUG] Error code: ${err?.code}`);
      console.log(`[DEBUG] Error detail: ${err?.detail}`);
      console.log(`[DEBUG] Error message: ${err?.message}`);
      console.log(`[DEBUG] Invoice data being inserted:`, JSON.stringify(invoiceInsert, null, 2));
      
      // Handle foreign key constraint violations
      if (err?.code === '23503') {
        if (String(err?.detail || '').includes('created_by')) {
          console.log(`[DEBUG] Retrying with null createdBy`);
          const inserted = await db.insert(invoices).values({ ...invoiceInsert, createdBy: null }).returning();
          invoice = inserted[0];
          console.log(`[DEBUG] Invoice created with null createdBy: ${invoice.id}`);
        } else if (String(err?.detail || '').includes('customer_id')) {
          throw new Error(`Invalid customer ID: ${invoiceInsert.customerId}. Customer not found. Please ensure the sales order has a valid customer assigned.`);
        } else if (String(err?.detail || '').includes('sales_order_id')) {
          throw new Error(`Invalid sales order ID: ${invoiceInsert.salesOrderId}. Sales order not found. Please ensure the delivery is properly linked to a valid sales order.`);
        } else if (String(err?.detail || '').includes('delivery_id')) {
          throw new Error(`Invalid delivery ID: ${invoiceInsert.deliveryId}. Delivery not found.`);
        } else {
          throw new Error(`Database constraint violation: ${err?.detail || err?.message}`);
        }
      } else if (err?.code === '23505') {
        // Unique constraint violation
        throw new Error(`Invoice number ${invoiceInsert.invoiceNumber} already exists. Please try again.`);
      } else {
        throw new Error(`Database error: ${err?.message || 'Unknown error occurred'}`);
      }
    }
    // Insert items
    console.log(`[DEBUG] Updating invoice items with invoice ID: ${invoice.id}`);
    for (const it of invoiceItemsToInsert) it.invoiceId = invoice.id;
    if (invoiceItemsToInsert.length) {
      try {
        console.log(`[DEBUG] Inserting ${invoiceItemsToInsert.length} invoice items`);
        await db.insert(invoiceItems).values(invoiceItemsToInsert as any).returning();
        console.log(`[DEBUG] Invoice items inserted successfully`);
      } catch (err: any) {
        console.log(`[DEBUG] Invoice items insertion failed:`, err);
        console.log(`[DEBUG] Error code: ${err?.code}`);
        console.log(`[DEBUG] Error detail: ${err?.detail}`);
        console.log(`[DEBUG] Error message: ${err?.message}`);
        console.log(`[DEBUG] Full error:`, JSON.stringify(err, null, 2));
        
        if (err?.code === '23503') {
          if (String(err?.detail || '').includes('invoice_id')) {
            throw new Error(`Invalid invoice ID for items. Invoice may not have been created properly.`);
          } else if (String(err?.detail || '').includes('item_id')) {
            throw new Error(`Invalid item ID in invoice items. One or more items not found.`);
          } else {
            throw new Error(`Database constraint violation in invoice items: ${err?.detail || err?.message}`);
          }
        } else {
          throw new Error(`Database error inserting invoice items: ${err?.message || 'Unknown error occurred'}`);
        }
      }
    }
    console.log(`[DEBUG] Invoice generation completed successfully`);
    return invoice;
  }

  async generateProformaInvoice(salesOrderId: string, userId?: string) {
    // Get sales order to extract customer ID
    const salesOrder = await db.select().from(salesOrders).where(eq(salesOrders.id, salesOrderId)).limit(1);
    if (!salesOrder.length) {
      throw new Error('Sales order not found');
    }

    // Get sales order items to create invoice items
    const salesOrderItemsData = await db.select().from(salesOrderItems).where(eq(salesOrderItems.salesOrderId, salesOrderId));
    if (!salesOrderItemsData.length) {
      throw new Error('No items found in sales order');
    }

    // Create proforma invoice referencing SO with proper customer ID
    const invoiceNumber = this.generateNumber('PFINV');
    const record: any = {
      invoiceNumber,
      invoiceType: 'Proforma',
      salesOrderId,
      customerId: salesOrder[0].customerId,
      status: 'Draft',
      currency: (salesOrder[0] as any).currency || 'BHD',
      exchangeRate: (salesOrder[0] as any).exchangeRate || '1.0000',
      baseCurrency: (salesOrder[0] as any).baseCurrency || 'BHD',
      subtotal: 0,
      taxRate: '10',
      taxAmount: 0,
      discountPercentage: '0',
      discountAmount: 0,
      totalAmount: 0,
      paidAmount: 0,
      remainingAmount: 0,
      outstandingAmount: 0,
      subtotalBase: 0,
      taxAmountBase: 0,
      discountAmountBase: 0,
      totalAmountBase: 0,
      autoGenerated: true,
      createdBy: userId || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    try {
      const inserted = await db.insert(invoices).values(record).returning();
      const invoice = inserted[0];
      
      // Get item details for better descriptions
      const itemIds = salesOrderItemsData.map(soItem => soItem.itemId);
      const itemDetails = await db.select().from(itemsTable).where(inArray(itemsTable.id, itemIds));
      const itemDetailsMap = new Map(itemDetails.map(item => [item.id, item]));

      // Get original quotation item descriptions if available
      let quotationItemsData = [];
      if (salesOrder[0].quotationId) {
        try {
          quotationItemsData = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, salesOrder[0].quotationId));
          console.log(`[DEBUG] Found ${quotationItemsData.length} quotation items for proforma invoice`);
        } catch (error) {
          console.log('[DEBUG] Could not fetch quotation items for descriptions:', error);
        }
      }

      // Create invoice items from sales order items
      let taxTotal = 0;
      const invoiceItemsData = salesOrderItemsData.map((soItem: any, index: number) => {
        const itemDetail = itemDetailsMap.get(soItem.itemId);
        
        // Try to get the best available description in priority order
        let description = 'Item';
        
        // First priority: item master description (if it's not generic)
        if (itemDetail?.description && itemDetail.description !== 'Generic Item' && itemDetail.description !== 'Item from Sales Order') {
          description = itemDetail.description;
          console.log(`[DEBUG] Using item master description for proforma: ${description.substring(0, 50)}...`);
        }
        // Second priority: sales order item description
        else if (soItem?.description && soItem.description !== 'Generic Item' && soItem.description !== 'Item from Sales Order') {
          description = soItem.description;
          console.log(`[DEBUG] Using sales order item description for proforma: ${description.substring(0, 50)}...`);
        }
        // Third priority: quotation item description
        else if (quotationItemsData.length > 0) {
          const matchingQuotationItem = quotationItemsData[index] || quotationItemsData[0];
          if (matchingQuotationItem && matchingQuotationItem.description) {
            description = matchingQuotationItem.description;
            console.log(`[DEBUG] Using quotation item description for proforma: ${description.substring(0, 50)}...`);
          }
        }
        // Last resort: generic fallback
        else {
          description = `Item from Sales Order ${soItem.id}`;
          console.log(`[DEBUG] Using fallback description for proforma: ${description}`);
        }
        
        const lineTax = Math.round((Number(soItem.totalPrice || 0) * 0.10) * 100) / 100;
        taxTotal += lineTax;
        return {
          invoiceId: invoice.id,
          itemId: soItem.itemId,
          barcode: itemDetail?.barcode || `PF-${Date.now()}-${index}`,
          supplierCode: itemDetail?.supplierCode || `PF-${Date.now()}-${index}`,
          description: description,
          lineNumber: index + 1,
          quantity: soItem.quantity,
          unitPrice: soItem.unitPrice,
          totalPrice: soItem.totalPrice,
          discountPercentage: '0',
          discountAmount: '0',
          taxRate: '10',
          taxAmount: lineTax,
          unitPriceBase: soItem.unitPrice,
          totalPriceBase: soItem.totalPrice,
          discountAmountBase: '0',
          taxAmountBase: lineTax,
          returnQuantity: 0,
          returnReason: null,
          notes: soItem.specialInstructions || null
        };
      });

      // Insert invoice items
      await db.insert(invoiceItems).values(invoiceItemsData);

      // Calculate totals and update invoice
      let subtotal = 0;
      let totalAmount = 0;
      
      salesOrderItemsData.forEach((soItem: any) => {
        subtotal += Number(soItem.totalPrice) || 0;
      });
      // Apply 10% VAT for proforma totals
      totalAmount = subtotal + taxTotal;
      
      await db.update(invoices)
        .set({
          subtotal: subtotal.toString(),
          taxAmount: taxTotal.toString(),
          totalAmount: totalAmount.toString(),
          remainingAmount: totalAmount.toString(),
          outstandingAmount: totalAmount.toString(),
          subtotalBase: subtotal.toString(),
          taxAmountBase: taxTotal.toString(),
          totalAmountBase: totalAmount.toString(),
          updatedAt: new Date()
        })
        .where(eq(invoices.id, invoice.id));

      return invoice;
    } catch (err: any) {
      if (err?.code === '23503' && String(err?.detail || '').includes('created_by')) {
        const inserted = await db.insert(invoices).values({ ...record, createdBy: null }).returning();
        const invoice = inserted[0];
        
        // Get item details for better descriptions
        const itemIds = salesOrderItemsData.map(soItem => soItem.itemId);
        const itemDetails = await db.select().from(itemsTable).where(inArray(itemsTable.id, itemIds));
        const itemDetailsMap = new Map(itemDetails.map(item => [item.id, item]));

        // Create invoice items from sales order items
        const invoiceItemsData = salesOrderItemsData.map((soItem: any, index: number) => {
          const itemDetail = itemDetailsMap.get(soItem.itemId);
          const description = itemDetail?.description || `Item from Sales Order ${soItem.id}`;
          
          return {
            invoiceId: invoice.id,
            itemId: soItem.itemId,
            barcode: itemDetail?.barcode || `PF-${Date.now()}-${index}`,
            supplierCode: itemDetail?.supplierCode || `PF-${Date.now()}-${index}`,
            description: description,
            lineNumber: index + 1,
            quantity: soItem.quantity,
            unitPrice: soItem.unitPrice,
            totalPrice: soItem.totalPrice,
            discountPercentage: '0',
            discountAmount: '0',
            taxRate: '0',
            taxAmount: '0',
            unitPriceBase: soItem.unitPrice,
            totalPriceBase: soItem.totalPrice,
            discountAmountBase: '0',
            taxAmountBase: '0',
            returnQuantity: 0,
            returnReason: null,
            notes: soItem.specialInstructions || null
          };
        });

        // Insert invoice items
        await db.insert(invoiceItems).values(invoiceItemsData);

        // Calculate totals and update invoice
        let subtotal = 0;
        let totalAmount = 0;
        
        salesOrderItemsData.forEach((soItem: any) => {
          subtotal += Number(soItem.totalPrice) || 0;
        });
        
        totalAmount = subtotal;
        
        await db.update(invoices)
          .set({
            subtotal: subtotal.toString(),
            totalAmount: totalAmount.toString(),
            remainingAmount: totalAmount.toString(),
            outstandingAmount: totalAmount.toString(),
            subtotalBase: subtotal.toString(),
            totalAmountBase: totalAmount.toString(),
            updatedAt: new Date()
          })
          .where(eq(invoices.id, invoice.id));

        return invoice;
      }
      throw err;
    }
  }

  async sendInvoice(invoiceId: string, email?: string, userId?: string) {
    // Mark as sent; in a real implementation, trigger email sending here using provided email or customer email on record
    const updated = await this.updateInvoice(invoiceId, { status: 'Sent' } as any);
    return {
      message: 'Invoice marked as sent',
      invoice: updated,
      email: email || null,
    };
  }

  async markInvoicePaid(invoiceId: string, paidAmount: number, paymentMethod?: string, paymentReference?: string, userId?: string) {
    const inv = await this.getInvoice(invoiceId);
    if (!inv) throw new Error('Invoice not found');
    const newPaid = num(inv.paidAmount) + paidAmount;
    const outstanding = Math.max(0, num(inv.totalAmount) - newPaid);
    const status = outstanding === 0 ? 'Paid' : inv.status;
    return this.updateInvoice(invoiceId, { 
      paidAmount: newPaid as any, 
      remainingAmount: outstanding as any,
      outstandingAmount: outstanding as any, 
      status 
    } as any);
  }

  // Items
  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    try {
      const rawItems = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoiceId));

      if (!rawItems.length) {
        return rawItems;
      }

      const uniqueItemIds = Array.from(new Set(rawItems.map(item => item.itemId))).filter(Boolean) as string[];
      let itemDetailsMap = new Map<string, any>();

      if (uniqueItemIds.length > 0) {
        const relatedItems = await db
          .select()
          .from(itemsTable)
          .where(inArray(itemsTable.id, uniqueItemIds));
        itemDetailsMap = new Map(relatedItems.map(item => [item.id, item]));
      }

      return rawItems.map(item => {
        const details = itemDetailsMap.get(item.itemId);
        const rawDescription = typeof item.description === 'string'
          ? item.description
          : item.description != null
            ? String(item.description)
            : '';
        const descriptionLines = rawDescription
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
        const informativeLine = descriptionLines.find(line => !/^supplier code:/i.test(line) && !/^barcode:/i.test(line) && !/^notes?:/i.test(line) && !/^specs?:/i.test(line));
        const resolvedName = (item as any).productName
          || details?.description
          || informativeLine
          || descriptionLines[0]
          || rawDescription
          || 'Item';
        return {
          ...item,
          description: rawDescription,
          productName: resolvedName,
          itemDetails: details || null
        } as any;
      });
    } catch (error) {
      console.error('Error fetching invoice items:', error);
      throw new Error('Failed to fetch invoice items');
    }
  }
  async getInvoiceItem(id: string) { const r = await db.select().from(invoiceItems).where(eq(invoiceItems.id, id)).limit(1); return r[0]; }
  async createInvoiceItem(item: InsertInvoiceItem) { const r = await db.insert(invoiceItems).values(item as any).returning(); return r[0]; }
  async updateInvoiceItem(id: string, item: Partial<InsertInvoiceItem>) { const r = await db.update(invoiceItems).set({ ...(item as any), updatedAt: new Date() }).where(eq(invoiceItems.id, id)).returning(); return r[0]; }
  async deleteInvoiceItem(id: string) { await db.delete(invoiceItems).where(eq(invoiceItems.id, id)); }
  async bulkCreateInvoiceItems(itemsArr: InsertInvoiceItem[]) { if (!itemsArr.length) return []; return await db.insert(invoiceItems).values(itemsArr as any).returning(); }

  // Currency helpers (VERY simplified placeholder FX logic)
  async getExchangeRate(fromCurrency: string, toCurrency: string) { if (fromCurrency === toCurrency) return 1; return 1; }
  async convertCurrency(amount: number, fromCurrency: string, toCurrency: string, exchangeRate?: number) { const rate = exchangeRate || await this.getExchangeRate(fromCurrency, toCurrency); return amount * rate; }
  async updateInvoiceCurrency(invoiceId: string, newCurrency: string, exchangeRate: number, userId: string) {
    const inv = await this.getInvoice(invoiceId); if (!inv) throw new Error('Invoice not found');
    const subtotalBase = await this.convertCurrency(num(inv.subtotal), inv.currency as any, newCurrency, exchangeRate);
    const taxAmountBase = await this.convertCurrency(num(inv.taxAmount), inv.currency as any, newCurrency, exchangeRate);
    const discountAmountBase = await this.convertCurrency(num(inv.discountAmount), inv.currency as any, newCurrency, exchangeRate);
    const totalAmountBase = await this.convertCurrency(num(inv.totalAmount), inv.currency as any, newCurrency, exchangeRate);
    return this.updateInvoice(invoiceId, { currency: newCurrency as any, exchangeRate: exchangeRate as any, subtotalBase: subtotalBase as any, taxAmountBase: taxAmountBase as any, discountAmountBase: discountAmountBase as any, totalAmountBase: totalAmountBase as any } as any);
  }
}