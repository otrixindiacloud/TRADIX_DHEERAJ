import type { Express } from "express";
import { storage } from "../storage";
import { insertSupplierLpoSchema, insertSupplierLpoItemSchema } from "@shared/schema";
import { z } from "zod";
import { getAttributingUserId, getOptionalUserId } from '../utils/user';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  validateLpoData, 
  validateLpoUpdateData, 
  validateLpoItemData,
  validateCreateLpoFromQuotesData,
  validateCreateLpoFromSalesOrdersData,
  validateLpoStatusTransition,
  validateLpoApprovalStatusTransition,
  validateLpoFinancialData,
  validateLpoItemFinancialData,
  lpoStatusUpdateSchema,
  lpoApprovalSchema,
  lpoRejectionSchema,
  lpoConfirmationSchema,
  lpoDeliveryDateUpdateSchema
} from '../utils/lpo-validation';

export function registerSupplierLpoRoutes(app: Express) {
  // Supplier LPO routes
  app.get("/api/supplier-lpos", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const filters = {
        status: req.query.status as string,
        supplierId: req.query.supplierId as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        search: req.query.search as string,
        requiresApproval: req.query.requiresApproval === "true",
        pendingSupplierConfirmation: req.query.pendingSupplierConfirmation === "true",
      };
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof typeof filters] === undefined) {
          delete filters[key as keyof typeof filters];
        }
      });
      const supplierLpos = await storage.getSupplierLpos(limit, offset, Object.keys(filters).length > 0 ? filters : undefined);
      const totalCount = await storage.getSupplierLposCount(Object.keys(filters).length > 0 ? filters : undefined);
      res.json({
        data: supplierLpos,
        total: totalCount,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        totalPages: Math.ceil(totalCount / limit)
      });
    } catch (error) {
      console.error("Error fetching supplier LPOs:", error);
      res.status(500).json({ message: "Failed to fetch supplier LPOs" });
    }
  });

  // Convenience: create Supplier LPO from a single sales order
  app.post("/api/supplier-lpos/from-sales-order", async (req, res) => {
    try {
      const { salesOrderId, supplierId } = req.body;
      if (!salesOrderId) {
        return res.status(400).json({ message: "salesOrderId required" });
      }
        const lpos = await storage.createSupplierLposFromSalesOrders([salesOrderId], "supplier", getAttributingUserId(req));
      if (!lpos || lpos.length === 0) {
        return res.status(500).json({ message: "No Supplier LPO created" });
      }
      res.status(201).json(lpos[0]);
    } catch (error) {
      console.error("[SUPPLIER-LPO:SINGLE] Error creating supplier LPO from sales order. Payload=", req.body);
      console.error(error);
      if (error instanceof Error) {
        res.status(500).json({ message: error.message, stack: error.stack });
      } else {
        res.status(500).json({ message: "Failed to create supplier LPO from sales order" });
      }
    }
  });

  // Create Supplier LPO from supplier quotes
  app.post("/api/supplier-lpos/from-supplier-quotes", async (req, res) => {
    try {
      console.log("[SUPPLIER-LPO:FROM-QUOTES] Request received:", req.body);
      
      // Validate request data
      const validatedData = validateCreateLpoFromQuotesData(req.body);
      const { quoteIds, groupBy } = validatedData;
      
      console.log(`[SUPPLIER-LPO:FROM-QUOTES] Processing ${quoteIds.length} quotes with groupBy: ${groupBy}`);
      const lpos = await storage.createSupplierLposFromSupplierQuotes(quoteIds, groupBy, getAttributingUserId(req));
      
      if (!lpos || lpos.length === 0) {
        console.log("[SUPPLIER-LPO:FROM-QUOTES] No LPOs created");
        return res.status(500).json({ message: "No Supplier LPO created" });
      }
      
      console.log(`[SUPPLIER-LPO:FROM-QUOTES] Successfully created ${lpos.length} LPO(s)`);
      res.status(201).json(lpos);
    } catch (error) {
      console.error("[SUPPLIER-LPO:FROM-QUOTES] Error creating supplier LPO from quotes. Payload=", req.body);
      console.error("[SUPPLIER-LPO:FROM-QUOTES] Error details:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      
      if (error instanceof Error) {
        res.status(500).json({ message: error.message, stack: error.stack });
      } else {
        res.status(500).json({ message: "Failed to create supplier LPO from quotes" });
      }
    }
  });

  // Batch: create Supplier LPOs from multiple sales orders
  app.post("/api/supplier-lpos/from-sales-orders", async (req, res) => {
    try {
      const { salesOrderIds, groupBy = 'supplier', supplierId } = req.body;
      if (!Array.isArray(salesOrderIds) || salesOrderIds.length === 0) {
        return res.status(400).json({ message: "salesOrderIds array required" });
      }
      const lpos = await storage.createSupplierLposFromSalesOrders(salesOrderIds, groupBy, getAttributingUserId(req));
      res.status(201).json(lpos);
    } catch (error) {
      console.error("[SUPPLIER-LPO:BATCH] Error creating supplier LPOs from sales orders. Payload=", req.body);
      console.error(error);
      if (error instanceof Error) {
        res.status(500).json({ message: error.message, stack: error.stack });
      } else {
        res.status(500).json({ message: "Failed to create supplier LPOs" });
      }
    }
  });

  // Update supplier LPO status
  app.patch("/api/supplier-lpos/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate LPO ID
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        return res.status(400).json({ message: "Invalid LPO ID provided" });
      }
      
      // Validate request data
      const validatedData = lpoStatusUpdateSchema.parse(req.body);
      const { status, notes } = validatedData;
      
      console.log(`[PATCH] /api/supplier-lpos/${id}/status - Received status:`, status);
      
      // Get current LPO to validate status transition
      const currentLpo = await storage.getSupplierLpo(id);
      if (!currentLpo) {
        return res.status(404).json({ message: "Supplier LPO not found" });
      }
      
      // Validate status transition
      if (!validateLpoStatusTransition(currentLpo.status, status)) {
        return res.status(400).json({ 
          message: `Invalid status transition from ${currentLpo.status} to ${status}`,
          currentStatus: currentLpo.status,
          requestedStatus: status
        });
      }
      
      const updatedLpo = await (storage as any).updateSupplierLpoStatus(id, status, getAttributingUserId(req));
      console.log(`[PATCH] /api/supplier-lpos/${id}/status - Update result:`, updatedLpo);
      
      if (!updatedLpo) {
        return res.status(404).json({ message: "Supplier LPO not found" });
      }
      
      res.json(updatedLpo);
    } catch (error) {
      console.error("Error updating supplier LPO status:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      
      res.status(500).json({ message: "Failed to update supplier LPO status" });
    }
  });

  app.get("/api/supplier-lpos/:id", async (req, res) => {
    try {
      const supplierLpo = await storage.getSupplierLpo(req.params.id);
      if (!supplierLpo) {
        return res.status(404).json({ message: "Supplier LPO not found" });
      }
      res.json(supplierLpo);
    } catch (error) {
      console.error("Error fetching supplier LPO:", error);
      res.status(500).json({ message: "Failed to fetch supplier LPO" });
    }
  });

  // Update supplier LPO
  app.patch("/api/supplier-lpos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      console.log(`[PATCH] /api/supplier-lpos/${id} - Received data:`, updateData);
      
      // Validate LPO ID
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        return res.status(400).json({ message: "Invalid LPO ID provided" });
      }
      
      // Validate the update data - allow null values and handle type conversions
      const updateSchema = z.object({
        status: z.string().optional(),
        expectedDeliveryDate: z.string().nullable().optional(),
        requestedDeliveryDate: z.string().nullable().optional(),
        specialInstructions: z.string().nullable().optional(),
        deliveryTerms: z.string().nullable().optional(),
        paymentTerms: z.string().nullable().optional(),
        termsAndConditions: z.string().nullable().optional(),
        currency: z.string().optional(),
        totalAmount: z.union([z.number(), z.string()]).optional().transform(val => val ? Number(val) : undefined),
        subtotal: z.union([z.number(), z.string()]).optional().transform(val => val ? Number(val) : undefined),
        taxAmount: z.union([z.number(), z.string(), z.null()]).optional().transform(val => val ? Number(val) : undefined),
        supplierContactPerson: z.string().nullable().optional(),
        supplierEmail: z.string().email().nullable().optional(),
        supplierPhone: z.string().nullable().optional(),
        supplierConfirmationReference: z.string().nullable().optional()
      });
      
      const validatedData = updateSchema.parse(updateData);
      
      // Filter out undefined values to only update fields that are actually provided
      const filteredData = Object.fromEntries(
        Object.entries(validatedData).filter(([_, value]) => value !== undefined)
      );
      
      // Convert date strings to Date objects
      if (filteredData.expectedDeliveryDate) {
        filteredData.expectedDeliveryDate = new Date(filteredData.expectedDeliveryDate);
      }
      if (filteredData.requestedDeliveryDate) {
        filteredData.requestedDeliveryDate = new Date(filteredData.requestedDeliveryDate);
      }
      
      // Validate financial data if provided
      if (filteredData.subtotal !== undefined || filteredData.taxAmount !== undefined || filteredData.totalAmount !== undefined) {
        const currentLpo = await storage.getSupplierLpo(id);
        if (currentLpo) {
          const subtotal = filteredData.subtotal ?? Number(currentLpo.subtotal || 0);
          const taxAmount = filteredData.taxAmount ?? Number(currentLpo.taxAmount || 0);
          const totalAmount = filteredData.totalAmount ?? Number(currentLpo.totalAmount || 0);
          
          if (!validateLpoFinancialData(subtotal, taxAmount, totalAmount)) {
            return res.status(400).json({ 
              message: "Invalid financial data: subtotal + taxAmount must equal totalAmount",
              subtotal,
              taxAmount,
              totalAmount
            });
          }
        }
      }
      
      console.log(`[PATCH] /api/supplier-lpos/${id} - Filtered data for update:`, filteredData);
      
      // Update the LPO
      const updatedLpo = await (storage as any).updateSupplierLpo(id, filteredData);
      
      if (!updatedLpo) {
        return res.status(404).json({ message: "Supplier LPO not found" });
      }
      
      console.log(`[PATCH] /api/supplier-lpos/${id} - Update successful:`, updatedLpo);
      res.json(updatedLpo);
    } catch (error) {
      console.error("Error updating supplier LPO:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
      }
      res.status(500).json({ message: "Failed to update supplier LPO" });
    }
  });

  // Create amended LPO
  app.post("/api/supplier-lpos/:id/amend", async (req, res) => {
    try {
      const { reason, amendmentType } = req.body;
      if (!reason || !amendmentType) {
        return res.status(400).json({ message: "Amendment reason and type are required" });
      }
      const amendedLpo = await storage.createAmendedSupplierLpo(req.params.id, reason, amendmentType, getAttributingUserId(req));
      res.status(201).json(amendedLpo);
    } catch (error) {
      console.error("Error creating amended supplier LPO:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create amended supplier LPO" });
    }
  });

  // Workflow actions
  app.post("/api/supplier-lpos/:id/submit-for-approval", async (req, res) => {
    try {
      const supplierLpo = await storage.submitForApproval(req.params.id, getAttributingUserId(req));
      res.json(supplierLpo);
    } catch (error) {
      console.error("Error submitting supplier LPO for approval:", error);
      res.status(500).json({ message: "Failed to submit supplier LPO for approval" });
    }
  });

  app.post("/api/supplier-lpos/:id/approve", async (req, res) => {
    try {
      const { notes } = req.body;
      const supplierLpo = await storage.approveSupplierLpo(req.params.id, getAttributingUserId(req), notes);
      res.json(supplierLpo);
    } catch (error) {
      console.error("Error approving supplier LPO:", error);
      res.status(500).json({ message: "Failed to approve supplier LPO" });
    }
  });

  app.post("/api/supplier-lpos/:id/reject", async (req, res) => {
    try {
      const { notes } = req.body;
      if (!notes) {
        return res.status(400).json({ message: "Rejection notes are required" });
      }
      const supplierLpo = await storage.rejectSupplierLpo(req.params.id, getAttributingUserId(req), notes);
      res.json(supplierLpo);
    } catch (error) {
      console.error("Error rejecting supplier LPO:", error);
      res.status(500).json({ message: "Failed to reject supplier LPO" });
    }
  });

  app.post("/api/supplier-lpos/:id/send-to-supplier", async (req, res) => {
    try {
      const supplierLpo = await storage.sendToSupplier(req.params.id, getAttributingUserId(req));
      res.json(supplierLpo);
    } catch (error) {
      console.error("Error sending supplier LPO to supplier:", error);
      res.status(500).json({ message: "Failed to send supplier LPO to supplier" });
    }
  });

  app.post("/api/supplier-lpos/:id/confirm-by-supplier", async (req, res) => {
    try {
      const { confirmationReference } = req.body;
      const supplierLpo = await storage.confirmBySupplier(req.params.id, confirmationReference);
      res.json(supplierLpo);
    } catch (error) {
      console.error("Error confirming supplier LPO:", error);
      res.status(500).json({ message: "Failed to confirm supplier LPO" });
    }
  });

  // Update expected delivery date
  app.patch("/api/supplier-lpos/:id/expected-delivery", async (req, res) => {
    try {
      console.log("PATCH /api/supplier-lpos/:id/expected-delivery called with:", req.params.id, req.body);
      const { expectedDeliveryDate, userId } = req.body;
      if (!expectedDeliveryDate) {
        console.log("Missing expectedDeliveryDate in request body");
        return res.status(400).json({ message: "Expected delivery date is required" });
      }
      const supplierLpo = await storage.updateExpectedDeliveryDate(req.params.id, expectedDeliveryDate, userId);
      console.log("Successfully updated expected delivery date:", supplierLpo);
      res.json(supplierLpo);
    } catch (error) {
      console.error("Error updating expected delivery date:", error);
      res.status(500).json({ message: "Failed to update expected delivery date" });
    }
  });

  // Backlog reporting
  app.get("/api/supplier-lpos/backlog", async (req, res) => {
    try {
      const backlog = await storage.getSupplierLpoBacklog();
      res.json(backlog);
    } catch (error) {
      console.error("Error fetching supplier LPO backlog:", error);
      res.status(500).json({ message: "Failed to fetch supplier LPO backlog" });
    }
  });

  // Get individual LPO item
  app.get("/api/supplier-lpos/:id/items/:itemId", async (req, res) => {
    try {
      const { itemId } = req.params;
      const item = await storage.getSupplierLpoItem(itemId);
      
      if (!item) {
        return res.status(404).json({ message: "LPO item not found" });
      }
      
      res.json(item);
    } catch (error) {
      console.error("Error fetching LPO item:", error);
      res.status(500).json({ message: "Failed to fetch LPO item" });
    }
  });

  // Update LPO item discount and VAT data
  app.patch("/api/supplier-lpos/:id/items/:itemId", async (req, res) => {
    try {
      const { id, itemId } = req.params;
      const { discountPercent, discountAmount, vatPercent, vatAmount } = req.body;
      
      console.log(`[LPO-ITEM-UPDATE] Updating item ${itemId} for LPO ${id} with:`, {
        discountPercent, discountAmount, vatPercent, vatAmount
      });

      // Validate the data
      const updateData: any = {};
      if (discountPercent !== undefined) updateData.discountPercent = discountPercent.toString();
      if (discountAmount !== undefined) updateData.discountAmount = discountAmount.toString();
      if (vatPercent !== undefined) updateData.vatPercent = vatPercent.toString();
      if (vatAmount !== undefined) updateData.vatAmount = vatAmount.toString();

      // Update the LPO item
      const updatedItem = await storage.updateSupplierLpoItem(itemId, updateData);
      
      console.log(`[LPO-ITEM-UPDATE] Successfully updated item ${itemId}`);
      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating LPO item:", error);
      res.status(500).json({ message: "Failed to update LPO item" });
    }
  });

  app.get("/api/customer-orders/backlog", async (req, res) => {
    try {
      const backlog = await storage.getCustomerOrderBacklog();
      res.json(backlog);
    } catch (error) {
      console.error("Error fetching customer order backlog:", error);
      res.status(500).json({ message: "Failed to fetch customer order backlog" });
    }
  });

  // Supplier LPO Items routes
  app.get("/api/supplier-lpos/:lpoId/items", async (req, res) => {
    try {
      const items = await storage.getSupplierLpoItems(req.params.lpoId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching supplier LPO items:", error);
      res.status(500).json({ message: "Failed to fetch supplier LPO items" });
    }
  });

  app.get("/api/supplier-lpo-items/:id", async (req, res) => {
    try {
      const item = await storage.getSupplierLpoItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Supplier LPO item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error fetching supplier LPO item:", error);
      res.status(500).json({ message: "Failed to fetch supplier LPO item" });
    }
  });

  app.post("/api/supplier-lpo-items", async (req, res) => {
    try {
      const itemData = insertSupplierLpoItemSchema.parse(req.body);
      const item = await storage.createSupplierLpoItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid supplier LPO item data", errors: error.errors });
      }
      console.error("Error creating supplier LPO item:", error);
      res.status(500).json({ message: "Failed to create supplier LPO item" });
    }
  });
  // Update item
  app.put("/api/supplier-lpo-items/:id", async (req, res) => {
    try {
      const itemData = insertSupplierLpoItemSchema.partial().parse(req.body);
      const item = await storage.updateSupplierLpoItem(req.params.id, itemData);
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid supplier LPO item data", errors: error.errors });
      }
      console.error("Error updating supplier LPO item:", error);
      res.status(500).json({ message: "Failed to update supplier LPO item" });
    }
  });

  // Delete item
  app.delete("/api/supplier-lpo-items/:id", async (req, res) => {
    try {
      await storage.deleteSupplierLpoItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting supplier LPO item:", error);
      res.status(500).json({ message: "Failed to delete supplier LPO item" });
    }
  });

  // Bulk create items
  app.post("/api/supplier-lpo-items/bulk", async (req, res) => {
    try {
      const itemsData = req.body.items;
      const validatedItems = z.array(insertSupplierLpoItemSchema).parse(itemsData);
      const items = await storage.bulkCreateSupplierLpoItems(validatedItems);
      res.status(201).json(items);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid supplier LPO items data", errors: error.errors });
      }
      console.error("Error bulk creating supplier LPO items:", error);
      res.status(500).json({ message: "Failed to bulk create supplier LPO items" });
    }
  });

  // Generate PDF for supplier LPO
  app.get("/api/supplier-lpos/:id/pdf", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate LPO ID
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        return res.status(400).json({ message: "Invalid LPO ID provided" });
      }
      
      console.log(`[LPO-PDF] Generating PDF for LPO ID: ${id}`);
      
      // Get LPO data
      const lpo = await storage.getSupplierLpo(id);
      if (!lpo) {
        console.warn(`[LPO-PDF] LPO not found for ID: ${id}`);
        return res.status(404).json({ message: "Supplier LPO not found" });
      }

      console.log(`[LPO-PDF] Found LPO: ${lpo.lpoNumber}`);

      // Get LPO items
      let items = [];
      try {
        items = await storage.getSupplierLpoItems(id);
        console.log(`[LPO-PDF] Found ${items.length} items for LPO ${id}`);
      } catch (error) {
        console.error(`[LPO-PDF] Error fetching LPO items for ${id}:`, error);
        // Continue with empty items array rather than failing completely
        items = [];
      }
      
      // Get supplier information
      let supplier = {};
      if (lpo.supplierId) {
        try {
          supplier = await storage.getSupplier(lpo.supplierId) || {};
          console.log(`[LPO-PDF] Found supplier: ${supplier.name || 'Unknown'}`);
        } catch (error) {
          console.warn(`[LPO-PDF] Could not fetch supplier information for ${lpo.supplierId}:`, error);
          // Continue with empty supplier object
          supplier = {};
        }
      } else {
        console.warn(`[LPO-PDF] LPO ${id} has no supplierId`);
      }

      // Generate PDF using jsPDF
      const generateLpoPdf = (
        lpo: any,
        items: any[],
        supplier: any
      ) => {
        // Validate inputs
        if (!lpo) {
          throw new Error('LPO data is required');
        }
        
        if (!Array.isArray(items)) {
          console.warn('[LPO-PDF] Items is not an array, using empty array');
          items = [];
        }
        
        if (!supplier || typeof supplier !== 'object') {
          console.warn('[LPO-PDF] Invalid supplier data, using empty object');
          supplier = {};
        }
        
        const format = (date: any) => {
          if (!date) return "-";
          try {
            const dateObj = new Date(date);
            if (isNaN(dateObj.getTime())) {
              console.warn(`[LPO-PDF] Invalid date format: ${date}`);
              return "-";
            }
            return dateObj.toLocaleDateString("en-GB");
          } catch (error) {
            console.warn(`[LPO-PDF] Error formatting date ${date}:`, error);
            return "-";
          }
        };
        
        const numberToWords = (num: number) => {
          try {
            if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
              console.warn(`[LPO-PDF] Invalid number for conversion: ${num}`);
              return 'Zero';
            }
            
            const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
            const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
            const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
            
            if (num === 0) return 'Zero';
            if (num < 0) return 'Negative ' + numberToWords(-num);
            if (num < 10) return ones[Math.floor(num)];
            if (num < 20) return teens[Math.floor(num) - 10];
            if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[Math.floor(num % 10)] : '');
            if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
            if (num < 1000000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
            return 'Large Number';
          } catch (error) {
            console.error(`[LPO-PDF] Error in numberToWords for ${num}:`, error);
            return 'Zero';
          }
        };

        const issueDate = format(lpo.lpoDate);
        const expectedDelivery = format(lpo.expectedDeliveryDate);
        let validUntil = expectedDelivery;
        if (!lpo.expectedDeliveryDate && lpo.lpoDate) {
          try {
            const d = new Date(lpo.lpoDate); 
            d.setDate(d.getDate() + 30); 
            validUntil = format(d);
          } catch (error) {
            console.warn(`[LPO-PDF] Error calculating valid until date:`, error);
            validUntil = "-";
          }
        }
        
        // Safely parse financial values
        const parseFinancialValue = (value: any, defaultValue: number = 0) => {
          try {
            const parsed = Number(value);
            return isNaN(parsed) || !isFinite(parsed) ? defaultValue : Math.max(0, parsed);
          } catch (error) {
            console.warn(`[LPO-PDF] Error parsing financial value ${value}:`, error);
            return defaultValue;
          }
        };
        
        const subtotal = parseFinancialValue(lpo.subtotal, 0);
        const taxAmount = parseFinancialValue(lpo.taxAmount, 0);
        const total = parseFinancialValue(lpo.totalAmount, subtotal + taxAmount);
        const currency = (lpo.currency && typeof lpo.currency === 'string') ? lpo.currency : 'BHD';
        
        // Calculate total discount from items
        const totalDiscountAmount = items.reduce((sum, it) => {
          try {
            if (!it || typeof it !== 'object') {
              return sum;
            }
            
            const qty = parseFinancialValue(it.quantity, 0);
            const unitCost = parseFinancialValue(it.unitCost, 0);
            const grossAmount = qty * unitCost;
            const discountPercent = parseFinancialValue(it.discountPercent, 0);
            const discountAmount = parseFinancialValue(it.discountAmount, 0);
            const calculatedDiscountAmount = discountAmount > 0 ? discountAmount : (grossAmount * discountPercent / 100);
            return sum + calculatedDiscountAmount;
          } catch (error) {
            return sum;
          }
        }, 0);
        
        const netAmount = subtotal - totalDiscountAmount;
        // VAT is calculated at LPO level, not item level
        const vatPercent = netAmount > 0 ? ((taxAmount / netAmount) * 100) : 0;
        const amountWords = `${currency} ${numberToWords(Math.floor(total))} ONLY`;

        // Create PDF document
        const doc = new jsPDF('p', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 40;
        let yPosition = 50;

        // Company Header
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(201, 162, 39); // Gold color
        doc.text('GOLDEN TAG', margin, yPosition);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text('Trading & Supply Company', margin, yPosition + 15);
        doc.text('Kingdom of Bahrain', margin, yPosition + 30);
        doc.text('Mobile: +973 XXXX XXXX', margin, yPosition + 45);
        doc.text('Email: info@goldentag.com', margin, yPosition + 60);

        // LPO Header (right side)
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('LPO', pageWidth - margin - 100, yPosition);
        
        // LPO details table
        const lpoDetails = [
          ['Date:', issueDate],
          ['LPO #:', lpo.lpoNumber],
          ['Valid Until:', validUntil],
          ['Status:', lpo.status || 'Draft']
        ];
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        lpoDetails.forEach(([label, value], index) => {
          doc.text(label, pageWidth - margin - 100, yPosition + 20 + (index * 15));
          doc.text(value, pageWidth - margin - 50, yPosition + 20 + (index * 15));
        });

        yPosition += 100;

        // Supplier information table
        const supplierTableData = [
          ['LPO No', 'LPO Date', 'Supplier Name', 'Payment Terms', 'Delivery Terms', 'Currency'],
          [
            lpo.lpoNumber,
            issueDate,
            supplier?.name || lpo.supplierName || '-',
            lpo.paymentTerms || '30 Days',
            lpo.deliveryTerms || 'Standard',
            currency
          ]
        ];

        autoTable(doc, {
          startY: yPosition,
          head: [supplierTableData[0]],
          body: [supplierTableData[1]],
          styles: { fontSize: 10, cellPadding: 4 },
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
          margin: { left: margin, right: margin }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;

        // Supplier details boxes
        const supplierDetails = [
          `Supplier Name & Address:\n${supplier?.name || lpo.supplierName || '-'}\n${supplier?.address || ''}\n${supplier?.phone || ''}`,
          `Supplier Contact Person:\n${supplier?.contactPerson || lpo.supplierContactPerson || '-'}\n${supplier?.email || ''}\n${supplier?.phone || ''}`
        ];

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.rect(margin, yPosition, (pageWidth - 2 * margin) * 0.55, 50);
        doc.text(supplierDetails[0], margin + 5, yPosition + 15);
        
        doc.rect(margin + (pageWidth - 2 * margin) * 0.55 + 10, yPosition, (pageWidth - 2 * margin) * 0.45, 50);
        doc.text(supplierDetails[1], margin + (pageWidth - 2 * margin) * 0.55 + 15, yPosition + 15);

        yPosition += 70;

        // Items table
        const tableHeaders = ['S/N', 'Item Description & Specifications', 'Qty', 'Unit Rate', 'Disc %', 'Disc Amt', 'Net Total', 'VAT %', 'VAT Amt'];
        const tableData = items.map((it: any, idx: number) => {
          try {
            if (!it || typeof it !== 'object') {
              return [idx + 1, 'Invalid item data', '', '', '', '', '', '', ''];
            }
            
            const qty = parseFinancialValue(it.quantity, 0);
            const unitCost = parseFinancialValue(it.unitCost, 0);
            const grossAmount = qty * unitCost;
            const discountPercent = parseFinancialValue(it.discountPercent, 0);
            const discountAmount = parseFinancialValue(it.discountAmount, 0);
            const calculatedDiscountAmount = discountAmount > 0 ? discountAmount : (grossAmount * discountPercent / 100);
            const lineNet = grossAmount - calculatedDiscountAmount;
            
            // For VAT, calculate proportional amount based on item's net total vs total net amount
            const itemVatAmount = netAmount > 0 ? (lineNet / netAmount) * taxAmount : 0;
            const itemVatPercent = lineNet > 0 ? ((itemVatAmount / lineNet) * 100) : 0;
            
            return [
              idx + 1,
              it.itemDescription || 'No description',
              `${qty} PCS`,
              `${currency} ${unitCost.toFixed(3)}`,
              `${discountPercent.toFixed(0)}%`,
              `${currency} ${calculatedDiscountAmount.toFixed(3)}`,
              `${currency} ${lineNet.toFixed(3)}`,
              `${itemVatPercent.toFixed(0)}%`,
              `${currency} ${itemVatAmount.toFixed(3)}`
            ];
          } catch (error) {
            return [idx + 1, 'Error processing item', '', '', '', '', '', '', ''];
          }
        });

        if (tableData.length === 0) {
          tableData.push(['', 'No items added to this LPO yet', '', '', '', '', '', '', '']);
        }

        autoTable(doc, {
          startY: yPosition,
          head: [tableHeaders],
          body: tableData,
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
          columnStyles: {
            0: { halign: 'center' },
            2: { halign: 'center' },
            3: { halign: 'right' },
            4: { halign: 'center' },
            5: { halign: 'right' },
            6: { halign: 'right' },
            7: { halign: 'center' },
            8: { halign: 'right' }
          },
          margin: { left: margin, right: margin }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 20;

        // Totals table
        const totalsData = [
          ['Total Amount', `${currency} ${subtotal.toFixed(3)}`],
          ['Discount Amount', `${currency} ${totalDiscountAmount.toFixed(3)}`],
          ['Net Amount', `${currency} ${netAmount.toFixed(3)}`],
          ['VAT Amount', `${currency} ${taxAmount.toFixed(3)}`],
          ['Grand Total', `${currency} ${total.toFixed(3)}`]
        ];

        autoTable(doc, {
          startY: yPosition,
          body: totalsData,
          styles: { fontSize: 10, cellPadding: 4 },
          columnStyles: {
            0: { halign: 'right' },
            1: { halign: 'right' }
          },
          margin: { left: pageWidth - margin - 200, right: margin }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 20;

        // Amount in words
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`${currency} In Words:`, margin, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.text(amountWords, margin, yPosition + 15);

        yPosition += 40;

        // Remarks
        doc.setFont('helvetica', 'bold');
        doc.text('Remarks:', margin, yPosition);
        doc.rect(margin, yPosition + 5, pageWidth - 2 * margin, 30);
        doc.setFont('helvetica', 'normal');
        doc.text((lpo as any).notes || '', margin + 5, yPosition + 20);

        yPosition += 60;

        // Validity note
        doc.setFontSize(9);
        doc.text(`This LPO is valid until ${validUntil}`, margin, yPosition);

        yPosition += 30;

        // Signature lines
        doc.setFontSize(10);
        doc.text('Authorized Signatory', margin, yPosition);
        doc.text('Supplier Signature Date & Stamp', pageWidth - margin - 150, yPosition);
        doc.line(margin, yPosition + 5, margin + 100, yPosition + 5);
        doc.line(pageWidth - margin - 150, yPosition + 5, pageWidth - margin - 50, yPosition + 5);

        yPosition += 30;

        // Footer
        doc.setDrawColor(201, 162, 39);
        doc.setLineWidth(2);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);

        yPosition += 20;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text('Thank you for your business!', pageWidth / 2, yPosition, { align: 'center' });
        doc.text('GOLDEN TAG - Your Trusted Trading Partner', pageWidth / 2, yPosition + 15, { align: 'center' });
        doc.text('Kingdom of Bahrain | Mobile: +973 XXXX XXXX | Email: info@goldentag.com', pageWidth / 2, yPosition + 30, { align: 'center' });

        return doc.output('arraybuffer');
      };

      let pdfBuffer;
      try {
        pdfBuffer = generateLpoPdf(lpo, items, supplier);
        console.log(`[LPO-PDF] Successfully generated PDF for LPO ${lpo.lpoNumber}`);
      } catch (pdfError) {
        console.error(`[LPO-PDF] Error generating PDF for LPO ${id}:`, pdfError);
        return res.status(500).json({ 
          message: "Failed to generate LPO PDF", 
          error: pdfError.message,
          lpoId: id 
        });
      }

      // Validate PDF buffer before sending
      if (!pdfBuffer || !(pdfBuffer instanceof ArrayBuffer)) {
        console.error(`[LPO-PDF] Generated PDF buffer is empty or invalid for LPO ${id}`);
        return res.status(500).json({ 
          message: "Generated PDF buffer is empty or invalid", 
          lpoId: id 
        });
      }

      // Set response headers for PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="lpo-${lpo.lpoNumber || id}.pdf"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Send PDF (convert ArrayBuffer to Buffer)
      res.send(Buffer.from(pdfBuffer));
      console.log(`[LPO-PDF] Successfully sent PDF response for LPO ${lpo.lpoNumber}`);
    } catch (error) {
      console.error(`[LPO-PDF] Unexpected error generating LPO PDF for ${id}:`, error);
      res.status(500).json({ 
        message: "Failed to generate LPO PDF", 
        error: error.message,
        lpoId: id 
      });
    }
  });
}

