import { db } from "../db";
import { purchaseInvoices, purchaseInvoiceItems, suppliers, goodsReceiptHeaders, supplierLpos } from "../../shared/schema";
import { eq, and, desc, sql, isNotNull } from "drizzle-orm";
import { InsertPurchaseInvoice, InsertPurchaseInvoiceItem } from "../../shared/schema";

export class PurchaseInvoiceStorage {
  async createPurchaseInvoice(data: InsertPurchaseInvoice, items?: InsertPurchaseInvoiceItem[]) {
    try {
      console.log('[PurchaseInvoiceStorage.createPurchaseInvoice][START]', data, items);
      
      const assignedId = crypto.randomUUID();
      const toInsert = {
        ...data,
        id: assignedId,
      };

      const projected = {
        id: toInsert.id,
        invoiceNumber: toInsert.invoiceNumber,
        supplierInvoiceNumber: toInsert.supplierInvoiceNumber,
        supplierId: toInsert.supplierId,
        goodsReceiptId: toInsert.goodsReceiptId,
        lpoId: toInsert.lpoId,
        status: toInsert.status,
        paymentStatus: toInsert.paymentStatus,
        invoiceDate: toInsert.invoiceDate,
        dueDate: toInsert.dueDate,
        receivedDate: toInsert.receivedDate,
        paymentDate: toInsert.paymentDate,
        subtotal: toInsert.subtotal,
        taxAmount: toInsert.taxAmount,
        discountAmount: toInsert.discountAmount,
        totalAmount: toInsert.totalAmount,
        paidAmount: toInsert.paidAmount,
        remainingAmount: toInsert.remainingAmount,
        currency: toInsert.currency,
        paymentTerms: toInsert.paymentTerms,
        notes: toInsert.notes,
        attachments: toInsert.attachments,
        isRecurring: toInsert.isRecurring,
      };

      const inserted = await db
        .insert(purchaseInvoices)
        .values(projected)
        .returning();

      const createdInvoice = inserted[0];

      // Create purchase invoice items if provided
      if (items && items.length > 0) {
        const itemsWithInvoiceId = items.map(item => ({
          ...item,
          purchaseInvoiceId: createdInvoice.id,
        }));

        await db
          .insert(purchaseInvoiceItems)
          .values(itemsWithInvoiceId);
      }

      console.log('[PurchaseInvoiceStorage.createPurchaseInvoice][SUCCESS]', createdInvoice);
      return createdInvoice;
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.createPurchaseInvoice] Error', err, data);
      throw err;
    }
  }

  async getPurchaseInvoices(filters: any = {}) {
    try {
      console.log('[PurchaseInvoiceStorage.getPurchaseInvoices][START]', filters);
      
      const query = db
        .select({
          id: purchaseInvoices.id,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
          supplierId: purchaseInvoices.supplierId,
          goodsReceiptId: purchaseInvoices.goodsReceiptId,
          lpoId: purchaseInvoices.lpoId,
          status: purchaseInvoices.status,
          paymentStatus: purchaseInvoices.paymentStatus,
          invoiceDate: purchaseInvoices.invoiceDate,
          dueDate: purchaseInvoices.dueDate,
          receivedDate: purchaseInvoices.receivedDate,
          paymentDate: purchaseInvoices.paymentDate,
          subtotal: purchaseInvoices.subtotal,
          taxAmount: purchaseInvoices.taxAmount,
          discountAmount: purchaseInvoices.discountAmount,
          totalAmount: purchaseInvoices.totalAmount,
          paidAmount: purchaseInvoices.paidAmount,
          remainingAmount: purchaseInvoices.remainingAmount,
          currency: purchaseInvoices.currency,
          paymentTerms: purchaseInvoices.paymentTerms,
          notes: purchaseInvoices.notes,
          attachments: purchaseInvoices.attachments,
          isRecurring: purchaseInvoices.isRecurring,
          createdAt: purchaseInvoices.createdAt,
          updatedAt: purchaseInvoices.updatedAt,
          // Supplier information
          supplierName: suppliers.name,
          supplierEmail: suppliers.email,
          supplierPhone: suppliers.phone,
          supplierAddress: suppliers.address,
          // Goods receipt information
          goodsReceiptNumber: goodsReceiptHeaders.receiptNumber,
          // LPO information
          lpoNumber: supplierLpos.lpoNumber,
          lpoDate: supplierLpos.lpoDate,
          lpoStatus: supplierLpos.status,
          lpoTotalAmount: supplierLpos.totalAmount,
          lpoCurrency: supplierLpos.currency,
        })
        .from(purchaseInvoices)
        .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
        .leftJoin(goodsReceiptHeaders, eq(purchaseInvoices.goodsReceiptId, goodsReceiptHeaders.id))
        .leftJoin(supplierLpos, eq(purchaseInvoices.lpoId, supplierLpos.id))
        .orderBy(desc(purchaseInvoices.createdAt));

      const results = await query;
      console.log('[PurchaseInvoiceStorage.getPurchaseInvoices][SUCCESS]', results.length, 'records');
      return results;
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.getPurchaseInvoices] Error', err, filters);
      throw err;
    }
  }

  async getPurchaseInvoice(id: string) {
    try {
      console.log('[PurchaseInvoiceStorage.getPurchaseInvoice][START]', { id });
      
      const r = await db
        .select({
          id: purchaseInvoices.id,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
          supplierId: purchaseInvoices.supplierId,
          goodsReceiptId: purchaseInvoices.goodsReceiptId,
          lpoId: purchaseInvoices.lpoId,
          status: purchaseInvoices.status,
          paymentStatus: purchaseInvoices.paymentStatus,
          invoiceDate: purchaseInvoices.invoiceDate,
          dueDate: purchaseInvoices.dueDate,
          receivedDate: purchaseInvoices.receivedDate,
          paymentDate: purchaseInvoices.paymentDate,
          subtotal: purchaseInvoices.subtotal,
          taxAmount: purchaseInvoices.taxAmount,
          discountAmount: purchaseInvoices.discountAmount,
          totalAmount: purchaseInvoices.totalAmount,
          paidAmount: purchaseInvoices.paidAmount,
          remainingAmount: purchaseInvoices.remainingAmount,
          currency: purchaseInvoices.currency,
          paymentTerms: purchaseInvoices.paymentTerms,
          notes: purchaseInvoices.notes,
          attachments: purchaseInvoices.attachments,
          isRecurring: purchaseInvoices.isRecurring,
          createdAt: purchaseInvoices.createdAt,
          updatedAt: purchaseInvoices.updatedAt,
        })
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.id, id))
        .limit(1);

      if (!r.length) {
        console.log('[PurchaseInvoiceStorage.getPurchaseInvoice][NOT_FOUND]', { id });
        return null;
      }

      console.log('[PurchaseInvoiceStorage.getPurchaseInvoice][SUCCESS]', { id });
      return r[0];
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.getPurchaseInvoice] Error', err, { id });
      throw err;
    }
  }

  async updatePurchaseInvoice(id: string, data: Partial<InsertPurchaseInvoice>) {
    try {
      console.log('[PurchaseInvoiceStorage.updatePurchaseInvoice][START]', { id, data });
      
      // Filter out fields that shouldn't be updated
      const { id: _, createdAt, updatedAt, ...cleanData } = data as any;
      
      const updated = await db
        .update(purchaseInvoices)
        .set({
          ...cleanData,
          updatedAt: new Date(),
        })
        .where(eq(purchaseInvoices.id, id))
        .returning();

      if (!updated.length) {
        console.log('[PurchaseInvoiceStorage.updatePurchaseInvoice][NOT_FOUND]', { id });
        return null;
      }

      console.log('[PurchaseInvoiceStorage.updatePurchaseInvoice][SUCCESS]', updated[0]);
      return updated[0];
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.updatePurchaseInvoice] Error', err, { id, data });
      throw err;
    }
  }

  async deletePurchaseInvoice(id: string) {
    try {
      console.log('[PurchaseInvoiceStorage.deletePurchaseInvoice][START]', { id });
      
      const deleted = await db
        .delete(purchaseInvoices)
        .where(eq(purchaseInvoices.id, id))
        .returning();

      if (!deleted.length) {
        return false; // Not found
      }

      console.log('[PurchaseInvoiceStorage.deletePurchaseInvoice][SUCCESS]', { id });
      return true;
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.deletePurchaseInvoice] Error', err, { id });
      throw err;
    }
  }

  async getPurchaseInvoiceItems(purchaseInvoiceId: string) {
    try {
      console.log('[PurchaseInvoiceStorage.getPurchaseInvoiceItems][START]', { purchaseInvoiceId });
      
      const items = await db
        .select()
        .from(purchaseInvoiceItems)
        .where(eq(purchaseInvoiceItems.purchaseInvoiceId, purchaseInvoiceId))
        .orderBy(purchaseInvoiceItems.itemDescription);

      console.log('[PurchaseInvoiceStorage.getPurchaseInvoiceItems][SUCCESS]', { count: items.length });
      return items;
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.getPurchaseInvoiceItems] Error', err, { purchaseInvoiceId });
      throw err;
    }
  }

  async getUniqueSupplierInvoiceNumbers() {
    try {
      console.log('[PurchaseInvoiceStorage.getUniqueSupplierInvoiceNumbers][START]');
      
      const result = await db
        .selectDistinct({
          supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
        })
        .from(purchaseInvoices)
        .where(isNotNull(purchaseInvoices.supplierInvoiceNumber));

      const supplierInvoiceNumbers = result
        .map(row => row.supplierInvoiceNumber)
        .filter(Boolean) // Remove null/undefined values
        .sort();

      console.log('[PurchaseInvoiceStorage.getUniqueSupplierInvoiceNumbers][RESULT]', supplierInvoiceNumbers.length, 'unique supplier invoice numbers found');
      return supplierInvoiceNumbers;
    } catch (err) {
      console.error('[PurchaseInvoiceStorage.getUniqueSupplierInvoiceNumbers][ERROR]', err);
      throw err;
    }
  }
}

export const purchaseInvoiceStorage = new PurchaseInvoiceStorage();
