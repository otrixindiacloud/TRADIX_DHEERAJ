
import { db, pool } from "../db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { supplierQuotes, supplierQuoteItems, customers, salesOrders, customerAcceptances, purchaseOrders, suppliers } from "@shared/schema";

export class SupplierQuoteStorage {
  static async list(params: any) {
    try {
      console.log('SupplierQuoteStorage.list called with params:', params);
      // Build WHERE clause conditions
      const whereConditions = [];
      const queryParams = [];
      let paramIndex = 1;

      // Filter by supplierId if provided
      if (params.supplier && params.supplier !== "" && params.supplier !== "all") {
        whereConditions.push(`sq.supplier_id = $${paramIndex}`);
        queryParams.push(params.supplier);
        paramIndex++;
      }

      // Filter by status
      if (params.status && params.status !== "" && params.status !== "all") {
        whereConditions.push(`sq.status = $${paramIndex}`);
        queryParams.push(params.status);
        paramIndex++;
      }

      // Filter by validUntil (date range)
      if (params.dateFrom) {
        whereConditions.push(`sq.valid_until >= $${paramIndex}`);
        queryParams.push(params.dateFrom);
        paramIndex++;
      }
      if (params.dateTo) {
        whereConditions.push(`sq.valid_until <= $${paramIndex}`);
        queryParams.push(params.dateTo);
        paramIndex++;
      }

      // Filter by search term
      if (params.search && params.search.trim() !== "") {
        whereConditions.push(`(sq.quote_number ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex} OR sq.notes ILIKE $${paramIndex})`);
        queryParams.push(`%${params.search}%`);
        paramIndex++;
      }

      // Build the complete query
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      const query = `
        SELECT 
          sq.id,
          sq.quote_number as "quoteNumber",
          sq.supplier_id as "supplierId",
          sq.status,
          sq.priority,
          sq.quote_date as "quoteDate",
          sq.valid_until as "validUntil",
          sq.request_date as "requestDate",
          sq.response_date as "responseDate",
          sq.subtotal,
          sq.discount_percentage as "discountPercentage",
          sq.discount_amount as "discountAmount",
          sq.tax_amount as "taxAmount",
          sq.total_amount as "totalAmount",
          sq.currency,
          sq.terms,
          sq.notes,
          sq.requisition_id as "requisitionId",
          sq.payment_terms as "paymentTerms",
          sq.delivery_terms as "deliveryTerms",
          sq.rfq_number as "rfqNumber",
          sq.evaluation_score as "evaluationScore",
          sq.competitive_rank as "competitiveRank",
          sq.is_preferred_supplier as "isPreferredSupplier",
          sq.supplier_quotation_document as "supplierQuotationDocument",
          sq.created_by as "createdBy",
          sq.created_at as "createdAt",
          sq.updated_at as "updatedAt",
          s.id as "supplierId",
          s.name as "supplierName",
          s.email as "supplierEmail",
          s.phone as "supplierPhone",
          s.address as "supplierAddress",
          s.contact_person as "supplierContactPerson",
          COALESCE(item_counts.item_count, 0) as "itemCount"
        FROM supplier_quotes sq
        LEFT JOIN suppliers s ON sq.supplier_id = s.id
        LEFT JOIN (
          SELECT 
            supplier_quote_id,
            COUNT(*) as item_count
          FROM supplier_quote_items
          GROUP BY supplier_quote_id
        ) item_counts ON sq.id = item_counts.supplier_quote_id
        ${whereClause}
        ORDER BY sq.created_at DESC
      `;

      // Execute the query using the pool directly
      console.log('Executing query:', query);
      console.log('Query params:', queryParams);
      const result = await pool.query(query, queryParams);
      console.log('Query result rows:', result.rows.length);
      
      // Process results to match expected format
      const processedResults = result.rows.map((row: any) => {
        const supplier = row.supplierId ? {
          id: row.supplierId,
          name: row.supplierName,
          email: row.supplierEmail,
          phone: row.supplierPhone,
          address: row.supplierAddress,
          contactPerson: row.supplierContactPerson,
        } : null;

        return {
          id: row.id,
          quoteNumber: row.quoteNumber,
          supplierId: row.supplierId,
          status: row.status,
          priority: row.priority,
          quoteDate: row.quoteDate,
          requestDate: row.requestDate,
          validUntil: row.validUntil,
          responseDate: row.responseDate,
          subtotal: row.subtotal,
          discountPercentage: row.discountPercentage,
          discountAmount: row.discountAmount,
          taxAmount: row.taxAmount,
          totalAmount: row.totalAmount,
          currency: row.currency,
          terms: row.terms,
          notes: row.notes,
          requisitionId: row.requisitionId,
          paymentTerms: row.paymentTerms,
          deliveryTerms: row.deliveryTerms,
          rfqNumber: row.rfqNumber,
          evaluationScore: row.evaluationScore,
          competitiveRank: row.competitiveRank,
          isPreferredSupplier: row.isPreferredSupplier,
          createdBy: row.createdBy,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          itemCount: parseInt(row.itemCount) || 0,
          supplier,
          supplierName: supplier?.name || "No Supplier"
        };
      });

      return processedResults;
    } catch (error) {
      console.error('Error in SupplierQuoteStorage.list:', error);
      throw error;
    }
  }

  static async getById(id: string) {
    const result = await db
      .select({
        id: supplierQuotes.id,
        quoteNumber: supplierQuotes.quoteNumber,
        // revision: supplierQuotes.revision, // Commented out - column doesn't exist in DB
        parentQuoteId: supplierQuotes.parentQuoteId,
        // revisionReason: supplierQuotes.revisionReason, // Commented out - column doesn't exist in DB
        supersededAt: supplierQuotes.supersededAt,
        supersededBy: supplierQuotes.supersededBy,
        isSuperseded: supplierQuotes.isSuperseded,
        enquiryId: supplierQuotes.enquiryId,
        supplierId: supplierQuotes.supplierId,
        status: supplierQuotes.status,
        priority: supplierQuotes.priority,
        quoteDate: supplierQuotes.quoteDate,
        validUntil: supplierQuotes.validUntil,
        responseDate: supplierQuotes.responseDate,
        subtotal: supplierQuotes.subtotal,
        discountPercentage: supplierQuotes.discountPercentage,
        discountAmount: supplierQuotes.discountAmount,
        taxAmount: supplierQuotes.taxAmount,
        totalAmount: supplierQuotes.totalAmount,
        currency: supplierQuotes.currency,
        terms: supplierQuotes.terms,
        notes: supplierQuotes.notes,
        paymentTerms: supplierQuotes.paymentTerms,
        deliveryTerms: supplierQuotes.deliveryTerms,
        rfqNumber: supplierQuotes.rfqNumber,
        evaluationScore: supplierQuotes.evaluationScore,
        competitiveRank: supplierQuotes.competitiveRank,
        approvalStatus: supplierQuotes.approvalStatus,
        approvedBy: supplierQuotes.approvedBy,
        approvedAt: supplierQuotes.approvedAt,
        rejectionReason: supplierQuotes.rejectionReason,
        supplierQuotationDocument: supplierQuotes.supplierQuotationDocument,
        createdBy: supplierQuotes.createdBy,
        createdAt: supplierQuotes.createdAt,
        updatedAt: supplierQuotes.updatedAt,
        // Add supplier name from suppliers table
        supplierName: suppliers.name,
      })
      .from(supplierQuotes)
      .leftJoin(suppliers, eq(supplierQuotes.supplierId, suppliers.id))
      .where(eq(supplierQuotes.id, id))
      .limit(1);
    return result[0];
  }

  static async getItems(quoteId: string) {
  return await db.select().from(supplierQuoteItems).where(eq(supplierQuoteItems.supplierQuoteId, quoteId));
  }

  static async create(data: any) {
    // Insert quote
  const [quote] = await db.insert(supplierQuotes).values(data).returning();
    // Insert items if present
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
  await db.insert(supplierQuoteItems).values({ ...item, supplierQuoteId: quote.id });
      }
    }
    return await this.getById(quote.id);
  }

  static async update(id: string, updates: any) {
    try {
      // Add updatedAt timestamp
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
      await db.update(supplierQuotes).set(updateData).where(eq(supplierQuotes.id, id));
      return await this.getById(id);
    } catch (error) {
      console.error("Database error in SupplierQuoteStorage.update:", error);
      throw new Error(`Failed to update supplier quote: ${error instanceof Error ? error.message : 'Unknown database error'}`);
    }
  }

  static async hasReferences(id: string) {
    // Check if the supplier quote is referenced by sales orders, customer acceptances, or purchase orders
    const [salesOrderRefs, customerAcceptanceRefs, purchaseOrderRefs] = await Promise.all([
      db
        .select({ id: salesOrders.id })
        .from(salesOrders)
        .where(eq(salesOrders.quotationId, id))
        .limit(1),
      db
        .select({ id: customerAcceptances.id })
        .from(customerAcceptances)
        .where(eq(customerAcceptances.quotationId, id))
        .limit(1),
      db
        .select({ id: purchaseOrders.id })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.quotationId, id))
        .limit(1)
    ]);
    
    return salesOrderRefs.length > 0 || customerAcceptanceRefs.length > 0 || purchaseOrderRefs.length > 0;
  }

  static async delete(id: string) {
    try {
      console.log(`[SupplierQuoteStorage.delete][START] { id: '${id}' }`);
      
      // Check if the quote exists first
      const existingQuote = await db.select().from(supplierQuotes).where(eq(supplierQuotes.id, id)).limit(1);
      if (existingQuote.length === 0) {
        console.log(`[SupplierQuoteStorage.delete][ERROR] Quote not found: ${id}`);
        throw new Error('Supplier quote not found');
      }
      
      // Use transaction to ensure atomicity
      await db.transaction(async (tx) => {
        // Delete supplier quote items first (due to foreign key constraint)
        const deletedItems = await tx.delete(supplierQuoteItems).where(eq(supplierQuoteItems.supplierQuoteId, id));
        console.log(`[SupplierQuoteStorage.delete] Deleted ${deletedItems.rowCount || 0} items`);
        
        // Then delete the supplier quote
        const deletedQuote = await tx.delete(supplierQuotes).where(eq(supplierQuotes.id, id));
        console.log(`[SupplierQuoteStorage.delete] Deleted quote: ${deletedQuote.rowCount || 0} rows`);
        
        if (deletedQuote.rowCount === 0) {
          throw new Error('Failed to delete supplier quote');
        }
      });
      
      console.log(`[SupplierQuoteStorage.delete][SUCCESS] { id: '${id}' }`);
      return { message: "Supplier quote deleted successfully" };
    } catch (error) {
      console.error(`[SupplierQuoteStorage.delete][ERROR] { id: '${id}' }`, error);
      throw error;
    }
  }
}
