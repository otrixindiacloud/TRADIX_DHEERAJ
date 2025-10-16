import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StatusPill from "@/components/status/status-pill";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Search, Filter, FileText, Truck, Package, 
  AlertCircle, CheckCircle, Clock, Copy,
  Edit, Trash2, Eye, Download, Upload, FileCheck, ClipboardList,
  QrCode, MapPin, User, Calendar, RefreshCw
} from "lucide-react";
import DataTable, { Column } from "@/components/tables/data-table";
import { formatDate, formatCurrency, getStatusColor } from "@/lib/utils";
import { SYSTEM_USER_ID } from "@shared/utils/uuid";
import { useUserId } from "@/hooks/useUserId";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { SalesOrder, SalesOrderItem, Customer } from "@shared/schema";

interface DeliveryNote {
  id: string;
  deliveryNumber: string;
  salesOrderId: string;
  salesOrder?: SalesOrder & { customer?: Customer };
  deliveryDate: string | null;
  status: "Pending" | "Partial" | "Complete" | "Cancelled";
  deliveryType: string;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  deliveryDocument: string | null;
  deliveryDocumentName: string | null;
  deliveryDocumentSize: number | null;
  pickingStartedBy: string | null;
  pickingStartedAt: string | null;
  pickingCompletedBy: string | null;
  pickingCompletedAt: string | null;
  pickingNotes: string | null;
  deliveryConfirmedBy: string | null;
  deliveryConfirmedAt: string | null;
  deliverySignature: string | null;
  trackingNumber: string | null;
  carrierName: string | null;
  estimatedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  items?: DeliveryItem[];
}

interface DeliveryItem {
  id: string;
  deliveryId: string;
  salesOrderItemId: string;
  itemId: string;
  barcode: string;
  supplierCode: string;
  description: string;
  orderedQuantity: number;
  pickedQuantity: number;
  deliveredQuantity: number;
  unitPrice: string;
  totalPrice: string;
  pickedBy: string | null;
  pickedAt: string | null;
  storageLocation: string | null;
  pickingNotes: string | null;
  qualityChecked: boolean;
  qualityCheckedBy: string | null;
  qualityCheckedAt: string | null;
  qualityNotes: string | null;
}

export default function DeliveryNote() {
  // Print handler for delivery note
  // ...existing code...
  const [currentPage, setCurrentPage] = useState(1);
  // Page size is now dynamic to allow a "Show All" toggle (sets a large size)
  const [pageSize, setPageSize] = useState(15);
  // Separate search term for delivery notes table
  const [deliverySearchTerm, setDeliverySearchTerm] = useState("");
  // Independent search term for sales order selection inside the create dialog
  const [salesOrderSearchTerm, setSalesOrderSearchTerm] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [selectedDeliveryNote, setSelectedDeliveryNote] = useState<DeliveryNote | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPickingDialog, setShowPickingDialog] = useState(false);
  const [showConfirmDeliveryDialog, setShowConfirmDeliveryDialog] = useState(false);
  const [showStatusChangeDialog, setShowStatusChangeDialog] = useState(false);
  const [enquiryItems, setEnquiryItems] = useState<any[]>([]);
  const [enquiryItemsLoading, setEnquiryItemsLoading] = useState(false);
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editedDeliveryQtyByItem, setEditedDeliveryQtyByItem] = useState<Record<string, number>>({});
  const [isSavingItemChanges, setIsSavingItemChanges] = useState(false);
  // Fetch DELIVERY ITEMS when details dialog opens and selectedDeliveryNote changes
  useEffect(() => {
    const fetchDeliveryItems = async () => {
      setEnquiryItems([]);
      setEnquiryItemsLoading(true);
      try {
        if (selectedDeliveryNote?.id) {
          console.log('Fetching delivery items for delivery ID:', selectedDeliveryNote.id);
          const response = await fetch(`/api/deliveries/${selectedDeliveryNote.id}/items`);
          if (response.ok) {
            const data = await response.json();
            console.log('Delivery items fetched:', data);
            console.log('Number of items:', data.length);
            setEnquiryItems(data);
            const init: Record<string, number> = {};
            for (const it of data) init[it.id] = Number(it.deliveredQuantity || it.pickedQuantity || it.orderedQuantity || 0);
            setEditedDeliveryQtyByItem(init);
          } else {
            console.error('Failed to fetch delivery items:', response.status, response.statusText);
          }
        }
      } catch (err) {
        console.error('Error fetching delivery items:', err);
      }
      setEnquiryItemsLoading(false);
    };
    if (showDetailsDialog && selectedDeliveryNote?.id) {
      fetchDeliveryItems();
    } else {
      setEnquiryItems([]);
    }
  }, [showDetailsDialog, selectedDeliveryNote]);
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [deliveryConfirmationName, setDeliveryConfirmationName] = useState("");
  const [newStatus, setNewStatus] = useState<"Pending" | "Partial" | "Complete" | "Cancelled">("Pending");
  const [statusChangeReason, setStatusChangeReason] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deliveryToDelete, setDeliveryToDelete] = useState<DeliveryNote | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const userId = useUserId();
  // Sales order items to support partial delivery during creation
  const [soItemsForCreate, setSoItemsForCreate] = useState<SalesOrderItem[]>([]);
  const [soItemsLoading, setSoItemsLoading] = useState(false);
  // Map of salesOrderItemId -> quantity to deliver now
  const [deliverQtyBySoItem, setDeliverQtyBySoItem] = useState<Record<string, number>>({});
  // Delivery type selector to guide UX (prefill quantities); actual type is derived from entered quantities
  const [deliveryTypeSelection, setDeliveryTypeSelection] = useState<'Full' | 'Partial'>('Partial');

  // Helper to format ISO or date string for datetime-local input (strip seconds & timezone)
  // Print handler for delivery note using delivery items
  const handlePrintDelivery = (deliveryNote: DeliveryNote, deliveryItems: any[]) => {
    console.log('handlePrintDelivery called with:', { deliveryNote: deliveryNote.id, deliveryItems });
    console.log('Number of delivery items:', deliveryItems.length);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    // Calculate totals (derive unit price safely)
    const getNumber = (val: any) => {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return parseFloat(val) || 0;
      return 0;
    };
    const currency = (deliveryNote as any)?.salesOrder?.currency || 'BHD';
    let calculatedSubtotal = 0;
    deliveryItems.forEach((item: any, index: number) => {
      console.log(`Processing item ${index + 1}:`, item);
      const qty = getNumber(item.deliveredQuantity || item.pickedQuantity || item.orderedQuantity || item.quantity || item.qty || 0);
      const rawUnit = getNumber(item.unitPrice || item.price || item.rate || 0);
      const totalLine = getNumber(item.totalPrice || 0);
      // If unit is zero but total exists, derive unit from total/qty
      const unit = rawUnit > 0 ? rawUnit : (qty > 0 && totalLine > 0 ? (totalLine / qty) : 0);
      calculatedSubtotal += unit * qty;
      console.log(`Item ${index + 1} - Qty: ${qty}, Unit: ${unit}, Total: ${unit * qty}`);
    });
    const subtotal = calculatedSubtotal;
    console.log('Calculated subtotal:', subtotal);
    const discountAmount = 0; // delivery note has no discount section
    const netAmount = subtotal - discountAmount;
    const taxAmount = 0; // normally delivery note shows no VAT
    const totalAmount = netAmount + taxAmount;
    const html = `
      <html>
        <head>
          <title>Print Delivery Note</title>
          <style>
            @media print {
              @page {
                size: A4 portrait;
                margin: 0.5in;
              }
              body {
                background: white !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              .no-print {
                display: none !important;
              }
            }
            
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              background: #f8fafc;
              padding: 32px;
              color: #3b4252;
              margin: 0;
            }
            
            .header {
              background: #f3f4f6;
              border-radius: 12px;
              padding: 18px 32px;
              margin-bottom: 18px;
              box-shadow: 0 2px 8px rgba(60, 60, 60, 0.04);
            }
            
            h1 {
              font-size: 2.2rem;
              font-weight: 700;
              color: #e6c87a;
              margin-bottom: 4px;
              letter-spacing: 1px;
            }
            
            h2 {
              font-size: 1.3rem;
              color: #5e81ac;
              margin-bottom: 12px;
            }
            
            .info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px 32px;
              margin-bottom: 18px;
            }
            
            .info p {
              margin: 0;
              font-size: 1rem;
              background: #f9fafb;
              border-radius: 6px;
              padding: 6px 12px;
              border: 1px solid #ececec;
            }
            
            h3 {
              font-size: 1.1rem;
              color: #7b8fa1;
              margin-top: 24px;
              margin-bottom: 8px;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              background: #fff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 1px 4px rgba(60,60,60,0.04);
            }
            
            th, td {
              border: 1px solid #e5e7eb;
              padding: 12px 16px;
              font-size: 0.95rem;
              text-align: left;
            }
            
            th {
              background: #f3f4f6;
              color: #6b7280;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            tr:nth-child(even) td {
              background: #f9fafb;
            }
            
            .total {
              font-size: 1.2rem;
              color: #5e81ac;
              font-weight: 600;
              margin-top: 24px;
              text-align: right;
            }
            
            .delivery-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              padding: 16px;
              background: #f8fafc;
              border-radius: 8px;
              border: 1px solid #e5e7eb;
            }
            
            .delivery-number {
              font-size: 1.1rem;
              font-weight: 600;
              color: #374151;
            }
            
            .delivery-date {
              font-size: 0.95rem;
              color: #6b7280;
            }
            
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 0.85rem;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .status-complete {
              background: #d1fae5;
              color: #065f46;
            }
            
            .status-pending {
              background: #fef3c7;
              color: #92400e;
            }
            
            .status-in-progress {
              background: #dbeafe;
              color: #1e40af;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Tradix ERP Golden Tag</h1>
            <h2>Delivery Note Details</h2>
          </div>
          
          <div class="delivery-info">
            <div>
              <div class="delivery-number">Delivery Number: ${deliveryNote.deliveryNumber || 'N/A'}</div>
              <div class="delivery-date">Date: ${deliveryNote.deliveryDate ? new Date(deliveryNote.deliveryDate).toLocaleDateString() : 'Not scheduled'}</div>
            </div>
            <div>
              <span class="status-badge status-${(deliveryNote.status || '').toLowerCase().replace(' ', '-')}">${deliveryNote.status || 'N/A'}</span>
            </div>
          </div>
          
          <div class="info">
            <p><strong>Customer:</strong> ${deliveryNote.salesOrder?.customer?.name || 'N/A'}</p>
            <p><strong>Type:</strong> ${deliveryNote.deliveryType || 'N/A'}</p>
            <p><strong>Tracking Number:</strong> ${deliveryNote.trackingNumber || 'N/A'}</p>
            <p><strong>Sales Order:</strong> ${deliveryNote.salesOrder?.orderNumber || 'N/A'}</p>
          </div>
          
          <h3>Delivery Items</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 30%;">Item Name</th>
                <th style="width: 40%;">Description</th>
                <th style="width: 15%; text-align: right;">Unit Price</th>
                <th style="width: 15%; text-align: right;">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${deliveryItems.map((item: any) => `
                <tr>
                  <td><strong>${item.name || item.itemName || item.description || 'N/A'}</strong></td>
                  <td>${item.description || item.itemDescription || '-'}</td>
                  <td style="text-align: right;">${currency} ${(() => {
                    const qty = getNumber(item.deliveredQuantity || item.pickedQuantity || item.orderedQuantity || item.quantity || item.qty || 0);
                    const unitRaw = getNumber(item.unitPrice || item.price || item.rate || 0);
                    const totalLine = getNumber(item.totalPrice || 0);
                    const unit = unitRaw > 0 ? unitRaw : (qty > 0 && totalLine > 0 ? (totalLine / qty) : 0);
                    return unit.toFixed(2);
                  })()}</td>
                  <td style="text-align: right;"><strong>${item.deliveredQuantity || item.pickedQuantity || item.orderedQuantity || item.quantity || '0'}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total"> 
            <div style="display:inline-block; min-width: 300px; text-align:right; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb;">
              <div style="font-size: 1.1rem; margin-bottom: 8px;"><strong>Total Amount: ${currency} ${subtotal.toFixed(2)}</strong></div>
              <div style="font-size: 0.9rem; color: #6b7280;">Items: ${deliveryItems.length}</div>
            </div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };
  const formatForDateTimeLocal = (value: string | null): string => {
    if (!value) return "";
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return "";
      const pad = (n: number) => n.toString().padStart(2, '0');
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return "";
    }
  };

  // Fetch delivery notes
  const { data: deliveryNotesData = [], isLoading, error, refetch } = useQuery({
  queryKey: ["delivery-notes", currentPage, deliverySearchTerm, statusFilter, customerFilter, pageSize],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        params.set('page', currentPage.toString());
        params.set('pageSize', pageSize.toString());
        if (deliverySearchTerm) params.set('search', deliverySearchTerm);
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (customerFilter) params.set('customerId', customerFilter);
        
        // Try relative URL first (for production), then absolute URL (for development)
        const url = `/api/delivery-notes?${params}`;
        console.log('Fetching delivery notes from URL:', url);
        let response;
        try {
          response = await fetch(url, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          console.log('Relative URL response status:', response.status);
        } catch (relativeError) {
          console.log('Relative URL failed, trying absolute URL...', relativeError);
          const absoluteUrl = `http://localhost:5000/api/delivery-notes?${params}`;
          console.log('Trying absolute URL:', absoluteUrl);
          response = await fetch(absoluteUrl, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          console.log('Absolute URL response status:', response.status);
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Delivery notes fetched successfully:', data.length, 'records');
        return data as DeliveryNote[];
      } catch (error) {
        console.error('Error fetching delivery notes:', error);
        throw new Error(`Failed to fetch delivery notes: ${error instanceof Error ? error.message : 'Network error - please ensure the server is running on port 5000'}`);
      }
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Fetch available sales orders for delivery note creation
  // Fetch all sales orders for order number selection
  const { data: availableSalesOrders = [] } = useQuery({
    queryKey: ["sales-orders-list"],
    queryFn: async () => {
      try {
        let response;
        try {
          response = await fetch("/api/sales-orders", {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
        } catch (relativeError) {
          response = await fetch("/api/sales-orders", {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
        }
        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`Sales orders fetch failed: HTTP ${response.status}: ${errorText}`);
          return [];
        }
        const data = await response.json();
        // Only return orderNumber, id, and customer for selection
        return (Array.isArray(data) ? data : []).map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customer: order.customer
        }));
      } catch (error) {
        console.error('Error fetching sales orders:', error);
        return [];
      }
    }
  });

  // When a sales order is selected in the create dialog, fetch its items
  useEffect(() => {
    const fetchItems = async () => {
      if (!selectedSalesOrderId || !showCreateDialog) {
        setSoItemsForCreate([]);
        setDeliverQtyBySoItem({});
        setDeliveryTypeSelection('Partial');
        return;
      }
      try {
        setSoItemsLoading(true);
        const res = await fetch(`/api/sales-orders/${selectedSalesOrderId}/items`);
        if (res.ok) {
          const items: SalesOrderItem[] = await res.json();
          setSoItemsForCreate(items);
          // Initialize all deliver quantities to 0
          const init: Record<string, number> = {};
          for (const it of items) init[(it as any).id] = 0;
          setDeliverQtyBySoItem(init);
          setDeliveryTypeSelection('Partial');
        } else {
          setSoItemsForCreate([]);
        }
      } catch {
        setSoItemsForCreate([]);
      } finally {
        setSoItemsLoading(false);
      }
    };
    fetchItems();
  }, [selectedSalesOrderId, showCreateDialog]);

  // Create delivery note mutation
  const createDeliveryNoteMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/delivery-notes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      setCurrentPage(1);
  setDeliverySearchTerm("");
      setStatusFilter("all");
      setCustomerFilter("");
      refetch();
      toast({
        title: "Success",
        description: "Delivery note created successfully"
      });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create delivery note",
        variant: "destructive"
      });
    }
  });

  // Update delivery note status mutation
  const updateDeliveryStatusMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PATCH", `/api/delivery-notes/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      setCurrentPage(1);
  setDeliverySearchTerm("");
      setStatusFilter("all");
      setCustomerFilter("");
      refetch();
      toast({
        title: "Success",
        description: "Delivery note updated successfully"
      });
      setShowPickingDialog(false);
      setShowConfirmDeliveryDialog(false);
      setShowEditDialog(false);
      setShowStatusChangeDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update delivery note",
        variant: "destructive"
      });
    }
  });

  // Delete delivery note mutation
  const deleteDeliveryNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/delivery-notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      refetch();
      toast({
        title: "Success",
        description: "Delivery note deleted successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete delivery note",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setSelectedSalesOrderId("");
    setDeliveryDate("");
    setDeliveryAddress("");
    setDeliveryNotes("");
    setTrackingNumber("");
    setCarrierName("");
    setDeliveryConfirmationName("");
    setSelectedDeliveryNote(null);
    setSalesOrderSearchTerm("");
    setNewStatus("Pending");
    setStatusChangeReason("");
  };

  const handleCreateDeliveryNote = async () => {
    if (!selectedSalesOrderId) {
      toast({
        title: "Error",
        description: "Please select a sales order",
        variant: "destructive"
      });
      return;
    }

    // Find selected sales order to get orderNumber
    const selectedOrder = availableSalesOrders.find(order => order.id === selectedSalesOrderId);
    if (!selectedOrder || !selectedOrder.orderNumber) {
      toast({
        title: "Error",
        description: "Selected sales order is invalid or missing order number",
        variant: "destructive"
      });
      return;
    }

    // Compute totals from entered quantities to determine Partial vs Full
    const totals = soItemsForCreate.reduce(
      (acc: { ordered: number; deliver: number }, it: any) => {
        const ordered = Number(it.quantity) || 0;
        const deliver = Number(deliverQtyBySoItem[it.id] || 0);
        acc.ordered += ordered;
        acc.deliver += deliver;
        return acc;
      },
      { ordered: 0, deliver: 0 }
    );
    if (totals.deliver <= 0) {
      toast({ title: "Error", description: "Please enter quantities > 0 for at least one item.", variant: "destructive" });
      return;
    }
    const isFull = totals.deliver === totals.ordered && totals.ordered > 0;
    const deliveryType = isFull ? "Full" : "Partial";
    const headerPayload = {
      salesOrderId: selectedSalesOrderId,
      deliveryDate: deliveryDate || null,
      deliveryAddress,
      deliveryNotes,
      trackingNumber,
      carrierName,
      status: isFull ? "Pending" : "Partial",
      deliveryType,
      createdBy: userId || SYSTEM_USER_ID
    };

    try {
      const headerRes = await apiRequest("POST", "/api/delivery-notes", headerPayload);
      if (!headerRes.ok) throw new Error(await headerRes.text());
      const createdDelivery: DeliveryNote = await headerRes.json();

      // Create delivery items for lines where qty > 0
      const itemsToCreate = soItemsForCreate
        .map((it: any, idx) => ({ it, qty: Number(deliverQtyBySoItem[it.id] || 0), idx }))
        .filter(x => x.qty > 0)
        .map(x => ({
          deliveryId: createdDelivery.id,
          salesOrderItemId: x.it.id,
          itemId: x.it.itemId, // Include itemId for better server processing
          // Server will enrich the rest (pricing, barcode, etc.)
          orderedQuantity: x.it.quantity,
          pickedQuantity: x.qty,
          deliveredQuantity: x.qty,
        }));

      console.log("Creating delivery items:", itemsToCreate);

      if (itemsToCreate.length === 0) {
        throw new Error("No items selected for delivery. Please enter quantities > 0 for at least one item.");
      }

      if (itemsToCreate.length > 0) {
        // Use bulk endpoint when available; fallback to per-item
        try {
          const bulkRes = await apiRequest("POST", "/api/delivery-items/bulk", itemsToCreate);
          if (!bulkRes.ok) throw new Error(await bulkRes.text());
        } catch (bulkError) {
          console.log("Bulk create failed, trying individual creates:", bulkError);
          // Fallback to individual creates
          for (const payload of itemsToCreate) {
            try {
              // eslint-disable-next-line no-await-in-loop
              const itemRes = await apiRequest("POST", `/api/deliveries/${createdDelivery.id}/items`, payload);
              if (!itemRes.ok) {
                console.error("Failed to create delivery item:", await itemRes.text());
              }
            } catch (itemError) {
              console.error("Error creating delivery item:", itemError);
            }
          }
        }
      }

      // Refresh list and close
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      setCurrentPage(1);
      setShowCreateDialog(false);
      resetForm();
      toast({ title: "Success", description: deliveryType === 'Partial' ? "Partial delivery created" : "Delivery note created" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to create delivery note", variant: "destructive" });
    }
  };

  const handleStartPicking = () => {
    if (!selectedDeliveryNote) return;
    
    const updateData = {
      pickingStartedBy: userId || SYSTEM_USER_ID,
      pickingStartedAt: new Date().toISOString(),
      status: "Partial"
    };
    updateDeliveryStatusMutation.mutate({
      id: selectedDeliveryNote.id,
      data: updateData
    });
  };

  const handleCompletePicking = () => {
    if (!selectedDeliveryNote) return;
    
    const updateData = {
      pickingCompletedBy: userId || SYSTEM_USER_ID,
      pickingCompletedAt: new Date().toISOString(),
      pickingNotes: deliveryNotes,
      status: "Complete"
    };
    updateDeliveryStatusMutation.mutate({
      id: selectedDeliveryNote.id,
      data: updateData
    });
  };

  const handleConfirmDelivery = () => {
    if (!selectedDeliveryNote) return;
    
    const updateData = {
      deliveryConfirmedBy: deliveryConfirmationName,
      deliveryConfirmedAt: new Date().toISOString(),
      actualDeliveryDate: new Date().toISOString(),
      status: "Complete"
    };
    updateDeliveryStatusMutation.mutate({
      id: selectedDeliveryNote.id,
      data: updateData
    });
  };

  const handleStatusChange = () => {
    if (!selectedDeliveryNote) return;
    
    const updateData: any = {
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    // Add specific fields based on status
    switch (newStatus) {
      case "Partial":
        if (!selectedDeliveryNote.pickingStartedBy) {
          updateData.pickingStartedBy = userId || SYSTEM_USER_ID;
          updateData.pickingStartedAt = new Date().toISOString();
        }
        break;
      case "Complete":
        if (!selectedDeliveryNote.pickingCompletedBy) {
          updateData.pickingCompletedBy = userId || SYSTEM_USER_ID;
          updateData.pickingCompletedAt = new Date().toISOString();
        }
        if (!selectedDeliveryNote.deliveryConfirmedBy) {
          updateData.deliveryConfirmedBy = userId || SYSTEM_USER_ID;
          updateData.deliveryConfirmedAt = new Date().toISOString();
          updateData.actualDeliveryDate = new Date().toISOString();
        }
        break;
      case "Cancelled":
        updateData.deliveryNotes = `${selectedDeliveryNote.deliveryNotes || ''}\n[Cancelled: ${statusChangeReason || 'No reason provided'}]`.trim();
        break;
    }

    // Add reason to delivery notes if provided
    if (statusChangeReason) {
      updateData.deliveryNotes = `${selectedDeliveryNote.deliveryNotes || ''}\n[Status changed to ${newStatus}: ${statusChangeReason}]`.trim();
    }

    updateDeliveryStatusMutation.mutate({
      id: selectedDeliveryNote.id,
      data: updateData
    });
  };

  // Function to fetch delivery items for editing
  const fetchDeliveryItemsForEdit = async () => {
    if (!selectedDeliveryNote?.id) return;
    
    setEnquiryItemsLoading(true);
    try {
      const response = await fetch(`/api/deliveries/${selectedDeliveryNote.id}/items`);
      if (response.ok) {
        const data = await response.json();
        setEnquiryItems(data);
        const init: Record<string, number> = {};
        for (const it of data) {
          init[it.id] = Number(it.deliveredQuantity || it.pickedQuantity || it.orderedQuantity || 0);
        }
        setEditedDeliveryQtyByItem(init);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to fetch delivery items",
        variant: "destructive"
      });
    }
    setEnquiryItemsLoading(false);
  };

  // Function to save item changes
  const handleSaveItemChanges = async () => {
    if (!selectedDeliveryNote?.id) return;

    setIsSavingItemChanges(true);
    try {
      // Prepare the update data for each item
      const itemUpdates = Object.entries(editedDeliveryQtyByItem).map(([itemId, quantity]) => ({
        id: itemId,
        deliveredQuantity: quantity
      }));

      const response = await fetch(`/api/deliveries/${selectedDeliveryNote.id}/items`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: itemUpdates })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Delivery item quantities updated successfully"
        });
        setIsEditingItems(false);
        // Refresh the delivery items
        await fetchDeliveryItemsForEdit();
        // Refresh the main delivery notes list
        queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
      } else {
        throw new Error('Failed to update delivery items');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save item changes",
        variant: "destructive"
      });
    }
    setIsSavingItemChanges(false);
  };

  // Print handler for delivery note
  // Print handler for delivery note using enquiryItems
  // ...existing code...

  const columns: Column<DeliveryNote>[] = [
    {
      key: "deliveryNumber",
      header: "Delivery Number",
      render: (_value, item) => (
        <div className="font-medium text-blue-600">
          {item?.deliveryNumber || 'N/A'}
        </div>
      )
    },
    {
      key: "salesOrder.customer.name",
      header: "Customer",
      render: (_value, item) => (
        <div>
          <div className="font-medium">{item.salesOrder?.customer?.name || 'N/A'}</div>
          <div className="text-sm text-gray-500">{item.salesOrder?.customer?.email || ''}</div>
        </div>
      )
    },
    {
      key: "status",
      header: "Status",
      render: (_value, item) => (
        <div className="flex items-center gap-2">
          <StatusPill status={item?.status || 'Unknown'} />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Change Status"
            aria-label="Change Status"
            onClick={() => {
              setSelectedDeliveryNote(item);
              setNewStatus(item?.status || 'Pending');
              setShowStatusChangeDialog(true);
            }}
          >
            <Edit className="h-4 w-4 text-blue-600" />
          </Button>
        </div>
      )
    },
    {
      key: "deliveryType",
      header: "Type",
      render: (_value, item) => (
        <Badge variant="outline">{item?.deliveryType || 'Unknown'}</Badge>
      )
    },
    {
      key: "deliveryDate",
      header: "Delivery Date",
      render: (_value, item) => (
        <div>
          {item?.deliveryDate ? formatDate(item.deliveryDate) : "Not scheduled"}
        </div>
      )
    },
    {
      key: "trackingNumber",
      header: "Tracking",
      render: (_value, item) => (
        <div>
          {item?.trackingNumber ? (
            <div>
              <div className="font-medium">{item.trackingNumber}</div>
              <div className="text-sm text-gray-500">{item.carrierName || ''}</div>
            </div>
          ) : (
            <span className="text-gray-400">No tracking</span>
          )}
        </div>
      )
    },
    {
      key: "createdAt",
      header: "Created",
      render: (_value, item) => formatDate(item?.createdAt)
    },
    {
      key: "actions",
      header: "Actions",
      render: (_value, item) => (
        <div className="flex items-center gap-1">
          {/* View */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="View"
            aria-label="View"
            onClick={() => {
              setSelectedDeliveryNote(item);
              setShowDetailsDialog(true);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>

          {/* Print */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Print"
            aria-label="Print"
            onClick={async () => {
              let items: any[] = [];
              try {
                console.log('Fetching items for print, delivery ID:', item.id);
                const response = await fetch(`/api/deliveries/${item.id}/items`);
                if (response.ok) {
                  items = await response.json();
                  console.log('Items for print:', items);
                  console.log('Number of items for print:', items.length);
                } else {
                  console.error('Failed to fetch items for print:', response.status, response.statusText);
                }
              } catch (err) {
                console.error('Error fetching items for print:', err);
              }
              handlePrintDelivery(item, items);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V2h12v7M6 18v4h12v-4M6 14h12a2 2 0 002-2V9a2 2 0 00-2-2H6a2 2 0 00-2 2v3a2 2 0 002 2z" /></svg>
          </Button>

          {/* Edit */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Edit"
            aria-label="Edit"
            onClick={() => {
              setSelectedDeliveryNote(item);
              // Pre-fill edit form values
              setDeliveryDate(formatForDateTimeLocal(item.deliveryDate));
              setDeliveryAddress(item.deliveryAddress || "");
              setCarrierName(item.carrierName || "");
              setTrackingNumber(item.trackingNumber || "");
              setDeliveryNotes(item.deliveryNotes || "");
              // Automatically start editing items mode and fetch items
              setIsEditingItems(true);
              setShowEditDialog(true);
              // Fetch delivery items immediately
              setTimeout(() => {
                if (item.id) {
                  fetchDeliveryItemsForEdit();
                }
              }, 100);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          {/* Delete */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-600 hover:text-red-700"
            title="Delete"
            aria-label="Delete"
            onClick={() => {
              setDeliveryToDelete(item);
              setShowDeleteDialog(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {/* Start Picking (only Pending) */}
          {item.status === "Pending" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Start Picking"
              aria-label="Start Picking"
              onClick={() => {
                setSelectedDeliveryNote(item);
                setShowPickingDialog(true);
              }}
            >
              <Package className="h-4 w-4" />
            </Button>
          )}
          {/* Confirm Delivery (Partial or Complete but not yet confirmed) */}
          {(item.status === "Partial" || item.status === "Complete") && !item.deliveryConfirmedBy && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-green-600 hover:text-green-700"
              title="Confirm Delivery"
              aria-label="Confirm Delivery"
              onClick={() => {
                setSelectedDeliveryNote(item);
                setShowConfirmDeliveryDialog(true);
              }}
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
  // Print handler for delivery note
  // ...existing code...
      )
    }
  ];

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Delivery Notes</h3>
          <p className="text-gray-600 mb-4">
            {error.message || "There was a problem loading the delivery notes."}
          </p>
          <div className="space-y-2">
            <Button onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <p className="text-sm text-gray-500">
              If the problem persists, please ensure the server is running on port 5000
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card-style header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Truck className="h-8 w-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                  Delivery Notes
                </h1>
              </div>
              <p className="text-muted-foreground text-lg">
                Step 8: Manage delivery notes generated from sales orders with barcode picking and delivery confirmation
              </p>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1 text-sm text-blue-600">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <span className="font-medium">Delivery Management</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Active Deliveries: {deliveryNotesData.filter((d: DeliveryNote) => d.status !== "Complete" && d.status !== "Cancelled").length}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setShowCreateDialog(true)}
              variant="outline"
              className="font-semibold px-6 py-2 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Delivery Note
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="Search by delivery number, customer, or tracking..."
                value={deliverySearchTerm}
                onChange={(e) => {
                  setDeliverySearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="max-w-md"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
                <SelectItem value="Complete">Complete</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                if (showAll) {
                  // revert
                  setPageSize(15);
                  setShowAll(false);
                  setCurrentPage(1);
                } else {
                  setPageSize(500); // large number to effectively show all
                  setShowAll(true);
                  setCurrentPage(1);
                }
              }}
            >
              {showAll ? (
                <>
                  <Filter className="h-4 w-4 mr-2" /> Paginate
                </>
              ) : (
                <>
                  <Filter className="h-4 w-4 mr-2" /> Show All
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Notes Table with empty state */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Delivery Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : deliveryNotesData.length > 0 ? (
            <>
              <DataTable
                data={deliveryNotesData}
                columns={[...columns]}
                className="w-full"
              />
              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">Page {currentPage}</span>
                <Button
                  variant="outline"
                  disabled={deliveryNotesData.length < pageSize}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-sm text-gray-500 space-y-4">
              <p>No delivery notes found. Create a new delivery note to get started.</p>
              <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create Delivery Note
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Delivery Note Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Delivery Note</DialogTitle>
            <DialogDescription>
              Generate a delivery note from an existing sales order for picking and delivery management.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="salesOrder">Sales Order *</Label>
              {/* Single field: search and select sales order */}
              <Select value={selectedSalesOrderId} onValueChange={setSelectedSalesOrderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Type or select sales order..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-2">
                    <Input
                      id="salesOrderSearch"
                      placeholder="Search sales order number or customer..."
                      value={salesOrderSearchTerm}
                      onChange={e => setSalesOrderSearchTerm(e.target.value)}
                      className="mb-2"
                      autoFocus
                    />
                  </div>
                  {availableSalesOrders
                    .filter(order => {
                      const term = salesOrderSearchTerm.trim().toLowerCase();
                      if (!term) return true;
                      return (
                        order.orderNumber?.toLowerCase().includes(term) ||
                        order.customer?.name?.toLowerCase().includes(term)
                      );
                    })
                    .map(order => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.orderNumber} - {order.customer?.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Partial quantities table */}
            {selectedSalesOrderId && (
              <div className="mt-2">
                <h4 className="font-semibold mb-2">Select Items and Quantities</h4>
              {/* Delivery Type helper */}
              <div className="grid grid-cols-12 gap-3 items-end mb-3">
                <div className="col-span-4">
                  <Label className="text-xs">Delivery Type</Label>
                  <Select value={deliveryTypeSelection} onValueChange={(v: any) => {
                    const val = (v === 'Full' ? 'Full' : 'Partial') as 'Full' | 'Partial';
                    setDeliveryTypeSelection(val);
                    if (val === 'Full') {
                      // Prefill all deliver quantities to ordered quantities
                      const next: Record<string, number> = {};
                      for (const it of soItemsForCreate as any[]) {
                        next[it.id] = Number(it.quantity) || 0;
                      }
                      setDeliverQtyBySoItem(next);
                    } else {
                      // Keep current entries; do not overwrite
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select delivery type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Partial">Partial</SelectItem>
                      <SelectItem value="Full">Full</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
                {soItemsLoading ? (
                  <div className="text-sm text-gray-500">Loading sales order items...</div>
                ) : soItemsForCreate.length === 0 ? (
                  <div className="text-sm text-gray-400">No items found for this sales order.</div>
                ) : (
                  <div className="space-y-2">
                    {soItemsForCreate.map((it: any) => (
                      <div key={it.id} className="grid grid-cols-12 gap-3 items-center bg-gray-50 rounded p-2">
                        <div className="col-span-6">
                          <div className="font-medium truncate" title={it.description || ''}>{it.description || 'Item'}</div>
                          <div className="text-xs text-gray-500">Ordered: {it.quantity}</div>
                        </div>
                        <div className="col-span-3">
                          <Label className="text-xs">Deliver Qty</Label>
                          <Input
                            type="number"
                            min={0}
                            max={Number(it.quantity) || undefined}
                            value={deliverQtyBySoItem[it.id] ?? 0}
                            onChange={e => {
                              const v = Math.max(0, Math.min(Number(e.target.value || 0), Number(it.quantity) || 0));
                              setDeliverQtyBySoItem(prev => ({ ...prev, [it.id]: v }));
                            }}
                          />
                        </div>
                        <div className="col-span-3 text-right text-sm text-gray-600">
                          Unit: {it.unitPrice}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="deliveryDate">Scheduled Delivery Date</Label>
              <Input
                id="deliveryDate"
                type="datetime-local"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="deliveryAddress">Delivery Address</Label>
              <Textarea
                id="deliveryAddress"
                placeholder="Enter delivery address..."
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="carrierName">Carrier/Transporter</Label>
              <Input
                id="carrierName"
                placeholder="Enter carrier or transporter name"
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="trackingNumber">Tracking Number</Label>
              <Input
                id="trackingNumber"
                placeholder="Enter tracking number (if available)"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="deliveryNotes">Delivery Notes</Label>
              <Textarea
                id="deliveryNotes"
                placeholder="Enter any special delivery instructions..."
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateDeliveryNote}
              disabled={createDeliveryNoteMutation.isPending}
            >
              {createDeliveryNoteMutation.isPending && <LoadingSpinner className="mr-2" />}
              Create Delivery Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-5xl max-h-[75vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Delivery Note Details</DialogTitle>
            <DialogDescription>
              {selectedDeliveryNote?.deliveryNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedDeliveryNote && (
            <div className="space-y-6 text-sm">
              {/* ...existing details rendering... */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-base mb-3">Delivery Information</h3>
                  <div className="space-y-2">
                    <div><strong>Customer:</strong> {selectedDeliveryNote.salesOrder?.customer?.name}</div>
                    <div><strong>Status:</strong> <StatusPill status={selectedDeliveryNote.status} /></div>
                    <div><strong>Type:</strong> {selectedDeliveryNote.deliveryType}</div>
                    <div><strong>Delivery Date:</strong> {selectedDeliveryNote.deliveryDate ? formatDate(selectedDeliveryNote.deliveryDate) : "Not scheduled"}</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-base mb-3">Tracking Information</h3>
                  <div className="space-y-2">
                    <div><strong>Tracking Number:</strong> {selectedDeliveryNote.trackingNumber || "N/A"}</div>
                    <div><strong>Carrier:</strong> {selectedDeliveryNote.carrierName || "N/A"}</div>
                    <div><strong>Estimated Delivery:</strong> {selectedDeliveryNote.estimatedDeliveryDate ? formatDate(selectedDeliveryNote.estimatedDeliveryDate) : "N/A"}</div>
                    <div><strong>Actual Delivery:</strong> {selectedDeliveryNote.actualDeliveryDate ? formatDate(selectedDeliveryNote.actualDeliveryDate) : "Pending"}</div>
                  </div>
                </div>
              </div>
              {/* Enquiry Items Section */}
              <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-base">Delivery Items</h3>
              </div>
                {enquiryItemsLoading ? (
                  <div className="text-sm text-gray-500">Loading items...</div>
                ) : enquiryItems.length > 0 ? (
                  <div className="space-y-2">
                {enquiryItems.map((item, idx) => (
                  <div key={item.id || idx} className="flex justify-between items-center bg-gray-50 rounded p-2">
                    <span className="font-medium truncate">{item.description}</span>
                    {isEditingItems ? (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min={0}
                          value={editedDeliveryQtyByItem[item.id] ?? (item.deliveredQuantity || 0)}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value || 0));
                            setEditedDeliveryQtyByItem(prev => ({ ...prev, [item.id]: v }));
                          }}
                          className="w-24"
                        />
                      </div>
                    ) : (
                      <span className="text-gray-700 font-mono">Qty: {item.deliveredQuantity || item.pickedQuantity || item.orderedQuantity || item.quantity}</span>
                    )}
                  </div>
                ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">No items found for this enquiry.</div>
                )}
              </div>
              {selectedDeliveryNote.deliveryAddress && (
                <div>
                  <h3 className="font-semibold text-base mb-2">Delivery Address</h3>
                  <p className="text-gray-600 bg-gray-50 p-3 rounded">
                    {selectedDeliveryNote.deliveryAddress}
                  </p>
                </div>
              )}
              {selectedDeliveryNote.deliveryNotes && (
                <div>
                  <h3 className="font-semibold text-base mb-2">Delivery Notes</h3>
                  <p className="text-gray-600 bg-gray-50 p-3 rounded">
                    {selectedDeliveryNote.deliveryNotes}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-base mb-2">Picking Information</h3>
                  <div className="space-y-1">
                    <div><strong>Started:</strong> {selectedDeliveryNote.pickingStartedAt ? formatDate(selectedDeliveryNote.pickingStartedAt) : "Not started"}</div>
                    <div><strong>Completed:</strong> {selectedDeliveryNote.pickingCompletedAt ? formatDate(selectedDeliveryNote.pickingCompletedAt) : "Not completed"}</div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-base mb-2">Delivery Confirmation</h3>
                  <div className="space-y-1">
                    <div><strong>Confirmed By:</strong> {selectedDeliveryNote.deliveryConfirmedBy || "Not confirmed"}</div>
                    <div><strong>Confirmed At:</strong> {selectedDeliveryNote.deliveryConfirmedAt ? formatDate(selectedDeliveryNote.deliveryConfirmedAt) : "Not confirmed"}</div>
                  </div>
                </div>
              </div>

              {/* Status History */}
              <div>
                <h3 className="font-semibold text-base mb-3">Status History</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <StatusPill status={selectedDeliveryNote.status} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">Current Status</div>
                      <div className="text-xs text-gray-500">
                        Last updated: {formatDate(selectedDeliveryNote.updatedAt)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Show status progression */}
                  {selectedDeliveryNote.pickingStartedAt && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <StatusPill status="Partial" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Picking Started</div>
                        <div className="text-xs text-gray-500">
                          Started: {formatDate(selectedDeliveryNote.pickingStartedAt)}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedDeliveryNote.pickingCompletedAt && (
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <StatusPill status="Complete" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Picking Completed</div>
                        <div className="text-xs text-gray-500">
                          Completed: {formatDate(selectedDeliveryNote.pickingCompletedAt)}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedDeliveryNote.deliveryConfirmedAt && (
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <StatusPill status="Complete" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Delivery Confirmed</div>
                        <div className="text-xs text-gray-500">
                          Confirmed: {formatDate(selectedDeliveryNote.deliveryConfirmedAt)} by {selectedDeliveryNote.deliveryConfirmedBy}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Delivery Note Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) {
          // Reset editing state when dialog closes
          setIsEditingItems(false);
          setEnquiryItems([]);
          setEditedDeliveryQtyByItem({});
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Delivery Note</DialogTitle>
            <DialogDescription>
              {selectedDeliveryNote?.deliveryNumber} - Items are automatically loaded for editing
            </DialogDescription>
          </DialogHeader>
          {selectedDeliveryNote && (
            <div className="space-y-6">
              {/* Delivery Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Delivery Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editDeliveryDate">Scheduled Delivery Date</Label>
                    <Input
                      id="editDeliveryDate"
                      type="datetime-local"
                      value={deliveryDate || selectedDeliveryNote.deliveryDate || ""}
                      onChange={e => setDeliveryDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editCarrierName">Carrier/Transporter</Label>
                    <Input
                      id="editCarrierName"
                      placeholder="Enter carrier or transporter name"
                      value={carrierName || selectedDeliveryNote.carrierName || ""}
                      onChange={e => setCarrierName(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="editDeliveryAddress">Delivery Address</Label>
                  <Textarea
                    id="editDeliveryAddress"
                    placeholder="Enter delivery address..."
                    value={deliveryAddress || selectedDeliveryNote.deliveryAddress || ""}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editTrackingNumber">Tracking Number</Label>
                    <Input
                      id="editTrackingNumber"
                      placeholder="Enter tracking number (if available)"
                      value={trackingNumber || selectedDeliveryNote.trackingNumber || ""}
                      onChange={e => setTrackingNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editDeliveryNotes">Delivery Notes</Label>
                    <Textarea
                      id="editDeliveryNotes"
                      placeholder="Enter any special delivery instructions..."
                      value={deliveryNotes || selectedDeliveryNote.deliveryNotes || ""}
                      onChange={e => setDeliveryNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Items Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Delivery Items</h3>
                  {/* Show status of editing mode */}
                  {isEditingItems && (
                    <Badge variant="secondary" className="text-xs">
                      Editing Mode - Modify quantities below
                    </Badge>
                  )}
                </div>

                {enquiryItemsLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : enquiryItems.length > 0 ? (
                  <div className="space-y-3">
                    {enquiryItems.map((item, index) => (
                      <div key={item.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                          <div className="md:col-span-2">
                            <p className="font-medium text-sm text-gray-900">{item.description}</p>
                            <p className="text-xs text-gray-500">SKU: {item.barcode}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Ordered</Label>
                            <p className="text-sm font-medium">{item.orderedQuantity}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Picked</Label>
                            <p className="text-sm font-medium">{item.pickedQuantity || 0}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Delivered</Label>
                            {isEditingItems ? (
                              <div className="flex items-center space-x-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    const currentQty = editedDeliveryQtyByItem[item.id] || 0;
                                    if (currentQty > 0) {
                                      setEditedDeliveryQtyByItem(prev => ({
                                        ...prev,
                                        [item.id]: currentQty - 1
                                      }));
                                    }
                                  }}
                                  disabled={!isEditingItems}
                                >
                                  -
                                </Button>
                                <Input
                                  type="number"
                                  min="0"
                                  max={item.pickedQuantity || item.orderedQuantity}
                                  value={editedDeliveryQtyByItem[item.id] || 0}
                                  onChange={(e) => {
                                    const value = Math.max(0, Math.min(parseInt(e.target.value) || 0, item.pickedQuantity || item.orderedQuantity));
                                    setEditedDeliveryQtyByItem(prev => ({
                                      ...prev,
                                      [item.id]: value
                                    }));
                                  }}
                                  className="w-16 h-8 text-center"
                                  disabled={!isEditingItems}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    const currentQty = editedDeliveryQtyByItem[item.id] || 0;
                                    const maxQty = item.pickedQuantity || item.orderedQuantity;
                                    if (currentQty < maxQty) {
                                      setEditedDeliveryQtyByItem(prev => ({
                                        ...prev,
                                        [item.id]: currentQty + 1
                                      }));
                                    }
                                  }}
                                  disabled={!isEditingItems}
                                >
                                  +
                                </Button>
                              </div>
                            ) : (
                              <p className="text-sm font-medium">{item.deliveredQuantity || 0}</p>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">Unit Price</Label>
                            <p className="text-sm font-medium">{formatCurrency(item.unitPrice)}</p>
                          </div>
                        </div>
                        {isEditingItems && (
                          <div className="mt-2 text-xs text-gray-500">
                            Max deliverable: {item.pickedQuantity || item.orderedQuantity} units
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p>No delivery items found</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowEditDialog(false);
                setIsEditingItems(false);
                setEditedDeliveryQtyByItem({});
                setEnquiryItems([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedDeliveryNote) return;
                
                // First save item changes if in editing mode
                if (isEditingItems && enquiryItems.length > 0) {
                  try {
                    setIsSavingItemChanges(true);
                    const itemUpdates = Object.entries(editedDeliveryQtyByItem).map(([itemId, quantity]) => ({
                      id: itemId,
                      deliveredQuantity: quantity
                    }));

                    const itemResponse = await fetch(`/api/deliveries/${selectedDeliveryNote.id}/items`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ items: itemUpdates })
                    });

                    if (!itemResponse.ok) {
                      throw new Error('Failed to update item quantities');
                    }
                    setIsSavingItemChanges(false);
                  } catch (error) {
                    setIsSavingItemChanges(false);
                    toast({
                      title: "Error",
                      description: "Failed to update delivery item quantities",
                      variant: "destructive"
                    });
                    return;
                  }
                }

                // Then save delivery note changes
                const updateData = {
                  deliveryDate: deliveryDate || selectedDeliveryNote.deliveryDate,
                  deliveryAddress: deliveryAddress || selectedDeliveryNote.deliveryAddress,
                  deliveryNotes: deliveryNotes || selectedDeliveryNote.deliveryNotes,
                  trackingNumber: trackingNumber || selectedDeliveryNote.trackingNumber,
                  carrierName: carrierName || selectedDeliveryNote.carrierName
                };
                
                updateDeliveryStatusMutation.mutate({
                  id: selectedDeliveryNote.id,
                  data: updateData
                });
                setShowEditDialog(false);
                setIsEditingItems(false);
                setEditedDeliveryQtyByItem({});
                setEnquiryItems([]);
              }}
              disabled={updateDeliveryStatusMutation.isPending || isSavingItemChanges}
            >
              {(updateDeliveryStatusMutation.isPending || isSavingItemChanges) && <LoadingSpinner className="mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Picking Dialog */}
      <Dialog open={showPickingDialog} onOpenChange={setShowPickingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Picking Process</DialogTitle>
            <DialogDescription>
              Begin the picking process for delivery {selectedDeliveryNote?.deliveryNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <QrCode className="h-4 w-4" />
              Use barcode scanner to pick items efficiently
            </div>
            <Button onClick={handleStartPicking} className="w-full">
              Start Picking Process
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Delivery Dialog */}
      <Dialog open={showConfirmDeliveryDialog} onOpenChange={setShowConfirmDeliveryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delivery</DialogTitle>
            <DialogDescription>
              Confirm delivery completion for {selectedDeliveryNote?.deliveryNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="confirmationName">Receiver Name *</Label>
              <Input
                id="confirmationName"
                placeholder="Name of person who received the delivery"
                value={deliveryConfirmationName}
                onChange={(e) => setDeliveryConfirmationName(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDeliveryDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmDelivery}
              disabled={!deliveryConfirmationName.trim() || updateDeliveryStatusMutation.isPending}
            >
              {updateDeliveryStatusMutation.isPending && <LoadingSpinner className="mr-2" />}
              Confirm Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={showStatusChangeDialog} onOpenChange={setShowStatusChangeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Delivery Status</DialogTitle>
            <DialogDescription>
              Update the status for delivery {selectedDeliveryNote?.deliveryNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="currentStatus">Current Status</Label>
              <div className="mt-1">
                <StatusPill status={selectedDeliveryNote?.status || 'Unknown'} />
              </div>
            </div>
            
            <div>
              <Label htmlFor="newStatus">New Status *</Label>
              <Select value={newStatus} onValueChange={(value: "Pending" | "Partial" | "Complete" | "Cancelled") => setNewStatus(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                  <SelectItem value="Complete">Complete</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="statusReason">Reason for Change (Optional)</Label>
              <Textarea
                id="statusReason"
                placeholder="Enter reason for status change..."
                value={statusChangeReason}
                onChange={(e) => setStatusChangeReason(e.target.value)}
                rows={3}
              />
            </div>

            {newStatus === "Complete" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-800 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Complete Status</span>
                </div>
                <p className="text-green-700 text-xs mt-1">
                  This will mark the delivery as complete and set confirmation details if not already set.
                </p>
              </div>
            )}

            {newStatus === "Cancelled" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-800 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Cancel Delivery</span>
                </div>
                <p className="text-red-700 text-xs mt-1">
                  This will cancel the delivery. Please provide a reason for cancellation.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusChangeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleStatusChange}
              disabled={updateDeliveryStatusMutation.isPending || (newStatus === selectedDeliveryNote?.status)}
              className={newStatus === "Cancelled" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {updateDeliveryStatusMutation.isPending && <LoadingSpinner className="mr-2" />}
              {newStatus === "Cancelled" ? "Cancel Delivery" : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Delivery Note
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete delivery note <strong>{deliveryToDelete?.deliveryNumber}</strong>? 
              This action cannot be undone and will permanently remove the delivery note from the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (deliveryToDelete) {
                  deleteDeliveryNoteMutation.mutate(deliveryToDelete.id);
                  setShowDeleteDialog(false);
                  setDeliveryToDelete(null);
                }
              }}
              disabled={deleteDeliveryNoteMutation.isPending}
            >
              {deleteDeliveryNoteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}