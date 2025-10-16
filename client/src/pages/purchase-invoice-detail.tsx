import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { formatDate } from "date-fns";
import { 
  ArrowLeft, 
  Download, 
  FileText,
  Clock,
  DollarSign,
  Building2,
  Calendar,
  Receipt,
  Package,
  AlertTriangle,
  Trash2,
  Edit,
  Save,
  X,
  Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import AttachmentManager from "@/components/enquiry/attachment-manager";
import { EmailSendButton } from "@/components/email/EmailSendButton";

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierInvoiceNumber?: string;
  supplierId: string;
  supplierName: string;
  supplierEmail?: string;
  supplierPhone?: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  goodsReceiptId?: string;
  goodsReceiptNumber?: string;
  status: "Draft" | "Pending Approval" | "Approved" | "Paid" | "Partially Paid" | "Overdue" | "Disputed" | "Cancelled";
  paymentStatus: "Unpaid" | "Partially Paid" | "Paid" | "Overdue";
  invoiceDate: string;
  dueDate: string;
  receivedDate?: string;
  paymentDate?: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  currency: "BHD" | "AED" | "EUR" | "GBP";
  paymentTerms: string;
  paymentMethod?: "Bank Transfer" | "Cheque" | "Cash" | "Credit Card" | "Letter of Credit";
  bankReference?: string;
  approvedBy?: string;
  approvalDate?: string;
  notes?: string;
  attachments: Array<string | { url: string; name?: string }>;
  itemCount: number;
  isRecurring: boolean;
  nextInvoiceDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface PurchaseInvoiceItem {
  id: string;
  purchaseInvoiceId: string;
  goodsReceiptItemId?: string;
  lpoItemId?: string;
  itemId?: string;
  variantId?: string;
  barcode?: string;
  supplierCode?: string;
  itemDescription: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  taxRate?: string;
  taxAmount?: string;
  discountRate?: string;
  discountAmount?: string;
  unitOfMeasure?: string;
  storageLocation?: string;
  batchNumber?: string;
  expiryDate?: string;
  condition?: string;
  notes?: string;
}

// Payments not yet implemented on backend for derived purchase invoices
type PaymentEntry = never;

type SupplierInvoiceAttachment = {
  id: string;
  name: string;
  filename?: string;
  size?: number;
  type?: string;
  url: string;
  uploadedAt?: string;
};

const normalizeSupplierInvoiceAttachments = (
  raw: any[] | null | undefined,
  fallbackDate?: string
): SupplierInvoiceAttachment[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized: SupplierInvoiceAttachment[] = [];

  raw.forEach((attachment: any, index: number) => {
    if (!attachment) {
      return;
    }

    if (typeof attachment === "string") {
      const fileName = attachment.split("/").pop() || `attachment-${index + 1}`;
      const url = attachment.startsWith("/api")
        ? attachment
        : `/api/files/download/${attachment}`;

      normalized.push({
        id: `${index}-${fileName}`,
        name: fileName,
        filename: fileName,
        size: 0,
        type: "application/octet-stream",
        url,
        uploadedAt: fallbackDate,
      });
      return;
    }

    const fileName =
      attachment.filename ||
      attachment.name ||
      attachment.originalname ||
      (typeof attachment.url === "string" ? attachment.url.split("/").pop() : undefined) ||
      `attachment-${index + 1}`;

    const url =
      attachment.url ||
      attachment.path ||
      (typeof fileName === "string" ? `/api/files/download/${fileName}` : undefined);

    if (!url) {
      return;
    }

    normalized.push({
      id: attachment.id || `${index}-${fileName}`,
      name: attachment.name || attachment.originalname || fileName,
      filename: fileName,
      size: attachment.size ?? 0,
      type: attachment.type || attachment.mimetype || "application/octet-stream",
      url,
      uploadedAt: attachment.uploadedAt || fallbackDate,
    });
  });

  return normalized;
};

export default function PurchaseInvoiceDetailPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // UI state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Bank Transfer" | "Cheque" | "Cash" | "Credit Card" | "Letter of Credit">("Bank Transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [supplierInvoiceAttachments, setSupplierInvoiceAttachments] = useState<SupplierInvoiceAttachment[]>([]);

  // Download PDF handler
  const handleDownloadPDF = async () => {
    if (!invoice) {
      toast({
        title: "Error",
        description: "No invoice data available for PDF generation.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Generating PDF",
        description: "Please wait while the PDF is being generated...",
      });

      const response = await fetch(`/api/purchase-invoices/${invoice.id}/pdf?mode=enhanced`);
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `purchase-invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: `Purchase invoice PDF (${invoice.invoiceNumber}) download started.`,
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Download Failed",
        description: "Failed to generate or download the PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Fetch single purchase invoice
  const { data: invoice, isLoading } = useQuery<PurchaseInvoice>({
    queryKey: ["/api/purchase-invoices", id],
    queryFn: async () => {
      const resp = await fetch(`/api/purchase-invoices/${id}`);
      if (!resp.ok) throw new Error("Failed to fetch purchase invoice");
      return resp.json();
    }
  });

  // Update purchase invoice mutation
  const updateInvoiceMutation = useMutation({
    mutationFn: async (data: Partial<PurchaseInvoice>) => {
      const response = await apiRequest("PATCH", `/api/purchase-invoices/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices", id] });
      setShowEditDialog(false);
      setEditingInvoice(null);
      toast({ title: "Success", description: "Purchase invoice updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update purchase invoice", variant: "destructive" });
    },
  });

  // Delete purchase invoice mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/purchase-invoices/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      toast({ title: "Success", description: "Purchase invoice deleted successfully" });
      navigate("/purchase-invoices");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete purchase invoice", variant: "destructive" });
    },
  });

  const updateSupplierInvoiceAttachments = useMutation({
    mutationFn: async (attachments: SupplierInvoiceAttachment[]) => {
      const response = await apiRequest("PATCH", `/api/purchase-invoices/${id}`, { attachments });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-invoices"] });
      toast({ title: "Supplier Invoice Updated", description: "Supplier invoice document saved successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update supplier invoice document", variant: "destructive" });
    },
  });

  // Fetch items from purchase invoice items endpoint
  const { data: invoiceItems = [] } = useQuery<PurchaseInvoiceItem[]>({
    queryKey: ["/api/purchase-invoices", id, "items"],
    enabled: !!id,
    queryFn: async () => {
      const resp = await fetch(`/api/purchase-invoices/${id}/items`);
      if (!resp.ok) throw new Error("Failed to fetch purchase invoice items");
      return resp.json();
    }
  });

  // Fetch goods receipt items for additional details
  const { data: goodsReceiptItems = [], isLoading: isLoadingGRItems, error: grItemsError } = useQuery<any[]>({
    queryKey: ["/api/goods-receipt-headers", invoice?.goodsReceiptId, "items"],
    enabled: !!invoice?.goodsReceiptId,
    queryFn: async () => {
      console.log('Fetching goods receipt items for ID:', invoice?.goodsReceiptId);
      const resp = await fetch(`/api/goods-receipt-headers/${invoice?.goodsReceiptId}/items`);
      if (!resp.ok) {
        console.error('Failed to fetch goods receipt items:', resp.status, resp.statusText);
        throw new Error("Failed to fetch goods receipt items");
      }
      const data = await resp.json();
      console.log('Fetched goods receipt items:', data);
      return data;
    }
  });

  // Log when goods receipt items change
  useEffect(() => {
    console.log('Goods Receipt Items Updated:', {
      count: goodsReceiptItems.length,
      items: goodsReceiptItems,
      goodsReceiptId: invoice?.goodsReceiptId,
      isLoading: isLoadingGRItems,
      error: grItemsError
    });
  }, [goodsReceiptItems, invoice?.goodsReceiptId, isLoadingGRItems, grItemsError]);

  useEffect(() => {
    const normalized = normalizeSupplierInvoiceAttachments(
      invoice?.attachments,
      invoice?.updatedAt || invoice?.createdAt
    );

    setSupplierInvoiceAttachments((prev) => {
      const prevSerialized = JSON.stringify(prev);
      const nextSerialized = JSON.stringify(normalized);
      return prevSerialized === nextSerialized ? prev : normalized;
    });
  }, [invoice?.attachments, invoice?.updatedAt, invoice?.createdAt]);

  const coerceNumber = (value: any) => {
    if (value === null || value === undefined || value === "") return 0;
    const coerced = Number(value);
    return Number.isFinite(coerced) ? coerced : 0;
  };

  // Merge invoice items with goods receipt items for complete details
  const enrichedItems = invoiceItems.map(invItem => {
    const grItem = goodsReceiptItems.find((gr: any) => gr.id === invItem.goodsReceiptItemId);
    
    console.log('Enriching item:', {
      invoiceItemId: invItem.id,
      goodsReceiptItemId: invItem.goodsReceiptItemId,
      foundGRItem: !!grItem,
      grItem: grItem,
      invItemQuantity: invItem.quantity,
      invItemUnitPrice: invItem.unitPrice,
      invItemTotalPrice: invItem.totalPrice
    });
    
    // If we have a goods receipt item, merge all its details
    if (grItem) {
      return {
        ...invItem,
        // Preserve item description, barcode, supplier code from GR if not in invoice
        itemDescription: invItem.itemDescription || grItem.itemDescription,
        barcode: invItem.barcode || grItem.barcode,
        supplierCode: invItem.supplierCode || grItem.supplierCode,
        
        // Use GR quantities and costs if invoice item has zero values
        quantity: (invItem.quantity && invItem.quantity > 0) ? invItem.quantity : 
                 (grItem.quantityReceived && grItem.quantityReceived > 0) ? grItem.quantityReceived : 
                 grItem.quantityExpected,
        unitPrice: (invItem.unitPrice && parseFloat(invItem.unitPrice) > 0) ? invItem.unitPrice : 
                  (grItem.unitCost && parseFloat(grItem.unitCost) > 0) ? grItem.unitCost.toString() : 
                  invItem.unitPrice,
        totalPrice: (invItem.totalPrice && parseFloat(invItem.totalPrice) > 0) ? invItem.totalPrice : 
                   (grItem.totalCost && parseFloat(grItem.totalCost) > 0) ? grItem.totalCost.toString() : 
                   invItem.totalPrice,
        
        // Add goods receipt specific details
        goodsReceiptItemId: grItem.id,
        quantityExpected: grItem.quantityExpected,
        quantityReceived: grItem.quantityReceived,
        quantityDamaged: grItem.quantityDamaged || 0,
        quantityShort: grItem.quantityShort || 0,
        discrepancyReason: grItem.discrepancyReason,
        
        // Cost and condition from GR
        unitCostFromGR: grItem.unitCost,
        totalCostFromGR: grItem.totalCost,
        conditionFromGR: grItem.condition,
        
        // Storage and tracking
        storageLocationFromGR: grItem.storageLocation,
        batchNumberFromGR: grItem.batchNumber,
        expiryDateFromGR: grItem.expiryDate,
        
        // Notes and timestamps
        notesFromGR: grItem.notes,
        scannedAt: grItem.scannedAt,
        receivedAt: grItem.receivedAt,
      };
    }
    
    // If no GR item found, return invoice item as is
    console.log('No GR item found for invoice item:', invItem.id);
    return invItem;
  });

  console.log('Enriched Items Result:', {
    invoiceItemsCount: invoiceItems.length,
    goodsReceiptItemsCount: goodsReceiptItems.length,
    enrichedItemsCount: enrichedItems.length,
    enrichedItems: enrichedItems
  });

  const displayItems = invoiceItems.length > 0
    ? enrichedItems
    : goodsReceiptItems.map((gr: any) => ({
        id: gr.id,
        itemDescription: gr.itemDescription,
        supplierCode: gr.supplierCode,
        barcode: gr.barcode,
        unitOfMeasure: gr.unitOfMeasure,
        quantity: gr.quantityReceived ?? gr.quantityExpected ?? gr.quantityDamaged ?? gr.quantityShort,
        unitPrice: gr.unitCost,
        totalPrice: gr.totalCost,
        discountAmount: gr.discountAmount,
        discountRate: gr.discountRate,
        taxAmount: gr.taxAmount,
        taxRate: gr.taxRate,
        batchNumberFromGR: gr.batchNumber,
        expiryDateFromGR: gr.expiryDate,
        notesFromGR: gr.notes,
        goodsReceiptItemId: gr.id,
        quantityExpected: gr.quantityExpected,
        quantityReceived: gr.quantityReceived,
        quantityDamaged: gr.quantityDamaged || 0,
        quantityShort: gr.quantityShort || 0,
        discrepancyReason: gr.discrepancyReason,
        unitCostFromGR: gr.unitCost,
        totalCostFromGR: gr.totalCost,
        conditionFromGR: gr.condition,
        storageLocationFromGR: gr.storageLocation,
        scannedAt: gr.scannedAt,
        receivedAt: gr.receivedAt,
      }));

  // Debug: Log the actual data being used for display
  console.log('Display Items Debug:', {
    displayItemsCount: displayItems.length,
    displayItems: displayItems.map(item => ({
      id: item.id,
      itemDescription: item.itemDescription,
      quantity: item.quantity,
      quantityReceived: item.quantityReceived,
      quantityExpected: item.quantityExpected,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost,
      unitCostFromGR: item.unitCostFromGR,
      totalPrice: item.totalPrice,
      totalCost: item.totalCost,
      totalCostFromGR: item.totalCostFromGR
    }))
  });

  const paymentHistory: PaymentEntry[] = [];

  const handleSupplierAttachmentsChange = useCallback(
    (attachments: SupplierInvoiceAttachment[]) => {
      const previous = supplierInvoiceAttachments;
      setSupplierInvoiceAttachments(attachments);
      updateSupplierInvoiceAttachments.mutate(attachments, {
        onError: () => {
          setSupplierInvoiceAttachments(previous);
        },
      });
    },
    [supplierInvoiceAttachments, updateSupplierInvoiceAttachments]
  );

  // Handler functions
  const handleEdit = () => {
    if (invoice) {
      setEditingInvoice(invoice);
      setShowEditDialog(true);
    }
  };

  const handleSaveEdit = () => {
    if (editingInvoice) {
      // Filter out fields that shouldn't be updated and ensure proper data types
      const { id, createdAt, updatedAt, supplierId, goodsReceiptId, purchaseOrderId, ...updateData } = editingInvoice;
      
      // Ensure numeric fields are properly formatted
      const cleanedData = {
        ...updateData,
        subtotal: updateData.subtotal || "0.00",
        taxAmount: updateData.taxAmount || "0.00",
        discountAmount: updateData.discountAmount || "0.00",
        totalAmount: updateData.totalAmount || "0.00",
        paidAmount: updateData.paidAmount || "0.00",
        remainingAmount: updateData.remainingAmount || "0.00",
      };
      
      updateInvoiceMutation.mutate(cleanedData);
    }
  };

  const handleRecordPayment = () => {
    setShowPaymentDialog(true);
  };

  const handleSavePayment = () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({ title: "Error", description: "Please enter a valid payment amount", variant: "destructive" });
      return;
    }
    
    const currentPaidAmount = parseFloat(invoice?.paidAmount || '0');
    const newPaidAmount = currentPaidAmount + parseFloat(paymentAmount);
    const totalAmount = parseFloat(invoice?.totalAmount || '0');
    
    let newStatus = invoice?.status;
    let newPaymentStatus = invoice?.paymentStatus;
    
    if (newPaidAmount >= totalAmount) {
      newStatus = "Paid";
      newPaymentStatus = "Paid";
    } else if (newPaidAmount > 0) {
      newStatus = "Partially Paid";
      newPaymentStatus = "Partially Paid";
    }
    
    updateInvoiceMutation.mutate({
      paidAmount: newPaidAmount.toString(),
      remainingAmount: (totalAmount - newPaidAmount).toString(),
      status: newStatus,
      paymentStatus: newPaymentStatus,
      paymentDate: new Date().toISOString().split('T')[0],
      notes: `${invoice?.notes || ''}\n\nPayment recorded: ${paymentAmount} ${invoice?.currency} via ${paymentMethod} on ${new Date().toLocaleDateString()}. Reference: ${paymentReference}. ${paymentNotes ? `Notes: ${paymentNotes}` : ''}`
    });
    
    setShowPaymentDialog(false);
    setPaymentAmount("");
    setPaymentReference("");
    setPaymentNotes("");
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    deleteInvoiceMutation.mutate();
  };

  const getStatusBadgeProps = (status: string) => {
    switch (status) {
      case "Draft": 
        return {
          variant: "outline" as const,
          className: "border-gray-500 text-gray-600 hover:bg-gray-50"
        };
      case "Pending Approval": 
        return {
          variant: "outline" as const,
          className: "border-yellow-500 text-yellow-600 hover:bg-yellow-50"
        };
      case "Approved": 
        return {
          variant: "outline" as const,
          className: "border-green-500 text-green-600 hover:bg-green-50"
        };
      case "Paid": 
        return {
          variant: "outline" as const,
          className: ""
        };
      case "Partially Paid": 
        return {
          variant: "outline" as const,
          className: "border-orange-500 text-orange-600 hover:bg-orange-50"
        };
      case "Overdue": 
        return {
          variant: "outline" as const,
          className: "border-red-500 text-red-600 hover:bg-red-50"
        };
      case "Disputed": 
        return {
          variant: "outline" as const,
          className: "border-purple-500 text-purple-600 hover:bg-purple-50"
        };
      case "Cancelled": 
        return {
          variant: "outline" as const,
          className: "border-gray-500 text-gray-600 hover:bg-gray-50"
        };
      default: 
        return {
          variant: "outline" as const,
          className: "border-gray-500 text-gray-600 hover:bg-gray-50"
        };
    }
  };

  const getPaymentStatusBadgeProps = (status: string) => {
    switch (status) {
      case "Paid": 
        return {
          variant: "outline" as const,
          className: "border-green-500 text-green-600 hover:bg-green-50"
        };
      case "Partially Paid": 
        return {
          variant: "outline" as const,
          className: ""
        };
      case "Unpaid": 
        return {
          variant: "outline" as const,
          className: "border-orange-500 text-orange-600 hover:bg-orange-50"
        };
      case "Overdue": 
        return {
          variant: "outline" as const,
          className: "border-red-500 text-red-600 hover:bg-red-50"
        };
      default: 
        return {
          variant: "outline" as const,
          className: "border-gray-500 text-gray-600 hover:bg-gray-50"
        };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  if (!invoice && !isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invoice Not Found</h1>
          <p className="text-gray-600 mb-4">The requested purchase invoice could not be found.</p>
          <Link href="/purchase-invoices">
            <Button>Back to Purchase Invoices</Button>
          </Link>
        </div>
      </div>
    );
  }

  // If still loading invoices, show spinner (previous loading branch covers but guard here)
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  // Defensive: if invoice somehow undefined after loading
  if (!invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invoice Not Found</h1>
          <p className="text-gray-600 mb-4">The requested purchase invoice could not be found.</p>
          <Link href="/purchase-invoices">
            <Button>Back to Purchase Invoices</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/purchase-invoices">
            <Button variant="outline" size="sm" onClick={() => navigate('/purchase-invoices')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Purchase Invoices
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{invoice?.invoiceNumber}</h1>
            <p className="text-gray-600">{invoice?.supplierName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          {invoice?.supplierEmail && (
            <EmailSendButton
              documentType="purchase_invoice"
              documentId={invoice.id}
              documentNumber={invoice.invoiceNumber}
              customerEmail={invoice.supplierEmail}
              customerName={invoice.supplierName}
              autoSend={true}
              variant="outline"
              onSuccess={() => {
                toast({
                  title: "Success",
                  description: "Purchase invoice sent successfully via email!"
                });
              }}
            />
          )}
          <Button onClick={handleRecordPayment}>Record Payment</Button>
        </div>
      </div>

      {/* Status and Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
  <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div>
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-black">Status</p>
                <Badge 
                  variant={getStatusBadgeProps(invoice?.status || 'Draft').variant}
                  className={getStatusBadgeProps(invoice?.status || 'Draft').className}
                >
                  <span className="font-medium">{invoice?.status}</span>
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

  <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div>
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-black">Total Amount</p>
                <p className="text-xl font-bold">{invoice?.currency} {parseFloat(invoice?.totalAmount || '0').toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

  <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-6 w-6" />
              <div>
                <p className="text-sm font-bold text-black">Payment Status</p>
                <Badge 
                  variant={getPaymentStatusBadgeProps(invoice?.paymentStatus || 'Unpaid').variant}
                  className={getPaymentStatusBadgeProps(invoice?.paymentStatus || 'Unpaid').className}
                >
                  <span className="font-medium">{invoice?.paymentStatus}</span>
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

  <Card className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div>
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-black">Due Date</p>
                  <p className="text-lg font-semibold">{invoice?.dueDate ? formatDate(new Date(invoice.dueDate), 'MMM dd, yyyy') : '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Information */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Invoice Number</Label>
                  <p className="text-lg font-semibold">{invoice?.invoiceNumber}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Supplier Invoice Number</Label>
                  <p className="text-lg">{invoice?.supplierInvoiceNumber || "Nb/A"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Invoice Date</Label>
                  <p className="text-lg">{invoice?.invoiceDate ? formatDate(new Date(invoice.invoiceDate), 'MMM dd, yyyy') : '-'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Due Date</Label>
                  <p className="text-lg">{invoice?.dueDate ? formatDate(new Date(invoice.dueDate), 'MMM dd, yyyy') : '-'}</p>
                </div>
                {invoice?.receivedDate && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Received Date</Label>
                    <p className="text-lg">{formatDate(new Date(invoice.receivedDate), 'MMM dd, yyyy')}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-gray-600">Payment Terms</Label>
                  <p className="text-lg">{invoice?.paymentTerms || '-'}</p>
                </div>
                {invoice?.purchaseOrderNumber && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Purchase Order</Label>
                    <p className="text-lg">{invoice.purchaseOrderNumber}</p>
                  </div>
                )}
                {invoice?.goodsReceiptNumber && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Goods Receipt</Label>
                    <p className="text-lg">{invoice.goodsReceiptNumber}</p>
                  </div>
                )}
              </div>
              {invoice?.notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">Notes</Label>
                  <p className="text-gray-800">{invoice.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoice Items */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Invoice Items ({displayItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {displayItems.map((item: any, index: number) => {
                  const displaySupplierCode = item.supplierCode || item.supplierCodeFromGR;
                  const displayBarcode = item.barcode || item.barcodeFromGR;
                  const displayStorageLocation = item.storageLocation || item.storageLocationFromGR;
                  const displayCondition = item.condition || item.conditionFromGR;
                  const displayBatchNumber = item.batchNumber || item.batchNumberFromGR;
                  const displayExpiryDate = item.expiryDate || item.expiryDateFromGR;
                  const displayQuantity = 
                    (item.quantity && item.quantity > 0) ? item.quantity :
                    (item.quantityReceived && item.quantityReceived > 0) ? item.quantityReceived :
                    (item.quantityExpected && item.quantityExpected > 0) ? item.quantityExpected :
                    (item.quantityDamaged && item.quantityDamaged > 0) ? item.quantityDamaged :
                    (item.quantityShort && item.quantityShort > 0) ? item.quantityShort :
                    0;
                  const displayUnitOfMeasure = item.unitOfMeasure || item.unitOfMeasureFromGR || 'units';
                  const rawUnitPrice = 
                    (item.unitPrice && parseFloat(item.unitPrice) > 0) ? item.unitPrice :
                    (item.unitCostFromGR && parseFloat(item.unitCostFromGR) > 0) ? item.unitCostFromGR :
                    (item.unitCost && parseFloat(item.unitCost) > 0) ? item.unitCost :
                    "0";
                  const rawTotalPrice =
                    (item.totalPrice && parseFloat(item.totalPrice) > 0) ? item.totalPrice :
                    (item.totalCostFromGR && parseFloat(item.totalCostFromGR) > 0) ? item.totalCostFromGR :
                    (item.totalCost && parseFloat(item.totalCost) > 0) ? item.totalCost :
                    (coerceNumber(displayQuantity) > 0 && coerceNumber(rawUnitPrice) > 0) ? 
                      (coerceNumber(displayQuantity) * coerceNumber(rawUnitPrice)).toString() :
                    "0";
                  const displayDiscountAmount = item.discountAmount ?? item.discountAmountFromGR;
                  const displayTaxAmount = item.taxAmount ?? item.taxAmountFromGR;
                  const displayNotes = item.notes || item.notesFromGR;

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm transition-all hover:shadow-lg"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex flex-1 gap-4">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                            <Package className="h-5 w-5" />
                          </div>
                          <div className="flex-1 space-y-4">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-3">
                                <h4 className="text-lg font-semibold text-slate-900">
                                  {item.itemDescription || item.description || `Item ${index + 1}`}
                                </h4>
                                {displaySupplierCode && (
                                  <Badge variant="outline" className="text-xs font-medium bg-blue-50 text-blue-700 border-blue-200">
                                    Code: {displaySupplierCode}
                                  </Badge>
                                )}
                                {displayBarcode && (
                                  <Badge variant="outline" className="text-xs font-medium bg-purple-50 text-purple-700 border-purple-200">
                                    Barcode: {displayBarcode}
                                  </Badge>
                                )}
                                {displayStorageLocation && (
                                  <Badge variant="outline" className="text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                                    Location: {displayStorageLocation}
                                  </Badge>
                                )}
                                {displayCondition && (
                                  <Badge
                                    variant="outline"
                                    className={`text-xs font-medium ${
                                      displayCondition === "Good"
                                        ? "bg-green-50 text-green-700 border-green-200"
                                        : displayCondition === "Damaged"
                                          ? "bg-red-50 text-red-700 border-red-200"
                                          : "bg-slate-50 text-slate-700 border-slate-200"
                                    }`}
                                  >
                                    Condition: {displayCondition}
                                  </Badge>
                                )}
                              </div>
                              {(displayBatchNumber || displayExpiryDate) && (
                                <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                                  {displayBatchNumber && (
                                    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium">
                                      Batch #{displayBatchNumber}
                                    </span>
                                  )}
                                  {displayExpiryDate && (
                                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">
                                      📅 {formatDate(new Date(displayExpiryDate), "MMM dd, yyyy")}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {(item.quantityExpected !== undefined || item.quantityReceived !== undefined || item.goodsReceiptItemId) && (
                              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-indigo-900">📦 Goods Receipt Item Details</p>
                                  {item.goodsReceiptItemId && (
                                    <Badge variant="outline" className="text-xs bg-indigo-100 text-indigo-700 border-indigo-300">
                                      GR Item: {item.goodsReceiptItemId.slice(0, 8)}...
                                    </Badge>
                                  )}
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                                  {item.quantityExpected !== undefined && (
                                    <div className="rounded-xl bg-white/90 px-3 py-2 shadow-sm">
                                      <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">Expected</p>
                                      <p className="text-base font-semibold text-indigo-900">{item.quantityExpected}</p>
                                    </div>
                                  )}
                                  {item.quantityReceived !== undefined && (
                                    <div className="rounded-xl bg-white/90 px-3 py-2 shadow-sm">
                                      <p className="text-xs font-medium uppercase tracking-wide text-emerald-500">Received</p>
                                      <p className="text-base font-semibold text-emerald-600">{item.quantityReceived}</p>
                                    </div>
                                  )}
                                  {item.quantityDamaged > 0 && (
                                    <div className="rounded-xl bg-white/90 px-3 py-2 shadow-sm">
                                      <p className="text-xs font-medium uppercase tracking-wide text-rose-500">Damaged</p>
                                      <p className="text-base font-semibold text-rose-600">{item.quantityDamaged}</p>
                                    </div>
                                  )}
                                  {item.quantityShort > 0 && (
                                    <div className="rounded-xl bg-white/90 px-3 py-2 shadow-sm">
                                      <p className="text-xs font-medium uppercase tracking-wide text-orange-500">Short</p>
                                      <p className="text-base font-semibold text-orange-600">{item.quantityShort}</p>
                                    </div>
                                  )}
                                </div>

                                {(item.unitCostFromGR || item.totalCostFromGR || item.conditionFromGR) && (
                                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-indigo-200 pt-4 text-sm md:grid-cols-3">
                                    {item.unitCostFromGR && (
                                      <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">GR Unit Cost</p>
                                        <p className="text-base font-semibold text-indigo-900">
                                          {invoice?.currency} {parseFloat(item.unitCostFromGR).toLocaleString()}
                                        </p>
                                      </div>
                                    )}
                                    {item.totalCostFromGR && (
                                      <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">GR Total Cost</p>
                                        <p className="text-base font-semibold text-indigo-900">
                                          {invoice?.currency} {parseFloat(item.totalCostFromGR).toLocaleString()}
                                        </p>
                                      </div>
                                    )}
                                    {item.conditionFromGR && (
                                      <div className="flex flex-col gap-1">
                                        <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">GR Condition</p>
                                        <Badge
                                          variant="outline"
                                          className={`w-fit text-xs ${
                                            item.conditionFromGR === "Good"
                                              ? "bg-green-50 text-green-700 border-green-200"
                                              : item.conditionFromGR === "Damaged"
                                                ? "bg-red-50 text-red-700 border-red-200"
                                                : "bg-slate-50 text-slate-700 border-slate-200"
                                          }`}
                                        >
                                          {item.conditionFromGR}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {(item.storageLocationFromGR || item.batchNumberFromGR || item.expiryDateFromGR) && (
                                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-indigo-200 pt-4 text-sm md:grid-cols-3">
                                    {item.storageLocationFromGR && (
                                      <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">Storage Location</p>
                                        <Badge variant="outline" className="w-fit text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                                          📍 {item.storageLocationFromGR}
                                        </Badge>
                                      </div>
                                    )}
                                    {item.batchNumberFromGR && (
                                      <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">Batch Number</p>
                                        <p className="rounded-lg bg-indigo-100 px-3 py-1 font-mono text-xs font-semibold text-indigo-900">
                                          {item.batchNumberFromGR}
                                        </p>
                                      </div>
                                    )}
                                    {item.expiryDateFromGR && (
                                      <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-indigo-500">Expiry Date</p>
                                        <p className="text-xs font-semibold text-indigo-900">
                                          📅 {formatDate(new Date(item.expiryDateFromGR), "MMM dd, yyyy")}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {item.discrepancyReason && (
                                  <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/80 px-4 py-3">
                                    <div className="flex items-start gap-2">
                                      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-orange-600" />
                                      <div className="space-y-1 text-sm text-orange-900">
                                        <p className="text-xs font-semibold uppercase tracking-wide">Discrepancy Noted</p>
                                        <p className="italic">{item.discrepancyReason}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {item.notesFromGR && (
                                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">GR Notes</p>
                                    <p className="mt-1">💬 {item.notesFromGR}</p>
                                  </div>
                                )}

                                {(item.scannedAt || item.receivedAt) && (
                                  <div className="mt-4 flex flex-wrap gap-3 border-t border-indigo-200 pt-4 text-xs text-indigo-900">
                                    {item.scannedAt && (
                                      <span>
                                        <span className="font-medium text-indigo-600">Scanned:</span>{" "}
                                        {formatDate(new Date(item.scannedAt), "MMM dd, yyyy HH:mm")}
                                      </span>
                                    )}
                                    {item.receivedAt && (
                                      <span>
                                        <span className="font-medium text-indigo-600">Received:</span>{" "}
                                        {formatDate(new Date(item.receivedAt), "MMM dd, yyyy HH:mm")}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
                              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoiced Qty</p>
                                  <p className="text-base font-semibold text-slate-900">
                                    {displayQuantity} {displayUnitOfMeasure}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit Price</p>
                                  <p className="text-base font-semibold text-slate-900">
                                    {invoice?.currency} {coerceNumber(rawUnitPrice).toLocaleString()}
                                  </p>
                                </div>
                                {displayDiscountAmount && coerceNumber(displayDiscountAmount) > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Discount</p>
                                    <p className="text-base font-semibold text-emerald-600">
                                      -{invoice?.currency} {coerceNumber(displayDiscountAmount).toLocaleString()}
                                      {item.discountRate && ` (${item.discountRate}%)`}
                                    </p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tax</p>
                                  <p className="text-base font-semibold text-slate-900">
                                    {invoice?.currency} {coerceNumber(displayTaxAmount).toLocaleString()}
                                    {item.taxRate && ` (${item.taxRate}%)`}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {displayNotes && (
                              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-700">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
                                <p className="mt-1 italic">{displayNotes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 rounded-2xl bg-slate-50 px-4 py-3 text-right">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
                          <p className="text-2xl font-bold text-slate-900">
                            {invoice?.currency} {coerceNumber(rawTotalPrice).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator className="my-6" />

              {/* Invoice Totals */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice Total</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {invoice?.currency} {parseFloat(invoice?.totalAmount || "0").toLocaleString()}
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 text-sm font-semibold sm:w-auto sm:items-end">
                    <span className="flex items-center gap-2 text-emerald-600">
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Paid</span>
                      {invoice?.currency} {parseFloat(invoice?.paidAmount || "0").toLocaleString()}
                    </span>
                    <span
                      className={`flex items-center gap-2 ${
                        invoice?.remainingAmount && parseFloat(invoice.remainingAmount) > 0
                          ? "text-rose-600"
                          : "text-slate-500"
                      }`}
                    >
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                          invoice?.remainingAmount && parseFloat(invoice.remainingAmount) > 0
                            ? "bg-rose-100 text-rose-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        Remaining
                      </span>
                      {invoice?.currency} {parseFloat(invoice?.remainingAmount || "0").toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-medium text-slate-900">
                      {invoice?.currency} {parseFloat(invoice?.subtotal || "0").toLocaleString()}
                    </span>
                  </div>
                  {invoice?.discountAmount && parseFloat(invoice.discountAmount) > 0 && (
                    <div className="flex items-center justify-between text-emerald-600">
                      <span>Discount</span>
                      <span>
                        -{invoice?.currency} {parseFloat(invoice.discountAmount).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tax</span>
                    <span className="font-medium text-slate-900">
                      {invoice?.currency} {parseFloat(invoice.taxAmount || "0").toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Supplier Information */}
          

          {/* Payment History (not available yet) */}
          

          <AttachmentManager
            title="Supplier Invoice Documents"
            attachments={supplierInvoiceAttachments}
            onAttachmentsChange={handleSupplierAttachmentsChange}
            maxFiles={5}
            allowedTypes={["application/pdf", "image/*"]}
            readOnly={updateSupplierInvoiceAttachments.isPending}
          />


          {/* Quick Actions (limited - derived data) */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" onClick={handleDownloadPDF} className="w-full justify-start">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              {invoice?.supplierEmail && (
                <EmailSendButton
                  documentType="purchase_invoice"
                  documentId={invoice.id}
                  documentNumber={invoice.invoiceNumber}
                  customerEmail={invoice.supplierEmail}
                  customerName={invoice.supplierName}
                  autoSend={true}
                  variant="outline"
                  className="w-full justify-start"
                  onSuccess={() => {
                    toast({
                      title: "Success",
                      description: "Purchase invoice sent successfully via email!"
                    });
                  }}
                />
              )}
              <Button onClick={handleRecordPayment} className="w-full justify-start">Record Payment</Button>
              <Button variant="destructive" onClick={handleDelete} className="w-full justify-start">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Invoice
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Purchase Invoice
            </DialogTitle>
          </DialogHeader>
          {editingInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoiceNumber">Invoice Number</Label>
                  <Input
                    id="invoiceNumber"
                    value={editingInvoice.invoiceNumber}
                    onChange={(e) => setEditingInvoice({...editingInvoice, invoiceNumber: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="supplierInvoiceNumber">Supplier Invoice Number</Label>
                  <Input
                    id="supplierInvoiceNumber"
                    value={editingInvoice.supplierInvoiceNumber || ''}
                    onChange={(e) => setEditingInvoice({...editingInvoice, supplierInvoiceNumber: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={editingInvoice.status}
                    onValueChange={(value) => setEditingInvoice({...editingInvoice, status: value as any})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                      <SelectItem value="Overdue">Overdue</SelectItem>
                      <SelectItem value="Disputed">Disputed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="paymentStatus">Payment Status</Label>
                  <Select
                    value={editingInvoice.paymentStatus}
                    onValueChange={(value) => setEditingInvoice({...editingInvoice, paymentStatus: value as any})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unpaid">Unpaid</SelectItem>
                      <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="invoiceDate">Invoice Date</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={editingInvoice.invoiceDate}
                    onChange={(e) => setEditingInvoice({...editingInvoice, invoiceDate: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={editingInvoice.dueDate}
                    onChange={(e) => setEditingInvoice({...editingInvoice, dueDate: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="subtotal">Subtotal</Label>
                  <Input
                    id="subtotal"
                    type="number"
                    step="0.01"
                    value={editingInvoice.subtotal}
                    onChange={(e) => setEditingInvoice({...editingInvoice, subtotal: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="taxAmount">Tax Amount</Label>
                  <Input
                    id="taxAmount"
                    type="number"
                    step="0.01"
                    value={editingInvoice.taxAmount}
                    onChange={(e) => setEditingInvoice({...editingInvoice, taxAmount: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="totalAmount">Total Amount</Label>
                  <Input
                    id="totalAmount"
                    type="number"
                    step="0.01"
                    value={editingInvoice.totalAmount}
                    onChange={(e) => setEditingInvoice({...editingInvoice, totalAmount: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={editingInvoice.currency}
                    onValueChange={(value) => setEditingInvoice({...editingInvoice, currency: value as any})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BHD">BHD</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Textarea
                  id="paymentTerms"
                  value={editingInvoice.paymentTerms || ''}
                  onChange={(e) => setEditingInvoice({...editingInvoice, paymentTerms: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={editingInvoice.notes || ''}
                  onChange={(e) => setEditingInvoice({...editingInvoice, notes: e.target.value})}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={updateInvoiceMutation.isPending}>
                  {updateInvoiceMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Record Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="paymentAmount">Payment Amount</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter payment amount"
              />
            </div>
            <div>
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Letter of Credit">Letter of Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="paymentReference">Reference Number</Label>
              <Input
                id="paymentReference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Enter reference number"
              />
            </div>
            <div>
              <Label htmlFor="paymentNotes">Notes</Label>
              <Textarea
                id="paymentNotes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Enter payment notes"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePayment} disabled={updateInvoiceMutation.isPending}>
                {updateInvoiceMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Purchase Invoice
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this purchase invoice? This action cannot be undone.
              <br />
              <br />
              <strong>Invoice:</strong> {invoice?.invoiceNumber}
              <br />
              <strong>Supplier:</strong> {invoice?.supplierName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteInvoiceMutation.isPending}
            >
              {deleteInvoiceMutation.isPending ? "Deleting..." : "Delete Invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}