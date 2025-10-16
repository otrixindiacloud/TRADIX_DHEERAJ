import { db } from "../db";
import { supplierLpos, supplierLpoItems, salesOrders, salesOrderItems, items, suppliers, supplierQuotes, supplierQuoteItems, enquiries, customers, InsertSupplierLpo, InsertSupplierLpoItem, type SupplierLpo } from "@shared/schema";
import { and, desc, eq, sql, inArray, or } from "drizzle-orm";
import { BaseStorage } from "./base";

export class SupplierLpoStorage extends BaseStorage {
  async getSupplierLpos(limit = 50, offset = 0, filters?: { status?: string; supplierId?: string; dateFrom?: string; dateTo?: string; search?: string; }) {
    // First, get the LPOs with supplier data
    let base = db.select({
      id: supplierLpos.id,
      lpoNumber: supplierLpos.lpoNumber,
      supplierId: supplierLpos.supplierId,
      supplierName: suppliers.name,
      status: supplierLpos.status,
      lpoDate: supplierLpos.lpoDate,
      expectedDeliveryDate: supplierLpos.expectedDeliveryDate,
      requestedDeliveryDate: supplierLpos.requestedDeliveryDate,
      subtotal: supplierLpos.subtotal,
      taxAmount: supplierLpos.taxAmount,
      totalAmount: supplierLpos.totalAmount,
      currency: supplierLpos.currency,
      approvalStatus: supplierLpos.approvalStatus,
      requiresApproval: supplierLpos.requiresApproval,
      paymentTerms: supplierLpos.paymentTerms,
      deliveryTerms: supplierLpos.deliveryTerms,
      version: supplierLpos.version,
      createdAt: supplierLpos.createdAt,
      updatedAt: supplierLpos.updatedAt,
      createdBy: supplierLpos.createdBy,
      sourceType: supplierLpos.sourceType,
      sourceSalesOrderIds: supplierLpos.sourceSalesOrderIds,
      sourceQuotationIds: supplierLpos.sourceQuotationIds,
      groupingCriteria: supplierLpos.groupingCriteria,
      termsAndConditions: supplierLpos.termsAndConditions,
      specialInstructions: supplierLpos.specialInstructions,
      parentLpoId: supplierLpos.parentLpoId,
      amendmentReason: supplierLpos.amendmentReason,
      amendmentType: supplierLpos.amendmentType,
      approvedBy: supplierLpos.approvedBy,
      approvedAt: supplierLpos.approvedAt,
      approvalNotes: supplierLpos.approvalNotes,
      sentToSupplierAt: supplierLpos.sentToSupplierAt,
      confirmedBySupplierAt: supplierLpos.confirmedBySupplierAt,
      supplierConfirmationReference: supplierLpos.supplierConfirmationReference,
      supplierContactPerson: supplierLpos.supplierContactPerson,
      supplierEmail: supplierLpos.supplierEmail,
      supplierPhone: supplierLpos.supplierPhone
    }).from(supplierLpos)
    .leftJoin(suppliers, eq(supplierLpos.supplierId, suppliers.id));
    
    const conditions: any[] = [];
    if (filters) {
      if (filters.status) conditions.push(eq(supplierLpos.status, filters.status as any));
      if (filters.supplierId) conditions.push(eq(supplierLpos.supplierId, filters.supplierId));
      if (filters.dateFrom) conditions.push(sql`${supplierLpos.lpoDate} >= ${filters.dateFrom}`);
      if (filters.dateTo) conditions.push(sql`${supplierLpos.lpoDate} <= ${filters.dateTo}`);
      if (filters.search) conditions.push(sql`(${supplierLpos.lpoNumber} ILIKE ${`%${filters.search}%`} OR ${suppliers.name} ILIKE ${`%${filters.search}%`})`);
      if (conditions.length) base = (base as any).where(and(...conditions));
    }
    const lpos = await (base as any).orderBy(desc(supplierLpos.createdAt)).limit(limit).offset(offset);
    
    // Enrich with customer data from source sales orders
    const enrichedLpos = await Promise.all(lpos.map(async (lpo: any) => {
      if (lpo.sourceSalesOrderIds && Array.isArray(lpo.sourceSalesOrderIds) && lpo.sourceSalesOrderIds.length > 0) {
        try {
          // Get customer data from the first source sales order
          const firstSalesOrderId = lpo.sourceSalesOrderIds[0];
          const salesOrderWithCustomer = await db
            .select({
              customerId: customers.id,
              customerName: customers.name
            })
            .from(salesOrders)
            .leftJoin(customers, eq(salesOrders.customerId, customers.id))
            .where(eq(salesOrders.id, firstSalesOrderId))
            .limit(1);
          
          if (salesOrderWithCustomer[0]) {
            return {
              ...lpo,
              customerId: salesOrderWithCustomer[0].customerId,
              customerName: salesOrderWithCustomer[0].customerName
            };
          }
        } catch (error) {
          console.error('Error fetching customer data for LPO:', lpo.id, error);
        }
      }
      
      // Try to extract customer name from notes/special instructions as fallback
      let customerName = null;
      if (lpo.specialInstructions) {
        const customerMatch = lpo.specialInstructions.match(/from customer\s+([^,\s]+)/i);
        if (customerMatch && customerMatch[1]) {
          customerName = customerMatch[1];
        }
      }
      
      return {
        ...lpo,
        customerId: null,
        customerName: customerName
      };
    }));
    
    return enrichedLpos;
  }
  async getSupplierLpo(id: string) { const r = await db.select().from(supplierLpos).where(eq(supplierLpos.id, id)).limit(1); return r[0]; }
  
  async getSupplierLposCount(filters?: { status?: string; supplierId?: string; dateFrom?: string; dateTo?: string; search?: string; }) {
    let base = db.select({ count: sql<number>`count(*)` }).from(supplierLpos)
      .leftJoin(suppliers, eq(supplierLpos.supplierId, suppliers.id));
    
    const conditions: any[] = [];
    if (filters) {
      if (filters.status) conditions.push(eq(supplierLpos.status, filters.status as any));
      if (filters.supplierId) conditions.push(eq(supplierLpos.supplierId, filters.supplierId));
      if (filters.dateFrom) conditions.push(sql`${supplierLpos.lpoDate} >= ${filters.dateFrom}`);
      if (filters.dateTo) conditions.push(sql`${supplierLpos.lpoDate} <= ${filters.dateTo}`);
      if (filters.search) conditions.push(sql`(${supplierLpos.lpoNumber} ILIKE ${`%${filters.search}%`} OR ${suppliers.name} ILIKE ${`%${filters.search}%`})`);
      if (conditions.length) base = (base as any).where(and(...conditions));
    }
    const result = await base;
    return result[0]?.count || 0;
  }
  async createSupplierLpo(data: Partial<InsertSupplierLpo>) {
    const lpoNumber = data.lpoNumber || this.generateNumber("LPO");
    let supplierId = data.supplierId;
    if (!supplierId) {
      const existing = await db.select().from(suppliers).limit(1);
      if (existing[0]) supplierId = existing[0].id; else {
        const created = await db.insert(suppliers).values({ name: "Auto Supplier", contactPerson: "System" } as any).returning();
        supplierId = created[0].id;
      }
    }
    console.debug('[SupplierLpoStorage.createSupplierLpo] Preparing insert', { lpoNumber, supplierId });
        const record: any = {
      lpoNumber,
      supplierId,
      status: data.status || 'Draft',
      sourceType: data.sourceType || 'Manual',
      groupingCriteria: data.groupingCriteria,
      subtotal: data.subtotal,
      taxAmount: data.taxAmount,
      totalAmount: data.totalAmount,
  currency: data.currency || 'BHD',
      requiresApproval: data.requiresApproval || false,
      approvalStatus: data.approvalStatus || (data.requiresApproval ? 'Pending' : 'Not Required'),
      createdBy: (data as any).createdBy || null, // Allow null for createdBy
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      sourceSalesOrderIds: data.sourceSalesOrderIds,
      sourceQuotationIds: data.sourceQuotationIds,
    };
    console.debug('[SupplierLpoStorage.createSupplierLpo] Insert record', record);
    const inserted = await db.insert(supplierLpos).values(record).returning();
    console.debug('[SupplierLpoStorage.createSupplierLpo] Insert result', inserted);
    if (!inserted || !inserted[0]) {
      console.error('[SupplierLpoStorage.createSupplierLpo] Insert returned empty result set', { record });
      throw new Error('Failed to insert supplier LPO');
    }
    return inserted[0];
  }
  async updateSupplierLpo(id: string, data: Partial<InsertSupplierLpo>) { const updated: any = { ...data, updatedAt: new Date() }; const res = await db.update(supplierLpos).set(updated).where(eq(supplierLpos.id, id)).returning(); return res[0]; }
  async updateSupplierLpoStatus(id: string, status: string, userId?: string) {
    const allowedStatuses = ["Draft", "Pending", "Sent", "Confirmed", "Received", "Cancelled"];
    if (!allowedStatuses.includes(status)) {
      console.error(`[updateSupplierLpoStatus] Invalid status value: ${status}`);
      throw new Error(`Invalid status value: ${status}`);
    }
    console.log(`[updateSupplierLpoStatus] Attempting update: id=${id}, status=${status}, userId=${userId}`);
    const updated = {
      status: status as "Draft" | "Pending" | "Sent" | "Confirmed" | "Received" | "Cancelled",
      updatedAt: new Date(),
      updatedBy: userId || null
    };
    const res = await db.update(supplierLpos)
      .set(updated)
      .where(eq(supplierLpos.id, id))
      .returning();
    console.log(`[updateSupplierLpoStatus] Update result:`, res);
    return res[0];
  }
  async deleteSupplierLpo(id: string) { await db.delete(supplierLpos).where(eq(supplierLpos.id, id)); }
  async createSupplierLposFromSalesOrders(salesOrderIds: string[], groupBy: string, userId?: string, supplierIdOverride?: string) {
    if (!salesOrderIds.length) return [];
    const out: any[] = [];
    for (const soId of salesOrderIds) {
      const so = (await db.select().from(salesOrders).where(eq(salesOrders.id, soId)).limit(1))[0];
      if (!so) continue;
      const soItems = await db.select().from(salesOrderItems).where(eq(salesOrderItems.salesOrderId, soId));
      
      // Skip if no sales order items found
      if (!soItems.length) {
        console.warn(`No items found for sales order ${soId}, skipping LPO creation`);
        continue;
      }
      
      let subtotal = 0; soItems.forEach(i=> subtotal += Number(i.totalPrice||0));
      const lpo = await this.createSupplierLpo({ supplierId: supplierIdOverride, sourceType: 'Auto', groupingCriteria: groupBy, subtotal: subtotal.toFixed(2), totalAmount: subtotal.toFixed(2), sourceSalesOrderIds: [soId], createdBy: userId } as any);
      
      // Get or create a fallback item
      let existingItem = (await db.select().from(items).limit(1))[0];
      if (!existingItem) {
        // Create a fallback item if none exists
        const fallbackItem = await db.insert(items).values({
          supplierCode: `GEN-${Date.now()}`,
          description: 'Auto-generated fallback item',
          barcode: `AUTO-${Date.now()}`,
          category: 'Auto-generated',
          unit: 'PCS',
          retailPrice: '0.00',
          wholesalePrice: '0.00',
          costPrice: '0.00',
          stockQuantity: 0,
          minStockLevel: 0,
          maxStockLevel: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();
        existingItem = fallbackItem[0];
      }
      
      const fallbackBarcode = existingItem?.barcode || `AUTO-${Date.now()}`;
      const lpoItems = soItems.map((soi, idx) => ({
        supplierLpoId: lpo.id,
        itemId: soi.itemId || existingItem?.id,
        salesOrderItemId: soi.id,
        supplierCode: existingItem?.supplierCode || 'GEN-SUP',
        barcode: fallbackBarcode,
        itemDescription: soi.description || 'Auto-generated from Sales Order',
        quantity: soi.quantity,
        receivedQuantity: 0,
        pendingQuantity: soi.quantity, // initial pending equals ordered
        unitCost: soi.unitPrice as any || '0',
        totalCost: soi.totalPrice as any || '0',
        // Include discount fields from sales order item
        discountPercent: (soi as any).discountPercent || (soi as any).discountPercentage || 0,
        discountAmount: (soi as any).discountAmount || 0,
        currency: 'BHD',
        lineNumber: idx + 1,
        deliveryStatus: 'Pending'
      }));
      
      if (lpoItems.length) {
        await db.insert(supplierLpoItems).values(lpoItems as any);
        console.log(`Created LPO ${lpo.id} with ${lpoItems.length} items from sales order ${soId}`);
      }
      out.push(lpo);
    }
    return out;
  }
  async createSupplierLposFromSupplierQuotes(quoteIds: string[], groupBy: string, userId?: string) {
    const out: SupplierLpo[] = [];
    if (!quoteIds.length) return out;
    
    // Get supplier quotes with their items
    const quotes = [];
    for (const quoteId of quoteIds) {
      const quote = await db
        .select({
          id: supplierQuotes.id,
          quoteNumber: supplierQuotes.quoteNumber,
          supplierId: supplierQuotes.supplierId,
          // Remove enquiryId from select to avoid column error
          // enquiryId: supplierQuotes.enquiryId,
          status: supplierQuotes.status,
          subtotal: supplierQuotes.subtotal,
          taxAmount: supplierQuotes.taxAmount,
          totalAmount: supplierQuotes.totalAmount,
          currency: supplierQuotes.currency,
          terms: supplierQuotes.terms,
          notes: supplierQuotes.notes,
          paymentTerms: supplierQuotes.paymentTerms,
          deliveryTerms: supplierQuotes.deliveryTerms,
          validUntil: supplierQuotes.validUntil,
        })
        .from(supplierQuotes)
        .where(eq(supplierQuotes.id, quoteId))
        .limit(1);
      
      if (quote[0]) {
        quotes.push(quote[0]);
      }
    }
    
    if (!quotes.length) return out;
    
    // Get customer name from enquiry if available - COMMENTED OUT since enquiryId column doesn't exist yet
    let customerName: string | null = null;
    /*
    const firstQuoteWithEnquiry = quotes.find(q => q.enquiryId);
    if (firstQuoteWithEnquiry?.enquiryId) {
      const enquiryResult = await db
        .select({
          customerId: enquiries.customerId,
          customerName: customers.name
        })
        .from(enquiries)
        .leftJoin(customers, eq(enquiries.customerId, customers.id))
        .where(eq(enquiries.id, firstQuoteWithEnquiry.enquiryId))
        .limit(1);
      
      if (enquiryResult[0]?.customerName) {
        customerName = enquiryResult[0].customerName;
      }
    }
    */
    
    // Group quotes by supplier if groupBy is 'supplier'
    const groupedQuotes = groupBy === 'supplier' 
      ? quotes.reduce((acc, quote) => {
          const supplierId = quote.supplierId;
          if (!acc[supplierId]) acc[supplierId] = [];
          acc[supplierId].push(quote);
          return acc;
        }, {} as Record<string, typeof quotes>)
      : { 'single': quotes };
    
    for (const [supplierId, supplierQuotes] of Object.entries(groupedQuotes)) {
      if (!supplierQuotes.length) continue;
      
      // Get quote items for all quotes in this group
      const quoteItems = [];
      for (const quote of supplierQuotes) {
        const items = await db
          .select({
            id: supplierQuoteItems.id,
            supplierQuoteId: supplierQuoteItems.supplierQuoteId,
            itemDescription: supplierQuoteItems.itemDescription,
            quantity: supplierQuoteItems.quantity,
            unitPrice: supplierQuoteItems.unitPrice,
            lineTotal: supplierQuoteItems.lineTotal,
            unitOfMeasure: supplierQuoteItems.unitOfMeasure,
            specification: supplierQuoteItems.specification,
            brand: supplierQuoteItems.brand,
            model: supplierQuoteItems.model,
            warranty: supplierQuoteItems.warranty,
            leadTime: supplierQuoteItems.leadTime,
            notes: supplierQuoteItems.notes,
            // Include discount fields
            discountPercentage: supplierQuoteItems.discountPercentage,
            discountAmount: supplierQuoteItems.discountAmount,
          })
          .from(supplierQuoteItems)
          .where(eq(supplierQuoteItems.supplierQuoteId, quote.id));
        quoteItems.push(...items);
      }
      
      // Skip if no quote items found
      if (!quoteItems.length) {
        console.warn(`No items found for supplier quotes ${supplierQuotes.map(q => q.id).join(', ')}, skipping LPO creation`);
        continue;
      }
      
      // Calculate totals
      const subtotal = supplierQuotes.reduce((sum, quote) => sum + Number(quote.subtotal || 0), 0);
      const taxAmount = supplierQuotes.reduce((sum, quote) => sum + Number(quote.taxAmount || 0), 0);
      const totalAmount = supplierQuotes.reduce((sum, quote) => sum + Number(quote.totalAmount || 0), 0);
      
      // Prepare notes with customer name
      let lpoNotes = supplierQuotes[0].notes || '';
      if (customerName) {
        // Add customer name to notes in text format
        const customerInfo = `Customer: ${customerName}`;
        lpoNotes = lpoNotes ? `${customerInfo}\n\n${lpoNotes}` : customerInfo;
      }
      
      // Create LPO
      const lpo = await this.createSupplierLpo({
        supplierId: supplierId === 'single' ? supplierQuotes[0].supplierId : supplierId,
        status: 'Draft',
        sourceType: 'SupplierQuote',
        groupingCriteria: groupBy,
        subtotal,
        taxAmount,
        totalAmount,
        currency: supplierQuotes[0].currency || 'BHD',
        createdBy: userId,
        requiresApproval: false,
        approvalStatus: 'Not Required',
        sourceQuotationIds: supplierQuotes.map(q => q.id),
        lpoDate: new Date(),
        expectedDeliveryDate: supplierQuotes[0].validUntil ? new Date(supplierQuotes[0].validUntil) : undefined,
        paymentTerms: supplierQuotes[0].paymentTerms,
        deliveryTerms: supplierQuotes[0].deliveryTerms,
        termsAndConditions: supplierQuotes[0].terms,
        specialInstructions: lpoNotes,
      } as any);
      
      // Create LPO items from quote items
      const lpoItems = quoteItems.map((item, idx) => ({
        supplierLpoId: lpo.id,
        quotationItemId: item.id, // Link to the original quote item
        itemId: null, // Will be filled when item is identified
        supplierCode: 'GEN-SUP', // Default supplier code
        barcode: `QUOTE-${item.id}`, // Generate barcode from quote item ID
        itemDescription: item.itemDescription,
        quantity: item.quantity,
        receivedQuantity: 0,
        pendingQuantity: item.quantity,
        unitCost: item.unitPrice as any,
        totalCost: item.lineTotal as any, // Use lineTotal instead of totalPrice
        // Include discount fields from quote item
        discountPercent: (item as any).discountPercentage || 0,
        discountAmount: (item as any).discountAmount || 0,
        lineNumber: idx + 1,
        deliveryStatus: 'Pending',
        urgency: 'Normal',
        specialInstructions: [
          item.specification,
          item.brand ? `Brand: ${item.brand}` : '',
          item.model ? `Model: ${item.model}` : '',
          item.warranty ? `Warranty: ${item.warranty}` : '',
          item.leadTime ? `Lead Time: ${item.leadTime}` : '',
          item.notes || ''
        ].filter(Boolean).join(' | '), // Combine all item details into special instructions
      }));
      
      if (lpoItems.length) {
        await db.insert(supplierLpoItems).values(lpoItems as any);
        console.log(`Created LPO ${lpo.id} with ${lpoItems.length} items from supplier quotes ${supplierQuotes.map(q => q.id).join(', ')}`);
      }
      
      out.push(lpo);
    }
    return out;
  }
  async createAmendedSupplierLpo(parentLpoId: string, reason: string, amendmentType: string, userId?: string) {
    const parent = await this.getSupplierLpo(parentLpoId); if (!parent) throw new Error('Parent LPO not found');
    return this.createSupplierLpo({ supplierId: parent.supplierId, sourceType: parent.sourceType, groupingCriteria: parent.groupingCriteria, subtotal: parent.subtotal, totalAmount: parent.totalAmount, currency: parent.currency, version: (parent.version||1)+1, parentLpoId, amendmentReason: reason, amendmentType, createdBy: userId, requiresApproval: parent.requiresApproval, approvalStatus: parent.approvalStatus, sourceSalesOrderIds: parent.sourceSalesOrderIds } as any);
  }
  async submitForApproval(id: string, userId: string) { const lpo = await this.getSupplierLpo(id); if (!lpo) throw new Error('Supplier LPO not found'); return this.updateSupplierLpo(id, { requiresApproval: true, approvalStatus: 'Pending' } as any); }
  async approveSupplierLpo(id: string, userId: string, notes?: string) { const lpo = await this.getSupplierLpo(id); if (!lpo) throw new Error('Supplier LPO not found'); return this.updateSupplierLpo(id, { approvalStatus: 'Approved', approvedBy: userId as any, approvedAt: new Date(), approvalNotes: notes } as any); }
  async rejectSupplierLpo(id: string, userId: string, notes: string) { const lpo = await this.getSupplierLpo(id); if (!lpo) throw new Error('Supplier LPO not found'); return this.updateSupplierLpo(id, { approvalStatus: 'Rejected', approvalNotes: notes } as any); }
  async sendToSupplier(id: string, userId: string) { const lpo = await this.getSupplierLpo(id); if (!lpo) throw new Error('Supplier LPO not found'); return this.updateSupplierLpo(id, { status: 'Sent', sentToSupplierAt: new Date() } as any); }
  async confirmBySupplier(id: string, confirmationReference?: string) { const lpo = await this.getSupplierLpo(id); if (!lpo) throw new Error('Supplier LPO not found'); return this.updateSupplierLpo(id, { status: 'Confirmed', confirmedBySupplierAt: new Date(), supplierConfirmationReference: confirmationReference } as any); }
  async updateExpectedDeliveryDate(id: string, expectedDeliveryDate: string, userId?: string) { 
    const lpo = await this.getSupplierLpo(id); 
    if (!lpo) throw new Error('Supplier LPO not found'); 
    return this.updateSupplierLpo(id, { 
      expectedDeliveryDate: new Date(expectedDeliveryDate), 
      updatedAt: new Date() 
    } as any); 
  }
  async getSupplierLpoBacklog() { return db.select().from(supplierLpos).where(sql`${supplierLpos.status} IN ('Draft','Sent')`); }
  async getCustomerOrderBacklog() { return []; }
  async getSupplierLpoItems(lpoId: string) { return db.select().from(supplierLpoItems).where(eq(supplierLpoItems.supplierLpoId, lpoId)); }
  async getSupplierLpoItem(id: string) { const r = await db.select().from(supplierLpoItems).where(eq(supplierLpoItems.id, id)).limit(1); return r[0]; }
  async createSupplierLpoItem(item: InsertSupplierLpoItem) { const r = await db.insert(supplierLpoItems).values(item as any).returning(); return r[0]; }
  async updateSupplierLpoItem(id: string, item: Partial<InsertSupplierLpoItem>) { const r = await db.update(supplierLpoItems).set(item as any).where(eq(supplierLpoItems.id, id)).returning(); return r[0]; }
  async deleteSupplierLpoItem(id: string) { await db.delete(supplierLpoItems).where(eq(supplierLpoItems.id, id)); }
  async bulkCreateSupplierLpoItems(itemsArr: InsertSupplierLpoItem[]) { if (!itemsArr.length) return []; const r = await db.insert(supplierLpoItems).values(itemsArr as any).returning(); return r; }
}
