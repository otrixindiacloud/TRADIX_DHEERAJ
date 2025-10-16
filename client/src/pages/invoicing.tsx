import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, FileText, Send, DollarSign, Clock, CheckCircle, Download, Edit, Plane, AlertTriangle, FileDown, ChevronDown, Receipt, User } from "lucide-react";
import DataTable, { Column } from "@/components/tables/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmailSendButton } from "@/components/email/EmailSendButton";
import { formatDate, formatCurrency, formatCurrencyCompact, getStatusColor } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Invoicing() {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  
  // Parse search parameters from URL
  const getSearchParams = () => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    return {
      get: (key: string) => urlParams.get(key)
    };
  };
  const searchParams = getSearchParams();

  // Email invoice mutation (legacy - keeping for backward compatibility)
  const emailInvoice = useMutation({
    mutationFn: async ({ id, email }: { id: string; email?: string }) => {
      const response = await apiRequest("POST", `/api/invoices/${id}/send`, { email });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Sent", description: "Invoice email dispatched (status set to Sent)." });
    },
    onError: (err: any) => {
      console.error("Send invoice error", err);
      toast({ title: "Error", description: "Failed to send invoice", variant: "destructive" });
    },
  });

  const { data: invoices, isLoading, error: invoicesError } = useQuery({
    queryKey: ["/api/invoices"],
    queryFn: async () => {
      const response = await fetch("/api/invoices");
      if (!response.ok) {
        throw new Error(`Failed to fetch invoices: ${response.statusText}`);
      }
      return response.json();
    },
  });

  const { data: deliveries, error: deliveriesError } = useQuery({
    queryKey: ["/api/deliveries"],
    queryFn: async () => {
      const response = await fetch("/api/deliveries");
      if (!response.ok) {
        throw new Error(`Failed to fetch deliveries: ${response.statusText}`);
      }
      return response.json();
    },
  });

  // Fetch customers data to get customer names
  const { data: customersData = { customers: [] } } = useQuery({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers");
      if (!response.ok) throw new Error("Failed to fetch customers");
      return response.json();
    },
  });

  const customers = customersData.customers || [];

  // Handle URL parameters for invoice viewing
  useEffect(() => {
    const invoiceId = searchParams.get('invoice');
    if (invoiceId && invoices) {
      const invoice = invoices.find((inv: any) => inv.id === invoiceId);
      if (invoice) {
        setSelectedInvoice(invoice);
      }
    }
  }, [searchParams, invoices]);

  // Dialog state
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [deliverySearch, setDeliverySearch] = useState("");
  const [invoiceType, setInvoiceType] = useState("Standard");
  const [deliveryFilter, setDeliveryFilter] = useState("all"); // "all", "not-created", "created"
  // Partial delivery invoice state
  const [selectedDeliveryForInvoice, setSelectedDeliveryForInvoice] = useState<any>(null);
  const [selectedDeliveryItems, setSelectedDeliveryItems] = useState<Record<string, boolean>>({});
  const [showPartialInvoiceDialog, setShowPartialInvoiceDialog] = useState(false);

  // Fetch delivery items for selected delivery
  const { data: deliveryItems = [], isLoading: isLoadingDeliveryItems } = useQuery({
    queryKey: ["/api/deliveries", selectedDeliveryForInvoice?.id, "items"],
    enabled: !!selectedDeliveryForInvoice?.id,
    queryFn: async () => {
      const response = await fetch(`/api/deliveries/${selectedDeliveryForInvoice.id}/items`);
      if (!response.ok) throw new Error("Failed to fetch delivery items");
      return response.json();
    },
  });

  const createInvoice = useMutation({
    mutationFn: async ({ deliveryId, invoiceType, selectedItems }: { deliveryId: string; invoiceType: string; selectedItems?: string[] }) => {
      // Use dedicated generation endpoint for consistency with backend route
      const response = await apiRequest("POST", "/api/invoices/generate-from-delivery", { 
        deliveryId, 
        invoiceType,
        selectedDeliveryItemIds: selectedItems 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Success",
        description: "Invoice generated successfully",
      });
      setSelectedDelivery(null);
      setSelectedDeliveryForInvoice(null);
      setSelectedDeliveryItems({});
      setShowGenerateDialog(false);
      setShowPartialInvoiceDialog(false);
    },
    onError: (err: any) => {
      console.error("Generate invoice error", err);
      toast({
        title: "Error",
        description: "Failed to generate invoice",
        variant: "destructive",
      });
    },
  });

  const updateInvoiceStatus = useMutation({
    mutationFn: async ({ id, status, paidAmount }: { id: string; status: string; paidAmount?: number }) => {
      const updateData: any = { status };
      if (paidAmount !== undefined) {
        // Convert number to string for decimal field
        updateData.paidAmount = paidAmount.toFixed(2);
      }
      const response = await apiRequest("PUT", `/api/invoices/${id}`, updateData);
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      const message = variables.paidAmount !== undefined 
        ? `Invoice marked as paid. Paid amount: ${formatCurrency(variables.paidAmount)}`
        : "Invoice status updated successfully";
      toast({
        title: "Success",
        description: message,
      });
    },
    onError: (error: any) => {
      console.error("Error updating invoice:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update invoice status",
        variant: "destructive",
      });
    },
  });

  // Remove alternate mutation, use only main mutation for proforma

  const downloadInvoicePDF = async (invoiceId: string, invoiceNumber: string, invoiceType: string = 'Standard') => {
    try {
      // Show loading state
      const isProforma = invoiceType === 'Proforma';
      toast({
        title: "Generating PDF",
        description: `Creating comprehensive ${isProforma ? 'proforma' : ''} invoice with material specifications...`,
      });

      // Pass invoiceType as query param for backend compatibility
      const response = await fetch(`/api/invoices/${invoiceId}/pdf?invoiceType=${encodeURIComponent(invoiceType)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to generate PDF' }));
        throw new Error(errorData.message || 'Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filePrefix = isProforma ? 'Golden-Tag-Proforma' : 'Golden-Tag-Invoice';
      a.download = `${filePrefix}-${invoiceNumber}-${new Date().toISOString().split('T')[0]}.pdf`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      toast({
        title: "Success",
        description: `Comprehensive ${isProforma ? 'proforma' : ''} invoice PDF downloaded successfully with all material specifications and company details`,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  const viewInvoicePDF = async (invoiceId: string, invoiceNumber: string, invoiceType: string = 'Standard') => {
    try {
      // Show loading state
      const isProforma = invoiceType === 'Proforma';
      console.log('Viewing invoice PDF:', { invoiceId, invoiceNumber, invoiceType, isProforma });
      
      toast({
        title: "Opening PDF",
        description: `Opening ${isProforma ? 'proforma' : ''} invoice in new tab...`,
      });

      // Check if invoiceId is valid
      if (!invoiceId || invoiceId === 'undefined' || invoiceId === 'null') {
        throw new Error('Invalid invoice ID');
      }

      const apiUrl = `/api/invoices/${invoiceId}/pdf?invoiceType=${encodeURIComponent(invoiceType)}`;
      console.log('Making request to:', apiUrl);

      // Pass invoiceType as query param for backend compatibility
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });

      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.error('API Error Response:', errorData);
        } catch (jsonError) {
          console.error('Failed to parse error response as JSON:', jsonError);
          // Try to get text response
          try {
            const errorText = await response.text();
            console.error('Error response text:', errorText);
            errorMessage = errorText || errorMessage;
          } catch (textError) {
            console.error('Failed to get error response as text:', textError);
          }
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      console.log('PDF blob size:', blob.size, 'bytes');
      
      if (blob.size === 0) {
        throw new Error('Received empty PDF file');
      }

      const url = window.URL.createObjectURL(blob);
      
      // Open PDF in new tab
      const newWindow = window.open(url, '_blank');
      
      if (!newWindow) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Cleanup URL after a delay to allow the new tab to load
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 10000); // 10 seconds should be enough for the PDF to load

      toast({
        title: "Success",
        description: `${isProforma ? 'Proforma' : 'Invoice'} PDF opened in new tab`,
      });
    } catch (error) {
      console.error("Error opening PDF:", error);
      
      let errorMessage = "Failed to open PDF";
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = "Network error: Unable to connect to server. Please check your connection and try again.";
        } else if (error.message.includes('Invalid invoice ID')) {
          errorMessage = "Invalid invoice ID. Please refresh the page and try again.";
        } else if (error.message.includes('empty PDF')) {
          errorMessage = "PDF generation failed: Received empty file. Please try again.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };


  const exportInvoices = (format: 'csv' | 'excel') => {
    if (!filteredInvoices || filteredInvoices.length === 0) {
      toast({
        title: "No Data",
        description: "No invoices to export",
        variant: "destructive",
      });
      return;
    }

    try {
      // Prepare data for export
      const exportData = filteredInvoices.map((invoice: any) => ({
        'Invoice Number': invoice.invoiceNumber || '',
        'Customer Name': invoice.customer?.name || '',
        'Customer Type': invoice.customer?.customerType || '',
        'Sales Order': invoice.salesOrder?.orderNumber || '',
        'Status': invoice.status || '',
        'Invoice Amount': invoice.totalAmount || 0,
        'Paid Amount': invoice.paidAmount || 0,
        'Due Date': invoice.dueDate ? formatDate(invoice.dueDate) : '',
        'Invoice Date': invoice.invoiceDate ? formatDate(invoice.invoiceDate) : '',
        'Subtotal': invoice.subtotal || 0,
        'Tax Amount': invoice.taxAmount || 0,
        'Notes': invoice.notes || ''
      }));

      if (format === 'csv') {
        // Convert to CSV
        const headers = Object.keys(exportData[0]);
        const csvContent = [
          headers.join(','),
          ...exportData.map((row: Record<string, unknown>) =>
            headers.map(header => {
              const value = row[header];
              // Escape commas, quotes, and newlines in CSV
              if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
              }
              return value ?? "";
            }).join(',')
          )
        ].join('\n');

        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoices-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else if (format === 'excel') {
        // For Excel, we'll create a simple CSV that Excel can open
        // In a real application, you might want to use a library like xlsx
        const headers = Object.keys(exportData[0]);
        const csvContent = [
          headers.join('\t'),
          ...exportData.map((row: Record<string, unknown>) =>
            headers.map(header => {
              const value = row[header];
              // For Excel, tab-separated values are preferred
              if (typeof value === 'string' && (value.includes('\t') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
              }
              return value ?? "";
            }).join('\t')
          )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoices-export-${new Date().toISOString().split('T')[0]}.xls`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      toast({
        title: "Success",
        description: `Invoices exported as ${format.toUpperCase()} successfully`,
      });
    } catch (error) {
      console.error("Error exporting invoices:", error);
      toast({
        title: "Error",
        description: "Failed to export invoices",
        variant: "destructive",
      });
    }
  };

  // Filter for completed deliveries ready for invoicing
  const enrichedDeliveries = deliveries?.map((delivery: any) => {
    if (delivery.salesOrder?.customerId) {
      const customer = customers.find((c: any) => c.id === delivery.salesOrder.customerId);
      return {
        ...delivery,
        salesOrder: {
          ...delivery.salesOrder,
        customer: customer ? {
          ...customer,
          name: customer.name || 'No Customer'
        } : delivery.salesOrder.customer || { name: 'No Customer', customerType: '-' }
        }
      };
    }
    return delivery;
  });

  // All completed deliveries with invoice status
  const allCompletedDeliveries = enrichedDeliveries?.filter((delivery: any) => 
    delivery.status === "Complete"
  ).map((delivery: any) => {
    const existingInvoice = invoices?.find((inv: any) => inv.salesOrderId === delivery.salesOrderId);
    return {
      ...delivery,
      hasInvoice: !!existingInvoice,
      existingInvoice: existingInvoice,
      invoiceStatus: existingInvoice?.status || null
    };
  });

  // Separate deliveries with and without invoices
  const completedDeliveries = allCompletedDeliveries?.filter((delivery: any) => !delivery.hasInvoice) || [];
  const deliveriesWithInvoices = allCompletedDeliveries?.filter((delivery: any) => delivery.hasInvoice) || [];

  // Enrich invoices with customer names from customers API
  const enrichedInvoices = invoices?.map((invoice: any) => {
    const customer = customers.find((c: any) => c.id === invoice.customerId);
    return {
      ...invoice,
      customer: customer ? {
        ...customer,
        name: customer.name || 'No Customer'
      } : invoice.customer || { name: 'No Customer', customerType: '-' }
    };
  });


  const filteredInvoices = enrichedInvoices?.filter((invoice: any) => {
    const matchesSearch = invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    const matchesType = typeFilter === "all" || invoice.invoiceType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  }) || [];
  // Pagination logic
  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Fetch invoice items for selected invoice (to show item name / description)
  // Prefer delivery note items for richer item details; fallback to invoice items
  const { data: selectedInvoiceDeliveryItems = [], isLoading: isLoadingSelectedInvoiceDeliveryItems } = useQuery({
    queryKey: ["/api/deliveries", selectedInvoice?.deliveryId || selectedInvoice?.deliveryNoteId || selectedInvoice?.delivery?.id, "items"],
    enabled: !!(selectedInvoice?.deliveryId || selectedInvoice?.deliveryNoteId || selectedInvoice?.delivery?.id),
    queryFn: async () => {
      const id = selectedInvoice?.deliveryId || selectedInvoice?.deliveryNoteId || selectedInvoice?.delivery?.id;
      const res = await fetch(`/api/deliveries/${id}/items`);
      if (!res.ok) throw new Error("Failed to fetch delivery items");
      return res.json();
    },
  });

  const { data: selectedInvoiceItems = [], isLoading: isLoadingInvoiceItems, error: invoiceItemsError } = useQuery({
    queryKey: ["/api/invoices", selectedInvoice?.id, "items"],
    queryFn: async () => {
      if (!selectedInvoice?.id) return [];
      const response = await fetch(`/api/invoices/${selectedInvoice.id}/items`);
      if (!response.ok) throw new Error("Failed to fetch invoice items");
      return response.json();
    },
    enabled: !!selectedInvoice?.id,
  });

  // Fetch Sales Order items for the selected invoice to ensure original details
  // Resolve Sales Order ID from multiple sources (invoice, delivery ref, deliveries list)
  let salesOrderIdForInvoice = selectedInvoice?.salesOrderId || selectedInvoice?.delivery?.salesOrderId || selectedDelivery?.salesOrderId as string | undefined;
  if (!salesOrderIdForInvoice) {
    const deliveryId = selectedInvoice?.deliveryId || selectedInvoice?.deliveryNoteId || selectedInvoice?.delivery?.id;
    if (deliveryId && Array.isArray(deliveries)) {
      const matchedDelivery: any = (deliveries as any[]).find((d: any) => d.id === deliveryId);
      salesOrderIdForInvoice = matchedDelivery?.salesOrderId || matchedDelivery?.salesOrder?.id;
    }
  }
  const { data: salesOrderItemsForInvoice = [] } = useQuery({
    queryKey: ["/api/sales-orders", salesOrderIdForInvoice, "items"],
    enabled: !!salesOrderIdForInvoice,
    queryFn: async () => {
      const res = await fetch(`/api/sales-orders/${salesOrderIdForInvoice}/items`);
      if (!res.ok) throw new Error("Failed to fetch sales order items");
      return res.json();
    },
  });

  // Base list comes from delivery items if present, else invoice items
  const baseItemsForDisplay = (selectedInvoiceDeliveryItems && selectedInvoiceDeliveryItems.length > 0) ? selectedInvoiceDeliveryItems : selectedInvoiceItems;
  
  // Enrich with Sales Order item details (description, unit price, quantity)
  const itemsForDisplay = (baseItemsForDisplay || []).map((it: any, idx: number) => {
    let match = null as any;
    
    // Try to find matching sales order item
    if (it.salesOrderItemId && Array.isArray(salesOrderItemsForInvoice)) {
      match = salesOrderItemsForInvoice.find((s: any) => s.id === it.salesOrderItemId);
    }
    if (!match && it.lineNumber && Array.isArray(salesOrderItemsForInvoice)) {
      match = salesOrderItemsForInvoice.find((s: any) => s.lineNumber === it.lineNumber);
    }
    if (!match && it.itemId && Array.isArray(salesOrderItemsForInvoice)) {
      match = salesOrderItemsForInvoice.find((s: any) => s.itemId === it.itemId);
    }
    // Fallback to index position if still not found
    if (!match && Array.isArray(salesOrderItemsForInvoice) && salesOrderItemsForInvoice[idx]) {
      match = salesOrderItemsForInvoice[idx];
    }
    
    // Use invoice item values first, then fallback to sales order values
    const quantity = it.quantity ?? it.deliveredQuantity ?? it.pickedQuantity ?? it.orderedQuantity ?? match?.quantity ?? 0;
    const unitPrice = (it.unitPrice != null && it.unitPrice !== undefined) ? it.unitPrice : (match?.unitPrice ?? 0);
    const totalPrice = (it.totalPrice != null && it.totalPrice !== undefined)
      ? it.totalPrice
      : (unitPrice != null && quantity != null) ? Number(unitPrice) * Number(quantity) : (match?.totalPrice ?? 0);
    
    const isGeneric = (txt?: string) => {
      if (!txt) return true;
      const v = String(txt).trim().toLowerCase();
      return v === 'generic item' || v === 'item from sales order' || v === 'delivery item' || v === 'item' || v === '';
    };
    
    const resolvedDescription = isGeneric(it.description)
      ? (match?.description || it.itemDescription || it.productName || `Item ${idx + 1}`)
      : (it.description || match?.description || it.itemDescription || it.productName || `Item ${idx + 1}`);
    
    return {
      ...it,
      id: it.id || `item-${idx}`,
      lineNumber: it.lineNumber || idx + 1,
      description: resolvedDescription,
      supplierCode: it.supplierCode || match?.supplierCode || '',
      barcode: it.barcode || match?.barcode || '',
      quantity: Number(quantity) || 0,
      unitPrice: Number(unitPrice) || 0,
      totalPrice: Number(totalPrice) || 0,
    };
  });

  const columns: Column<any>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice ID",
      render: (value: string) => (
        <span className="font-mono text-sm text-blue-600 font-medium">{value}</span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (_: any, invoice: any) => {
        const customer = invoice.customer;
        if (!customer || !customer.name) {
          return (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400">No Customer</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-500" />
            <div className="flex flex-col">
              <span className="font-medium text-gray-900">{customer.name}</span>
              {customer.customerType && (
                <span className="text-xs text-gray-500">{customer.customerType}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "salesOrderNumber",
      header: "Sales Order",
      render: (_, invoice: any) => {
        // Try to get order number from salesOrder, fallback to searching deliveries if missing
        let orderNumber = invoice.salesOrder?.orderNumber || invoice.salesOrderNumber || "";
        if (!orderNumber && invoice.salesOrderId && Array.isArray(deliveries)) {
          const delivery = deliveries.find((d: any) => d.salesOrderId === invoice.salesOrderId);
          orderNumber = delivery?.salesOrder?.orderNumber || "N/A";
        }
        return (
          <span className="font-mono text-sm text-blue-600 font-semibold">
            {orderNumber || "N/A"}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
        render: (value: string) => (
          value === "Draft"
            ? <Badge variant="outline" className="border-gray-400 text-gray-600 bg-gray-50">{value}</Badge>
            : <Badge variant="outline" className={getStatusColor(value)}>{value}</Badge>
        ),
    },
    {
      key: "totalAmount",
      header: "Invoice Amount",
      render: (value: number) => value ? formatCurrency(value) : "-",
      className: "text-right",
    },
    {
      key: "paidAmount",
      header: "Paid Amount",
      render: (value: number) => value ? formatCurrency(value) : formatCurrency(0),
      className: "text-right",
    },
    // {
    //   key: "dueDate",
    //   header: "Due Date",
    //   render: (value: string) => {
    //     if (!value) return "-";
    //     const isOverdue = new Date(value) < new Date();
    //     return (
    //       <div className={isOverdue ? "text-red-600 font-medium" : ""}>
    //         {formatDate(value)}
    //         {isOverdue && <span className="ml-1 text-xs">(Overdue)</span>}
    //       </div>
    //     );
    //   },
    // },
    {
      key: "invoiceDate",
      header: "Invoice Date",
      render: (value: string) => formatDate(value),
    },
    {
      key: "invoiceType",
      header: "Type",
      render: (value: string) => (
        <Badge 
          variant="outline" 
          className={
            value === "Proforma" 
              ? "bg-purple-100 text-purple-800 border-purple-300 font-semibold" 
              : value === "Standard"
              ? "bg-blue-100 text-blue-800 border-blue-300"
              : "bg-gray-100 text-gray-800 border-gray-300"
          }
        >
          {value === "Proforma" ? "Proforma" : value || "Standard"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_, invoice: any) => (
        <div className="flex items-center space-x-2">
          {invoice.status === "Draft" && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                updateInvoiceStatus.mutate({ id: invoice.id, status: "Sent" });
              }}
              data-testid={`button-send-${invoice.id}`}
            >
              <Send className="h-4 w-4 mr-1" />
              Send
            </Button>
          )}
          {invoice.status === "Sent" && (
            <Button
              size="sm"
              variant="success"
              onClick={(e) => {
                e.stopPropagation();
                updateInvoiceStatus.mutate({ 
                  id: invoice.id, 
                  status: "Paid",
                  paidAmount: Number(invoice.totalAmount) || 0
                });
              }}
              data-testid={`button-mark-paid-${invoice.id}`}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Mark Paid
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              downloadInvoicePDF(invoice.id, invoice.invoiceNumber, invoice.invoiceType);
            }}
            data-testid={`button-download-${invoice.id}`}
            title={`Download ${invoice.invoiceType === 'Proforma' ? 'Proforma' : 'Standard'} Invoice PDF with Material Specs`}
            className="text-black hover:text-black hover:bg-gray-50"
          >
            <Download className="h-4 w-4 text-black" />
          </Button>
          <EmailSendButton
            documentType="invoice"
            documentId={invoice.id}
            documentNumber={invoice.invoiceNumber}
            customerEmail={invoice.customer?.email}
            customerName={invoice.customer?.customerName || invoice.customer?.name}
            variant="ghost"
            size="sm"
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedInvoice(invoice);
            }}
            data-testid={`button-view-${invoice.id}`}
            title="View Details"
          >
            <FileText className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const invoiceStats = {
    draft: invoices?.filter((inv: any) => inv.status === "Draft").length || 0,
    sent: invoices?.filter((inv: any) => inv.status === "Sent").length || 0,
    paid: invoices?.filter((inv: any) => inv.status === "Paid").length || 0,
    overdue: invoices?.filter((inv: any) => {
      return inv.status === "Sent" && inv.dueDate && new Date(inv.dueDate) < new Date();
    }).length || 0,
    totalRevenue: invoices?.filter((inv: any) => inv.status === "Paid")
      .reduce((sum: number, inv: any) => {
        const amt = Number(inv.totalAmount);
        return sum + (isNaN(amt) ? 0 : amt);
      }, 0) || 0,
  };

  // Ref for scrolling to deliveries section
  const deliveriesSectionRef = useState<any>(null);

  const handleReadyForInvoiceClick = () => {
    if (deliveriesSectionRef[0] && deliveriesSectionRef[0].scrollIntoView) {
      deliveriesSectionRef[0].scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div>
      {/* Page Header - Card Style */}
      <div className="mb-6">
        <Card className="rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                <Receipt className="h-8 w-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent" data-testid="text-page-title">
                    Invoicing
                  </h2>
                </div>
                <p className="text-muted-foreground text-lg">
                  Step 10: Generate and manage customer invoices with multi-currency support
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="font-medium">Invoice Generation</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Invoices: {Array.isArray(invoices) ? invoices.length : 0}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3" style={{ visibility: 'visible' }}>
              <Button
                variant="outline"
                onClick={() => setShowGenerateDialog(true)}
                data-testid="button-open-generate-invoice"
                className="flex items-center gap-2 "
              >
                <Plus className="h-4 w-4" /> 
                Generate Invoice
              </Button>
              <Button
                variant="success"
                className="flex items-center px-4 py-2 gap-2"
                data-testid="badge-ready-for-invoice"
                onClick={handleReadyForInvoiceClick}
                style={{ cursor: "pointer" }}
              >
                <DollarSign className="h-4 w-4" />
                {completedDeliveries?.length || 0} Ready for Invoice
              </Button>
            </div>
          </div>
        </Card>
      </div>



      {/* Invoice Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mt-1">
                <Edit className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-bold">Draft Invoices</p>
                <p className="text-2xl font-bold text-gray-600" data-testid="stat-draft-invoices">
                  {invoiceStats.draft}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mt-1">
                <Plane className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-bold">Sent Invoices</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="stat-sent-invoices">
                  {invoiceStats.sent}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mt-1">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-bold">Paid Invoices</p>
                <p className="text-2xl font-bold text-green-600" data-testid="stat-paid-invoices">
                  {invoiceStats.paid}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mt-1">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-bold">Overdue</p>
                <p className="text-2xl font-bold text-red-600" data-testid="stat-overdue-invoices">
                  {invoiceStats.overdue}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mt-1">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-bold">Total Revenue</p>
                <p
                  className="text-2xl font-bold text-green-600 whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px] md:max-w-[140px] lg:max-w-[180px]"
                  data-testid="stat-total-revenue"
                  title={formatCurrency(invoiceStats.totalRevenue)}
                >
                  {formatCurrencyCompact(invoiceStats.totalRevenue).short}
                </p>
                <div className="mt-2 text-sm text-gray-600">
                  From paid invoices
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Invoices</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 pl-10 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-md shadow-none"
                  data-testid="input-search-invoices"
                />
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Sent">Sent</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Proforma">Proforma</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" data-testid="button-filter">
                <Filter className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" data-testid="button-export">
                    <FileDown className="h-4 w-4 mr-2" />
                    Export
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportInvoices('csv')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportInvoices('excel')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export as Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            <DataTable
              data={paginatedInvoices}
              columns={columns}
              isLoading={isLoading}
              emptyMessage="No invoices found. Invoices are created from completed deliveries."
              onRowClick={(invoice) => {
                setSelectedInvoice(invoice);
              }}
            />
            {/* Pagination Controls */}
            {filteredInvoices.length > pageSize && (
              <div className="flex justify-center items-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="mx-2 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Details Dialog - Enhanced with Material Information */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>Invoice Details - {selectedInvoice?.invoiceNumber}</span>
              <Badge variant="outline" className={getStatusColor(selectedInvoice?.status || '')}>
                {selectedInvoice?.status}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Header Information */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Invoice Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Number:</span>
                      <span className="font-mono font-medium">{selectedInvoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium">{selectedInvoice.invoiceType || 'Final'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Currency:</span>
                      <span className="font-medium">{selectedInvoice.currency || 'BHD'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span>{formatDate(selectedInvoice.invoiceDate)}</span>
                    </div>
                    {/* <div className="flex justify-between">
                      <span className="text-gray-600">Due Date:</span>
                      <span>{selectedInvoice.dueDate ? formatDate(selectedInvoice.dueDate) : "Upon Receipt"}</span>
                    </div> */}
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-3 flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Customer Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <p className="font-medium">{selectedInvoice.customer?.name}</p>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium">{selectedInvoice.customer?.customerType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Classification:</span>
                      <span className="font-medium">{selectedInvoice.customer?.classification}</span>
                    </div>
                    {selectedInvoice.customer?.email && (
                      <div>
                        <span className="text-gray-600">Email:</span>
                        <p className="text-blue-600">{selectedInvoice.customer.email}</p>
                      </div>
                    )}
                    {selectedInvoice.customer?.phone && (
                      <div>
                        <span className="text-gray-600">Phone:</span>
                        <p>{selectedInvoice.customer.phone}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200 shadow-sm">
                  <h4 className="font-semibold text-blue-900 mb-6 flex items-center text-lg">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Financial Summary
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <p className="text-sm font-medium text-gray-600 mb-2">Subtotal (Before Tax)</p>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(Number(selectedInvoice.subtotal || 0))}</p>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <p className="text-sm font-medium text-gray-600 mb-2">VAT Amount (10%)</p>
                        <p className="text-xl font-bold text-red-600">{formatCurrency(Number(selectedInvoice.taxAmount || 0))}</p>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-xl text-white shadow-lg">
                      <div className="flex justify-between items-center mb-3">
                        <p className="text-lg font-semibold">Total Amount (Including VAT)</p>
                        <p className="text-3xl font-bold">{formatCurrency(Number(selectedInvoice.totalAmount || 0))}</p>
                      </div>
                      <div className="text-sm text-blue-100 bg-blue-700 bg-opacity-30 p-3 rounded-lg">
                        <div className="flex justify-between">
                          <span>Subtotal: {formatCurrency(Number(selectedInvoice.subtotal || 0))}</span>
                          <span>+</span>
                          <span>VAT: {formatCurrency(Number(selectedInvoice.taxAmount || 0))}</span>
                          <span>=</span>
                          <span className="font-semibold">{formatCurrency(Number(selectedInvoice.totalAmount || 0))}</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-green-700">Paid Amount</span>
                          <span className="text-lg font-bold text-green-600">{formatCurrency(Number(selectedInvoice.paidAmount || 0))}</span>
                        </div>
                      </div>
                      {(Number(selectedInvoice.totalAmount || 0)) > (Number(selectedInvoice.paidAmount || 0)) && (
                        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-red-700">Outstanding Balance</span>
                            <span className="text-lg font-bold text-red-600">{formatCurrency(Number(selectedInvoice.totalAmount || 0) - Number(selectedInvoice.paidAmount || 0))}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Material Specifications & Items */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Material Specifications & Items
                </h4>
                <div className="text-sm text-gray-600 mb-3">
                  This invoice includes detailed material specifications, supplier codes, barcodes, and comprehensive item information as required for business operations.
                </div>
                
                {/* Debug Information */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
                    <div className="font-semibold text-yellow-800 mb-2">Debug Information:</div>
                    <div className="space-y-1 text-yellow-700">
                      <div>Invoice Items: {selectedInvoiceItems?.length || 0}</div>
                      <div>Delivery Items: {selectedInvoiceDeliveryItems?.length || 0}</div>
                      <div>Sales Order Items: {salesOrderItemsForInvoice?.length || 0}</div>
                      <div>Display Items: {itemsForDisplay?.length || 0}</div>
                      <div>Invoice ID: {selectedInvoice?.id}</div>
                      <div>Delivery ID: {selectedInvoice?.deliveryId || selectedInvoice?.deliveryNoteId || selectedInvoice?.delivery?.id}</div>
                      <div>Sales Order ID: {salesOrderIdForInvoice}</div>
                    </div>
                  </div>
                )}
                {/* Invoice Items Table */}
                <div className="overflow-x-auto mb-4 border rounded-md bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Line</th>
                        <th className="px-3 py-2 text-left font-medium">Item Name</th>
                        <th className="px-3 py-2 text-left font-medium">Supplier Code</th>
                        <th className="px-3 py-2 text-left font-medium">Barcode</th>
                        <th className="px-3 py-2 text-right font-medium">Qty</th>
                        <th className="px-3 py-2 text-right font-medium">Unit Price</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingInvoiceItems && (
                        <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-500">Loading items...</td></tr>
                      )}
                      {!isLoadingInvoiceItems && invoiceItemsError && (
                        <tr><td colSpan={7} className="px-3 py-4 text-center text-red-600">Failed to load items</td></tr>
                      )}
                      {!isLoadingInvoiceItems && !invoiceItemsError && itemsForDisplay.length === 0 && (
                        <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <span>No items have been added to this invoice yet.</span>
                            <span className="text-xs text-gray-400">This may be due to missing delivery items or data synchronization issues.</span>
                          </div>
                        </td></tr>
                      )}
                      {!isLoadingInvoiceItems && !invoiceItemsError && itemsForDisplay.map((item: any, index: number) => {
                        const primaryLabel = item.description || item.itemDescription || item.productName || `Item ${index + 1}`;
                        const secondaryLabel = item.specialInstructions || item.pickingNotes || item.qualityNotes || item.notes;
                        const specs = item.specifications || item.itemDetails?.specifications || item.pickingNotes || item.qualityNotes || item.notes;
                        return (
                          <tr key={item.id || `item-${index}`} className="border-t hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-xs text-gray-600">{item.lineNumber || index + 1}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">{primaryLabel}</span>
                              {secondaryLabel && <span className="text-xs text-gray-500">{secondaryLabel}</span>}
                              {specs && specs !== secondaryLabel && <span className="text-[11px] text-gray-500">{specs}</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-700 font-mono text-xs">{item.supplierCode || item.item?.supplierCode || '-'}</td>
                          <td className="px-3 py-2 text-gray-700 font-mono text-xs">{item.barcode || item.item?.barcode || '-'}</td>
                          <td className="px-3 py-2 text-right">{Number(item.quantity || 0)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(Number(item.unitPrice || 0))}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(Number(item.totalPrice || 0))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-white p-3 rounded border">
                    <span className="text-xs text-gray-500">Document Features</span>
                    <ul className="text-sm mt-1 space-y-1">
                      <li>✓ Complete company branding</li>
                      <li>✓ Supplier codes & barcodes</li>
                      <li>✓ Material specifications</li>
                      <li>✓ Multi-currency support</li>
                    </ul>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <span className="text-xs text-gray-500">Business Information</span>
                    <ul className="text-sm mt-1 space-y-1">
                      <li>✓ Golden Tag WLL details</li>
                      <li>✓ Banking information</li>
                      <li>✓ Legal registration numbers</li>
                      <li>✓ Terms & conditions</li>
                    </ul>
                  </div>
                  <div className="bg-white p-3 rounded border">
                    <span className="text-xs text-gray-500">Customer Requirements</span>
                    <ul className="text-sm mt-1 space-y-1">
                      <li>✓ Detailed item descriptions</li>
                      <li>✓ Quantity & pricing</li>
                      <li>✓ Tax calculations</li>
                      <li>✓ Payment tracking</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              {selectedInvoice.paymentTerms && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Payment Terms</h4>
                  <p className="text-sm text-gray-700">{selectedInvoice.paymentTerms}</p>
                </div>
              )}

              {/* Notes */}
              {selectedInvoice.notes && (
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-700">{selectedInvoice.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="space-x-2">
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => downloadInvoicePDF(selectedInvoice.id, selectedInvoice.invoiceNumber)}
                    data-testid="button-download-pdf"
                    className="flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Comprehensive PDF</span>
                  </Button>
                  <EmailSendButton
                    documentType="invoice"
                    documentId={selectedInvoice.id}
                    documentNumber={selectedInvoice.invoiceNumber}
                    customerEmail={selectedInvoice.customer?.email}
                    customerName={selectedInvoice.customer?.customerName || selectedInvoice.customer?.name}
                    variant="outline"
                    className="flex items-center space-x-2"
                    onSuccess={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
                    }}
                  />
                  <Button
                    onClick={() => setSelectedInvoice(null)}
                    data-testid="button-close-details"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Generate Invoice Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {invoiceType === "Proforma" ? (
                <>
                  <FileText className="h-5 w-5 text-purple-600" />
                  Generate Proforma Invoice from Delivery
                </>
              ) : (
                "Generate Invoice from Delivery"
              )}
            </DialogTitle>
            <p className="text-sm text-gray-600">
              {invoiceType === "Proforma" 
                ? "Generate proforma invoices from completed deliveries for preliminary billing"
                : "View and generate invoices from completed deliveries"
              }
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Search deliveries..."
                value={deliverySearch}
                onChange={(e) => setDeliverySearch(e.target.value)}
                data-testid="input-search-deliveries"
                className="flex-1"
              />
              <Select value={invoiceType} onValueChange={setInvoiceType}>
                <SelectTrigger className="w-48" data-testid="select-invoice-type">
                  <SelectValue placeholder="Invoice Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Proforma">Proforma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Filter Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setDeliveryFilter("all")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  deliveryFilter === "all" 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All Deliveries ({allCompletedDeliveries?.length || 0})
              </button>
              <button
                onClick={() => setDeliveryFilter("not-created")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  deliveryFilter === "not-created" 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                No Invoice ({completedDeliveries?.length || 0})
              </button>
              <button
                onClick={() => setDeliveryFilter("created")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  deliveryFilter === "created" 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Has Invoice ({deliveriesWithInvoices?.length || 0})
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto border rounded-md divide-y" data-testid="list-deliveries-for-invoice">
              {(() => {
                // Filter deliveries based on the selected filter
                let filteredDeliveries = [];
                if (deliveryFilter === "not-created") {
                  filteredDeliveries = completedDeliveries || [];
                } else if (deliveryFilter === "created") {
                  filteredDeliveries = deliveriesWithInvoices || [];
                } else {
                  filteredDeliveries = allCompletedDeliveries || [];
                }

                // Apply search filter
                const searchFilteredDeliveries = filteredDeliveries.filter((d: any) => {
                  if (!deliverySearch) return true;
                  const term = deliverySearch.toLowerCase();
                  return (
                    d.deliveryNumber?.toLowerCase().includes(term) ||
                    d.salesOrder?.orderNumber?.toLowerCase().includes(term) ||
                    d.salesOrder?.customer?.name?.toLowerCase().includes(term)
                  );
                });

                return searchFilteredDeliveries.map((delivery: any) => (
                  <div key={delivery.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {delivery.deliveryNumber} / {delivery.salesOrder?.orderNumber}
                        </p>
                        {delivery.hasInvoice && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            delivery.invoiceStatus === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                            delivery.invoiceStatus === 'Sent' ? 'bg-blue-100 text-blue-800' :
                            delivery.invoiceStatus === 'Paid' ? 'bg-green-100 text-green-800' :
                            delivery.invoiceStatus === 'Overdue' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {delivery.invoiceStatus || 'Invoice Created'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">
                        {delivery.salesOrder?.customer?.name} · Value {formatCurrency(delivery.salesOrder?.totalAmount)}
                      </p>
                      {delivery.hasInvoice && delivery.existingInvoice && (
                        <p className="text-xs text-blue-600 mt-1">
                          Invoice: {delivery.existingInvoice.invoiceNumber}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!delivery.hasInvoice ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedDeliveryForInvoice(delivery);
                              setSelectedDeliveryItems({});
                              setShowPartialInvoiceDialog(true);
                            }}
                            disabled={createInvoice.isPending}
                            data-testid={`button-partial-invoice-${delivery.id}`}
                            className={invoiceType === "Proforma" ? "border-purple-300 text-purple-700 hover:bg-purple-50" : ""}
                          >
                            {invoiceType === "Proforma" ? "Partial Proforma" : "Partial"}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => createInvoice.mutate({ deliveryId: delivery.id, invoiceType, selectedItems: undefined })}
                            disabled={createInvoice.isPending}
                            data-testid={`button-generate-invoice-${delivery.id}`}
                            className={invoiceType === "Proforma" ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}
                          >
                            {createInvoice.isPending ? "Generating..." : invoiceType === "Proforma" ? "Generate Proforma" : "Full"}
                          </Button>
                        </>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Open invoice PDF in new tab
                              console.log('Delivery existingInvoice data:', delivery.existingInvoice);
                              console.log('Invoice ID:', delivery.existingInvoice.id);
                              console.log('Invoice Number:', delivery.existingInvoice.invoiceNumber);
                              console.log('Invoice Type:', delivery.existingInvoice.invoiceType);
                              viewInvoicePDF(delivery.existingInvoice.id, delivery.existingInvoice.invoiceNumber, delivery.existingInvoice.invoiceType || 'Standard');
                            }}
                            data-testid={`button-view-invoice-${delivery.id}`}
                          >
                            View Invoice
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => createInvoice.mutate({ deliveryId: delivery.id, invoiceType, selectedItems: undefined })}
                            disabled={createInvoice.isPending}
                            data-testid={`button-regenerate-invoice-${delivery.id}`}
                            className="text-xs"
                          >
                            Regenerate
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ));
              })()}
              {(() => {
                let filteredDeliveries = [];
                if (deliveryFilter === "not-created") {
                  filteredDeliveries = completedDeliveries || [];
                } else if (deliveryFilter === "created") {
                  filteredDeliveries = deliveriesWithInvoices || [];
                } else {
                  filteredDeliveries = allCompletedDeliveries || [];
                }

                const searchFilteredDeliveries = filteredDeliveries.filter((d: any) => {
                  if (!deliverySearch) return true;
                  const term = deliverySearch.toLowerCase();
                  return (
                    d.deliveryNumber?.toLowerCase().includes(term) ||
                    d.salesOrder?.orderNumber?.toLowerCase().includes(term) ||
                    d.salesOrder?.customer?.name?.toLowerCase().includes(term)
                  );
                });

                if (searchFilteredDeliveries.length === 0) {
                  return (
                    <div className="p-4 text-sm text-gray-500" data-testid="empty-no-deliveries">
                      {deliveryFilter === "not-created" ? "No deliveries without invoices found." :
                       deliveryFilter === "created" ? "No deliveries with invoices found." :
                       "No deliveries available for invoicing."}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowGenerateDialog(false)} data-testid="button-close-generate-dialog">Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Partial Invoice Generation Dialog */}
      <Dialog open={showPartialInvoiceDialog} onOpenChange={setShowPartialInvoiceDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Generate Partial Invoice from Delivery</DialogTitle>
            <p className="text-sm text-gray-600">
              Select specific items from delivery {selectedDeliveryForInvoice?.deliveryNumber} to include in the invoice
            </p>
          </DialogHeader>
          <div className="space-y-4">
            {isLoadingDeliveryItems ? (
              <div className="text-center py-4">Loading delivery items...</div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Delivery Type: <Badge variant="outline">{selectedDeliveryForInvoice?.deliveryType || 'Unknown'}</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {Object.values(selectedDeliveryItems).filter(Boolean).length} of {deliveryItems.length} items selected
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
                  {deliveryItems.map((item: any) => (
                    <div key={item.id} className="p-3 flex items-center space-x-3 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedDeliveryItems[item.id] || false}
                        onChange={(e) => {
                          setSelectedDeliveryItems(prev => ({
                            ...prev,
                            [item.id]: e.target.checked
                          }));
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.description || 'Item'}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Qty: {item.deliveredQuantity || item.pickedQuantity || item.orderedQuantity}</span>
                          <span>Price: {formatCurrency(item.unitPrice)}</span>
                          <span>Total: {formatCurrency(item.totalPrice)}</span>
                          {item.barcode && <span>Barcode: {item.barcode}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {deliveryItems.length === 0 && (
                    <div className="p-4 text-sm text-gray-500">No delivery items found.</div>
                  )}
                </div>
                <div className="flex justify-between">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowPartialInvoiceDialog(false);
                      setSelectedDeliveryForInvoice(null);
                      setSelectedDeliveryItems({});
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      const selectedItemIds = Object.entries(selectedDeliveryItems)
                        .filter(([_, selected]) => selected)
                        .map(([itemId, _]) => itemId);
                      
                      if (selectedItemIds.length === 0) {
                        toast({
                          title: "Error",
                          description: "Please select at least one item for the invoice",
                          variant: "destructive"
                        });
                        return;
                      }
                      
                      createInvoice.mutate({ 
                        deliveryId: selectedDeliveryForInvoice.id, 
                        invoiceType,
                        selectedItems: selectedItemIds
                      });
                    }}
                    disabled={createInvoice.isPending || Object.values(selectedDeliveryItems).filter(Boolean).length === 0}
                  >
                    {createInvoice.isPending ? "Generating..." : `Generate Invoice (${Object.values(selectedDeliveryItems).filter(Boolean).length} items)`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

