import type { Express } from "express";
import { storage } from "../storage";
import { insertPurchaseInvoiceSchema, insertPurchaseInvoiceItemSchema } from "../../shared/schema";
import { generatePurchaseInvoicePdf } from "../pdf/pdf-utils";
import { z } from "zod";

export function registerPurchaseInvoiceRoutes(app: Express) {
  // Create purchase invoice
  app.post("/api/purchase-invoices", async (req, res) => {
    try {
      console.log('[PURCHASE INVOICE][RAW BODY]', JSON.stringify(req.body, null, 2));
      
      // Handle both old format (just invoice data) and new format (invoice + items)
      if (req.body.invoice && req.body.items) {
        // New format with items
        console.log('[PURCHASE INVOICE][INVOICE]', req.body.invoice);
        console.log('[PURCHASE INVOICE][ITEMS]', req.body.items);
        
        const validatedInvoice = insertPurchaseInvoiceSchema.parse(req.body.invoice);
        console.log('[PURCHASE INVOICE][INVOICE PARSED]', validatedInvoice);
        
        const validatedItems = z.array(insertPurchaseInvoiceItemSchema).parse(req.body.items);
        console.log('[PURCHASE INVOICE][ITEMS PARSED]', validatedItems);
        
        const purchaseInvoice = await storage.createPurchaseInvoice(validatedInvoice, validatedItems);
        res.status(201).json(purchaseInvoice);
      } else {
        // Old format without items
        const validatedData = insertPurchaseInvoiceSchema.parse(req.body);
        const purchaseInvoice = await storage.createPurchaseInvoice(validatedData);
        res.status(201).json(purchaseInvoice);
      }
    } catch (error) {
      console.error("Error creating purchase invoice:", error);
      res.status(400).json({ message: "Failed to create purchase invoice", error: error.message });
    }
  });

  // List purchase invoices
  app.get("/api/purchase-invoices", async (req, res) => {
    try {
      const purchaseInvoices = await storage.getPurchaseInvoices();
      res.json(purchaseInvoices);
    } catch (error) {
      console.error("Error fetching purchase invoices:", error);
      res.status(500).json({ message: "Failed to fetch purchase invoices" });
    }
  });

  // Get unique supplier invoice numbers for suggestions
  app.get("/api/purchase-invoices/supplier-invoice-numbers", async (req, res) => {
    try {
      const supplierInvoiceNumbers = await storage.getUniqueSupplierInvoiceNumbers();
      res.json(supplierInvoiceNumbers);
    } catch (error) {
      console.error("Error fetching supplier invoice numbers:", error);
      res.status(500).json({ message: "Failed to fetch supplier invoice numbers" });
    }
  });

  // Get single purchase invoice
  app.get("/api/purchase-invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const purchaseInvoice = await storage.getPurchaseInvoice(id);
      if (!purchaseInvoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }
      res.json(purchaseInvoice);
    } catch (error) {
      console.error("Error fetching purchase invoice:", error);
      res.status(500).json({ message: "Failed to fetch purchase invoice" });
    }
  });

  // Get purchase invoice items
  app.get("/api/purchase-invoices/:id/items", async (req, res) => {
    try {
      const { id } = req.params;
      const items = await storage.getPurchaseInvoiceItems(id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching purchase invoice items:", error);
      res.status(500).json({ message: "Failed to fetch purchase invoice items" });
    }
  });

  // Update purchase invoice
  app.patch("/api/purchase-invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const purchaseInvoice = await storage.updatePurchaseInvoice(id, req.body);
      if (!purchaseInvoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }
      res.json(purchaseInvoice);
    } catch (error) {
      console.error("Error updating purchase invoice:", error);
      res.status(400).json({ message: "Failed to update purchase invoice", error: error.message });
    }
  });

  // Delete purchase invoice
  app.delete("/api/purchase-invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePurchaseInvoice(id);
      if (!deleted) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }
      res.json({ message: "Purchase invoice deleted successfully" });
    } catch (error) {
      console.error("Error deleting purchase invoice:", error);
      res.status(500).json({ message: "Failed to delete purchase invoice", error: error.message });
    }
  });

  // Generate PDF for purchase invoice
  app.get("/api/purchase-invoices/:id/pdf", async (req, res) => {
    try {
      const { id } = req.params;
      const { mode = 'enhanced' } = req.query;
      
      // Get purchase invoice
      const purchaseInvoice = await storage.getPurchaseInvoice(id);
      if (!purchaseInvoice) {
        return res.status(404).json({ message: "Purchase invoice not found" });
      }

      // Get purchase invoice items
      let invoiceItems = [];
      try {
        invoiceItems = await storage.getPurchaseInvoiceItems(id);
        console.log('[PURCHASE INVOICE PDF] Fetched invoice items:', invoiceItems.length);
      } catch (error) {
        console.warn("Could not fetch purchase invoice items:", error);
        // Fallback to goods receipt items if available
        if (purchaseInvoice.goodsReceiptId) {
          try {
            const grItems = await storage.getGoodsReceiptItems(purchaseInvoice.goodsReceiptId);
            // Map goods receipt items to purchase invoice item format
            invoiceItems = grItems.map((grItem: any) => ({
              id: grItem.id,
              itemDescription: grItem.itemDescription,
              quantity: grItem.quantityReceived || grItem.quantityExpected || 0,
              unitPrice: grItem.unitCost || '0',
              totalPrice: grItem.totalCost || '0',
              taxRate: grItem.taxRate || '0',
              discountRate: grItem.discountRate || '0',
              discountAmount: grItem.discountAmount || '0',
              unitOfMeasure: grItem.unitOfMeasure || 'PCS',
              barcode: grItem.barcode,
              supplierCode: grItem.supplierCode,
              notes: grItem.notes
            }));
            console.log('[PURCHASE INVOICE PDF] Mapped goods receipt items:', invoiceItems.length);
          } catch (grError) {
            console.warn("Could not fetch goods receipt items as fallback:", grError);
          }
        }
      }

      // Get supplier information
      let supplier = {};
      if (purchaseInvoice.supplierId) {
        try {
          supplier = await storage.getSupplier(purchaseInvoice.supplierId) || {};
        } catch (error) {
          console.warn("Could not fetch supplier information:", error);
        }
      }

      // Generate PDF
      const pdfResult = generatePurchaseInvoicePdf({
        invoice: purchaseInvoice,
        items: invoiceItems,
        supplier: supplier,
        mode: mode as 'enhanced' | 'simple'
      });

      // Set response headers
      res.setHeader('Content-Type', pdfResult.contentType);
      res.setHeader('Content-Length', pdfResult.byteLength);
      res.setHeader('Content-Disposition', `attachment; filename="${pdfResult.fileName}"`);
      
      // Send PDF buffer
      res.send(pdfResult.buffer);
    } catch (error) {
      console.error("Error generating purchase invoice PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF", error: error.message });
    }
  });

  // Test endpoint to create a purchase invoice with sample data
  app.post("/api/purchase-invoices/test-sample", async (req, res) => {
    try {
      const sampleInvoiceData = {
        invoiceNumber: `PI-TEST-${Date.now()}`,
        supplierInvoiceNumber: `SUP-TEST-${Date.now()}`,
        supplierId: "test-supplier-id", // You'll need to create a test supplier first
        status: "Draft",
        paymentStatus: "Unpaid",
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal: "1500.00",
        taxAmount: "150.00",
        discountAmount: "0.00",
        totalAmount: "1650.00",
        paidAmount: "0.00",
        remainingAmount: "1650.00",
        currency: "BHD",
        paymentTerms: "Net 30",
        notes: "Test purchase invoice with sample data",
        attachments: [],
        isRecurring: false
      };

      const sampleItems = [
        {
          itemDescription: "Test Item 1 - High Quality Widget",
          quantity: 10,
          unitPrice: "50.00",
          totalPrice: "500.00",
          unitOfMeasure: "PCS",
          taxRate: "10.00",
          discountRate: "0.00"
        },
        {
          itemDescription: "Test Item 2 - Premium Component",
          quantity: 5,
          unitPrice: "100.00",
          totalPrice: "500.00",
          unitOfMeasure: "EA",
          taxRate: "10.00",
          discountRate: "0.00"
        },
        {
          itemDescription: "Test Item 3 - Standard Part",
          quantity: 20,
          unitPrice: "25.00",
          totalPrice: "500.00",
          unitOfMeasure: "PCS",
          taxRate: "10.00",
          discountRate: "0.00"
        }
      ];

      const purchaseInvoice = await storage.createPurchaseInvoice(sampleInvoiceData, sampleItems);
      res.status(201).json(purchaseInvoice);
    } catch (error) {
      console.error("Error creating test purchase invoice:", error);
      res.status(500).json({ message: "Failed to create test purchase invoice", error: error.message });
    }
  });
}

export default registerPurchaseInvoiceRoutes;
