import { db } from "../db";
import { 
  materialReceipt, 
  materialReceiptItems, 
  insertMaterialReceiptSchema, 
  insertMaterialReceiptItemSchema,
  suppliers
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export class MaterialReceiptsStorage {
  /**
   * Create a new material receipt with items
   */
  async createMaterialReceipt(data: any) {
    console.log('[MATERIAL RECEIPTS STORAGE] Creating material receipt with data:', JSON.stringify(data, null, 2));
    
    // Extract items from data
    const items = data.items || [];
    delete data.items; // Remove items from header data
    
    // Prepare header data
    const headerData: any = { ...data };
    if (!headerData.id) headerData.id = randomUUID();
    if (!headerData.status) headerData.status = "Pending";
    if (!headerData.receiptDate) headerData.receiptDate = new Date();
    
    // Convert string dates to Date objects for validation
    // Handle empty strings as null
    if (headerData.receiptDate) {
      if (typeof headerData.receiptDate === 'string') {
        if (headerData.receiptDate.trim() === '') {
          headerData.receiptDate = new Date();
        } else {
          headerData.receiptDate = new Date(headerData.receiptDate);
        }
      }
    }
    
    if (headerData.invoiceDate) {
      if (typeof headerData.invoiceDate === 'string') {
        if (headerData.invoiceDate.trim() === '') {
          headerData.invoiceDate = null;
        } else {
          headerData.invoiceDate = new Date(headerData.invoiceDate);
        }
      }
    }
    
    if (headerData.dueDate) {
      if (typeof headerData.dueDate === 'string') {
        if (headerData.dueDate.trim() === '') {
          headerData.dueDate = null;
        } else {
          headerData.dueDate = new Date(headerData.dueDate);
        }
      }
    }
    
    console.log('[MATERIAL RECEIPTS STORAGE] Header data after date conversion:', JSON.stringify({
      receiptDate: headerData.receiptDate,
      invoiceDate: headerData.invoiceDate,
      dueDate: headerData.dueDate,
      receiptDateType: typeof headerData.receiptDate,
      invoiceDateType: typeof headerData.invoiceDate,
      dueDateType: typeof headerData.dueDate
    }, null, 2));
    
    // Validate header data (remove id for validation)
    const headerForValidation = { ...headerData };
    delete headerForValidation.id;
    
    let validatedHeader: any;
    try {
      validatedHeader = insertMaterialReceiptSchema.parse(headerForValidation);
      console.log('[MATERIAL RECEIPTS STORAGE] Header validated successfully');
    } catch (error) {
      console.error('[MATERIAL RECEIPTS STORAGE] Header validation error:', error);
      throw error;
    }
    
    // Insert header
    const headerToInsert = {
      id: headerData.id,
      ...validatedHeader
    };
    
    console.log('[MATERIAL RECEIPTS STORAGE] Inserting header:', headerToInsert);
    const [insertedHeader] = await db
      .insert(materialReceipt)
      .values(headerToInsert)
      .returning();
    
    console.log('[MATERIAL RECEIPTS STORAGE] Header inserted:', insertedHeader);
    
    // Process and insert items if any
    let insertedItems: any[] = [];
    if (items.length > 0) {
      console.log('[MATERIAL RECEIPTS STORAGE] Processing items:', items.length);
      
      // Helper function to convert numbers to strings for decimal fields
      const toDecimalString = (value: any): string => {
        if (value === null || value === undefined) return '0';
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return value.toString();
        return '0';
      };
      
      const itemsToInsert = items.map((item: any, index: number) => {
        const itemData = {
          id: randomUUID(),
          materialReceiptId: insertedHeader.id,
          serialNo: item.serialNo || index + 1,
          itemCode: item.itemCode || item.supplierCode || '',
          itemDescription: item.itemDescription || item.description || '',
          barcode: item.barcode || '',
          supplierCode: item.supplierCode || '',
          // Convert all numeric/decimal fields to strings
          quantity: toDecimalString(item.quantity || 0),
          unitCost: toDecimalString(item.unitCost || item.unitPrice || 0),
          discountPercent: toDecimalString(item.discountPercent || 0),
          discountAmount: toDecimalString(item.discountAmount || 0),
          netTotal: toDecimalString(item.netTotal || 0),
          vatPercent: toDecimalString(item.vatPercent || 0),
          vatAmount: toDecimalString(item.vatAmount || 0),
          totalPrice: toDecimalString(item.totalPrice || 0),
          // Legacy fields
          itemName: item.itemName || '',
          description: item.description || '',
          unitPrice: toDecimalString(item.unitPrice || item.unitCost || 0),
          receivedQuantity: toDecimalString(item.receivedQuantity || item.quantity || 0),
        };
        
        // Validate item (remove id for validation)
        const itemForValidation: any = { ...itemData };
        delete itemForValidation.id;
        
        try {
          const validated = insertMaterialReceiptItemSchema.parse(itemForValidation);
          return { id: itemData.id, ...validated };
        } catch (error) {
          console.error('[MATERIAL RECEIPTS STORAGE] Item validation error:', error, itemData);
          throw error;
        }
      });
      
      console.log('[MATERIAL RECEIPTS STORAGE] Inserting items:', itemsToInsert.length);
      insertedItems = await db
        .insert(materialReceiptItems)
        .values(itemsToInsert)
        .returning();
      
      console.log('[MATERIAL RECEIPTS STORAGE] Items inserted:', insertedItems.length);
    }
    
    return {
      header: insertedHeader,
      items: insertedItems
    };
  }
  
  /**
   * Get all material receipts
   */
  async getAllMaterialReceipts() {
    console.log('[MATERIAL RECEIPTS STORAGE] Fetching all material receipts');
    
    const receipts = await db
      .select()
      .from(materialReceipt)
      .orderBy(materialReceipt.createdAt);
    
    // Fetch items for each receipt
    for (const receipt of receipts) {
      const items = await this.getMaterialReceiptItems(receipt.id);
      (receipt as any).items = items;
    }
    
    return receipts;
  }
  
  /**
   * Get a single material receipt by ID
   */
  async getMaterialReceiptById(id: string) {
    console.log('[MATERIAL RECEIPTS STORAGE] Fetching material receipt:', id);
    
    const [receipt] = await db
      .select()
      .from(materialReceipt)
      .where(eq(materialReceipt.id, id));
    
    if (!receipt) {
      return null;
    }
    
    const items = await this.getMaterialReceiptItems(id);
    return {
      ...receipt,
      items
    };
  }
  
  /**
   * Get a single material receipt by receipt number
   */
  async getMaterialReceiptByNumber(receiptNumber: string) {
    console.log('[MATERIAL RECEIPTS STORAGE] Fetching material receipt by number:', receiptNumber);
    
    const [receipt] = await db
      .select()
      .from(materialReceipt)
      .where(eq(materialReceipt.receiptNumber, receiptNumber));
    
    if (!receipt) {
      return null;
    }
    
    const items = await this.getMaterialReceiptItems(receipt.id);
    return {
      ...receipt,
      items
    };
  }
  
  /**
   * Get items for a material receipt
   */
  async getMaterialReceiptItems(materialReceiptId: string) {
    const items = await db
      .select()
      .from(materialReceiptItems)
      .where(eq(materialReceiptItems.materialReceiptId, materialReceiptId))
      .orderBy(materialReceiptItems.serialNo);
    
    return items;
  }
  
  /**
   * Update a material receipt
   */
  async updateMaterialReceipt(id: string, data: any) {
    console.log('[MATERIAL RECEIPTS STORAGE] Updating material receipt:', id);
    
    // Extract items if present
    const items = data.items;
    delete data.items;
    
    // Validate and update header
    const dataForValidation = { ...data };
    delete dataForValidation.id;
    const validatedData = insertMaterialReceiptSchema.partial().parse(dataForValidation);
    
    const [updated] = await db
      .update(materialReceipt)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(eq(materialReceipt.id, id))
      .returning();
    
    // If items are provided, update them
    if (items && items.length > 0) {
      // Delete existing items
      await db
        .delete(materialReceiptItems)
        .where(eq(materialReceiptItems.materialReceiptId, id));
      
      // Insert new items
      const itemsToInsert = items.map((item: any, index: number) => {
        const itemData = {
          id: item.id || randomUUID(),
          materialReceiptId: id,
          serialNo: item.serialNo || index + 1,
          itemCode: item.itemCode || '',
          itemDescription: item.itemDescription || '',
          barcode: item.barcode || '',
          supplierCode: item.supplierCode || '',
          quantity: item.quantity || 0,
          unitCost: item.unitCost || 0,
          discountPercent: item.discountPercent || 0,
          discountAmount: item.discountAmount || 0,
          netTotal: item.netTotal || 0,
          vatPercent: item.vatPercent || 0,
          vatAmount: item.vatAmount || 0,
          totalPrice: item.totalPrice || 0,
          itemName: item.itemName || '',
          description: item.description || '',
          unitPrice: item.unitPrice || 0,
          receivedQuantity: item.receivedQuantity || 0,
        };
        
        const itemForValidation = { ...itemData };
        delete itemForValidation.id;
        const validated = insertMaterialReceiptItemSchema.parse(itemForValidation);
        return { id: itemData.id, ...validated };
      });
      
      await db.insert(materialReceiptItems).values(itemsToInsert);
    }
    
    return updated;
  }
  
  /**
   * Delete a material receipt
   */
  async deleteMaterialReceipt(id: string) {
    console.log('[MATERIAL RECEIPTS STORAGE] Deleting material receipt:', id);
    
    // Items will be deleted automatically due to CASCADE
    await db
      .delete(materialReceipt)
      .where(eq(materialReceipt.id, id));
    
    return { success: true };
  }
  
  /**
   * Get supplier by ID
   */
  async getSupplier(supplierId: string) {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, supplierId));
    
    return supplier || null;
  }
}
