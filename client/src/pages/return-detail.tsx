import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Edit,
  Printer,
  Share2,
  Save,
  X,
  CheckCircle,
  Mail,
  Copy,
  RotateCcw,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReturnItem {
  id?: string;
  itemCode?: string;
  itemName?: string;
  itemDescription: string;
  quantity: number;
  quantityReturned?: number;
  unit?: string;
  unitCost: number;
  totalValue: number;
  totalCost?: number;
  lotBatchNumber?: string;
  expiryDate?: string;
  returnReason?: string;
  conditionNotes?: string;
}

interface ReturnReceipt {
  id: string;
  returnNumber: string;
  returnDate: string;
  goodsReceiptId: string;
  goodsReceiptNumber: string;
  supplierId: string;
  supplierName: string;
  supplierAddress: string;
  supplierContactPerson: string;
  returnReason: string;
  status: "Draft" | "Pending Approval" | "Approved" | "Processed" | "Cancelled";
  notes: string;
  totalValue: number;
  items: ReturnItem[];
  createdAt: string;
  updatedAt: string;
}

export default function ReturnDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [isEditMode, setIsEditMode] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [editedData, setEditedData] = useState<Partial<ReturnReceipt>>({});
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReturnItem | null>(null);
  const [itemFormData, setItemFormData] = useState<Partial<ReturnItem>>({
    itemDescription: '',
    quantity: 0,
    unitCost: 0,
    totalValue: 0,
    returnReason: '',
  });

  // Fetch return details
  const { data: returnData, isLoading, error, refetch } = useQuery({
    queryKey: ['return-receipt', id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/receipt-returns/${id}`);
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.message || 'Failed to fetch return details');
      }
      return json.data as ReturnReceipt;
    },
    enabled: !!id,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<ReturnReceipt>) => {
      // Convert camelCase to snake_case for database
      const dbData: any = {};
      if (data.returnDate) dbData.return_date = data.returnDate;
      if (data.status) dbData.status = data.status;
      if (data.returnReason) dbData.return_reason = data.returnReason;
      if (data.notes !== undefined) dbData.notes = data.notes;
      
      const response = await apiRequest("PUT", `/api/receipt-returns/${id}`, dbData);
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.message || 'Failed to update return');
      }
      return json.data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Return updated successfully",
      });
      setIsEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['return-receipt', id] });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async (data: Partial<ReturnItem>) => {
      const response = await apiRequest("POST", `/api/receipt-returns/${id}/items`, data);
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.message || 'Failed to add item');
      }
      return json.data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item added successfully",
      });
      setIsItemDialogOpen(false);
      setItemFormData({ itemDescription: '', quantity: 0, unitCost: 0, totalValue: 0, returnReason: '' });
      queryClient.invalidateQueries({ queryKey: ['return-receipt', id] });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: Partial<ReturnItem> }) => {
      const response = await apiRequest("PUT", `/api/receipt-returns/${id}/items/${itemId}`, data);
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.message || 'Failed to update item');
      }
      return json.data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
      setIsItemDialogOpen(false);
      setEditingItem(null);
      setItemFormData({ itemDescription: '', quantity: 0, unitCost: 0, totalValue: 0, returnReason: '' });
      queryClient.invalidateQueries({ queryKey: ['return-receipt', id] });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await apiRequest("DELETE", `/api/receipt-returns/${id}/items/${itemId}`);
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.message || 'Failed to delete item');
      }
      return json;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['return-receipt', id] });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Initialize edited data when returnData changes
  useEffect(() => {
    if (returnData && !isEditMode) {
      setEditedData({});
    }
  }, [returnData, isEditMode]);

  // Handle edit mode toggle
  const handleEditToggle = () => {
    if (isEditMode) {
      // Cancel editing
      setEditedData({});
      setIsEditMode(false);
    } else {
      // Enter edit mode
      setEditedData(returnData || {});
      setIsEditMode(true);
    }
  };

  // Handle save
  const handleSave = () => {
    if (Object.keys(editedData).length > 0) {
      updateMutation.mutate(editedData);
    }
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  // Handle copy link
  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Link Copied",
        description: "Return detail link copied to clipboard",
      });
      setIsShareDialogOpen(false);
    }).catch(() => {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    });
  };

  // Handle email share
  const handleEmailShare = () => {
    const subject = `Return Receipt #${returnData?.returnNumber}`;
    const body = `View return details: ${window.location.href}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setIsShareDialogOpen(false);
  };

  // Handle add new item
  const handleAddItem = () => {
    setEditingItem(null);
    setItemFormData({
      itemDescription: '',
      quantity: 0,
      unitCost: 0,
      totalValue: 0,
      returnReason: '',
    });
    setIsItemDialogOpen(true);
  };

  // Handle edit item
  const handleEditItem = (item: ReturnItem) => {
    setEditingItem(item);
    setItemFormData({
      itemDescription: item.itemDescription,
      quantity: item.quantity || item.quantityReturned || 0,
      unitCost: item.unitCost,
      totalValue: item.totalValue || item.totalCost || 0,
      returnReason: item.returnReason || '',
      conditionNotes: item.conditionNotes || '',
    });
    setIsItemDialogOpen(true);
  };

  // Handle delete item
  const handleDeleteItem = (itemId: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      deleteItemMutation.mutate(itemId);
    }
  };

  // Handle item form submit
  const handleItemFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate total if needed
    const quantity = Number(itemFormData.quantity) || 0;
    const unitCost = Number(itemFormData.unitCost) || 0;
    const totalValue = quantity * unitCost;

    const submitData = {
      ...itemFormData,
      quantity,
      unitCost,
      totalValue,
    };

    if (editingItem && editingItem.id) {
      updateItemMutation.mutate({ itemId: editingItem.id, data: submitData });
    } else {
      addItemMutation.mutate(submitData);
    }
  };

  // Handle item form field change
  const handleItemFieldChange = (field: string, value: any) => {
    setItemFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate total when quantity or unit cost changes
      if (field === 'quantity' || field === 'unitCost') {
        const quantity = Number(field === 'quantity' ? value : updated.quantity) || 0;
        const unitCost = Number(field === 'unitCost' ? value : updated.unitCost) || 0;
        updated.totalValue = quantity * unitCost;
      }
      
      return updated;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': 
        return 'bg-gray-200 text-gray-800 border border-gray-300';
      case 'Pending Approval': 
        return 'bg-yellow-200 text-yellow-900 border border-yellow-400';
      case 'Approved': 
        return 'bg-green-200 text-green-900 border border-green-400';
      case 'Processed': 
        return 'bg-blue-200 text-blue-900 border border-blue-400';
      case 'Cancelled': 
        return 'bg-red-200 text-red-900 border border-red-400';
      default: 
        return 'bg-gray-200 text-gray-800 border border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Draft': return <FileText className="h-3 w-3" />;
      case 'Pending Approval': return <Clock className="h-3 w-3" />;
      case 'Approved': return <CheckCircle className="h-3 w-3" />;
      case 'Processed': return <Package className="h-3 w-3" />;
      case 'Cancelled': return <AlertTriangle className="h-3 w-3" />;
      default: return <FileText className="h-3 w-3" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading return details...</p>
        </div>
      </div>
    );
  }

  if (error || !returnData) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center gap-3 pt-6">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h3 className="text-lg font-semibold">Error Loading Return Details</h3>
            <p className="text-sm text-muted-foreground text-center">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
            <Button onClick={() => navigate("/receipt-returns")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Returns
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentData = isEditMode ? editedData : returnData;

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .print-header {
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
          }
          .print-table th,
          .print-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          .print-table th {
            background-color: #f8f9fa;
            font-weight: bold;
          }
        }
      `}</style>

      <div className="container mx-auto p-4 lg:p-6 max-w-7xl">
        {/* Header Section */}
        <div className="no-print mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/receipt-returns")}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Return Details</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Return #{returnData.returnNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isEditMode ? (
              <>
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  size="sm"
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  onClick={handleEditToggle}
                  variant="outline"
                  size="sm"
                  disabled={updateMutation.isPending}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleEditToggle}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  onClick={handlePrint}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button
                  onClick={() => setIsShareDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="print-content" ref={printRef}>
          {/* Print Header */}
          <div className="print-header hidden print:block mb-6">
            <h1 className="text-3xl font-bold">Return Receipt</h1>
            <p className="text-lg">#{returnData.returnNumber}</p>
            <p className="text-sm text-gray-600">Date: {formatDate(new Date(returnData.returnDate), 'PPP')}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - Left Column (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Status & Basic Info Card */}
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold">Return Information</CardTitle>
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-sm ${getStatusColor(returnData.status)}`}>
                      {getStatusIcon(returnData.status)}
                      {returnData.status}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Receipt className="h-3.5 w-3.5" />
                        Return Number
                      </Label>
                      <Input 
                        value={currentData.returnNumber || ''} 
                        disabled 
                        className="font-medium bg-muted"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        Return Date
                      </Label>
                      <Input 
                        type="date"
                        value={currentData.returnDate ? new Date(currentData.returnDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => isEditMode && setEditedData({...editedData, returnDate: e.target.value})}
                        disabled={!isEditMode}
                        className={isEditMode ? '' : 'bg-muted'}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5" />
                        Receipt Number
                      </Label>
                      <Input 
                        value={currentData.goodsReceiptNumber || 'N/A'} 
                        disabled 
                        className="bg-muted"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      {isEditMode ? (
                        <Select 
                          value={editedData.status || returnData.status}
                          onValueChange={(value) => setEditedData({...editedData, status: value as any})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Draft">Draft</SelectItem>
                            <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                            <SelectItem value="Approved">Approved</SelectItem>
                            <SelectItem value="Processed">Processed</SelectItem>
                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={currentData.status || ''} disabled className="bg-muted" />
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Return Reason
                    </Label>
                    <Textarea
                      value={currentData.returnReason || ''}
                      onChange={(e) => isEditMode && setEditedData({...editedData, returnReason: e.target.value})}
                      disabled={!isEditMode}
                      className={`min-h-[80px] ${isEditMode ? '' : 'bg-muted'}`}
                      placeholder="Reason for return..."
                    />
                  </div>

                  {(currentData.notes || isEditMode) && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Additional Notes</Label>
                      <Textarea
                        value={currentData.notes || ''}
                        onChange={(e) => isEditMode && setEditedData({...editedData, notes: e.target.value})}
                        disabled={!isEditMode}
                        className={`min-h-[60px] ${isEditMode ? '' : 'bg-muted'}`}
                        placeholder="Additional notes..."
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Return Items Card */}
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      Return Items ({returnData.items?.length || 0})
                    </CardTitle>
                    <Button
                      onClick={handleAddItem}
                      size="sm"
                      className="gap-2 no-print"
                      variant="outline"
                    >
                      <Package className="h-4 w-4" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full print-table">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider">Description</th>
                          <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Qty</th>
                          <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Unit Cost</th>
                          <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Total</th>
                          <th className="text-center p-3 text-xs font-semibold uppercase tracking-wider no-print">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnData.items && returnData.items.length > 0 ? (
                          returnData.items.map((item, index) => (
                            <tr key={item.id || index} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="p-3">
                                <div className="max-w-xs">
                                  <p className="font-medium text-sm">{item.itemDescription}</p>
                                  {item.returnReason && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      Reason: {item.returnReason}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <span className="font-medium">{item.quantity || item.quantityReturned || 0}</span>
                              </td>
                              <td className="p-3 text-right font-mono text-sm">
                                ${Number(item.unitCost || 0).toFixed(2)}
                              </td>
                              <td className="p-3 text-right font-semibold font-mono">
                                ${Number(item.totalValue || item.totalCost || 0).toFixed(2)}
                              </td>
                              <td className="p-3 text-center no-print">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    onClick={() => handleEditItem(item)}
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                    title="Edit item"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    onClick={() => item.id && handleDeleteItem(item.id)}
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-destructive hover:bg-red-50 hover:text-red-600"
                                    disabled={!item.id}
                                    title="Delete item"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-8 text-center">
                              <div className="flex flex-col items-center gap-3">
                                <Package className="h-12 w-12 text-muted-foreground/50" />
                                <p className="text-muted-foreground">No items in this return</p>
                                <Button
                                  onClick={handleAddItem}
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                >
                                  <Package className="h-4 w-4" />
                                  Add First Item
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Sidebar - Summary Cards */}
            <div className="space-y-6">
              {/* Financial Summary Card */}
              <Card className="shadow-sm hover:shadow-md transition-shadow border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Financial Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Total Items:</span>
                    <span className="font-semibold">{returnData.items?.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Total Quantity:</span>
                    <span className="font-semibold">
                      {returnData.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <span className="font-medium">Total Value:</span>
                    <span className="text-xl font-bold text-primary font-mono">
                      ${Number(returnData.totalValue || 0).toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Supplier Info Card */}
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Supplier Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <p className="font-medium mt-1">{returnData.supplierName || 'N/A'}</p>
                  </div>
                  {returnData.supplierAddress && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Address</Label>
                      <p className="text-sm mt-1 text-muted-foreground">{returnData.supplierAddress}</p>
                    </div>
                  )}
                  {returnData.supplierContactPerson && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Contact Person</Label>
                      <p className="text-sm mt-1">{returnData.supplierContactPerson}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Timeline Card */}
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-full bg-primary/10 p-1.5">
                      <CheckCircle className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Created</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(new Date(returnData.createdAt), 'PPp')}
                      </p>
                    </div>
                  </div>
                  
                  {returnData.updatedAt !== returnData.createdAt && (
                    <div className="flex items-start gap-3">
                      <div className="mt-1 rounded-full bg-blue-100 p-1.5">
                        <RotateCcw className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Last Updated</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(new Date(returnData.updatedAt), 'PPp')}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Return Receipt
            </DialogTitle>
            <DialogDescription>
              Share this return receipt with others
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
            >
              <div className="rounded-full bg-primary/10 p-2">
                <Copy className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium">Copy Link</p>
                <p className="text-xs text-muted-foreground">Copy link to clipboard</p>
              </div>
            </Button>
            
            <Button
              onClick={handleEmailShare}
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
            >
              <div className="rounded-full bg-blue-100 p-2">
                <Mail className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Send via Email</p>
                <p className="text-xs text-muted-foreground">Open email client</p>
              </div>
            </Button>

            <Button
              onClick={handlePrint}
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
            >
              <div className="rounded-full bg-green-100 p-2">
                <Download className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Print / Save as PDF</p>
                <p className="text-xs text-muted-foreground">Print or save to PDF</p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Item Dialog */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update item details' : 'Add a new item to this return'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleItemFormSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="itemDescription">Item Description *</Label>
              <Textarea
                id="itemDescription"
                value={itemFormData.itemDescription || ''}
                onChange={(e) => handleItemFieldChange('itemDescription', e.target.value)}
                placeholder="Enter item description..."
                required
                className="min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="1"
                  value={itemFormData.quantity || ''}
                  onChange={(e) => handleItemFieldChange('quantity', e.target.value)}
                  placeholder="0"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitCost">Unit Cost *</Label>
                <Input
                  id="unitCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemFormData.unitCost || ''}
                  onChange={(e) => handleItemFieldChange('unitCost', e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalValue">Total Value (Auto-calculated)</Label>
              <Input
                id="totalValue"
                type="number"
                value={itemFormData.totalValue || 0}
                disabled
                className="bg-muted font-semibold"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnReason">Return Reason *</Label>
              <Textarea
                id="returnReason"
                value={itemFormData.returnReason || ''}
                onChange={(e) => handleItemFieldChange('returnReason', e.target.value)}
                placeholder="Why is this item being returned?"
                required
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conditionNotes">Condition Notes (Optional)</Label>
              <Textarea
                id="conditionNotes"
                value={itemFormData.conditionNotes || ''}
                onChange={(e) => handleItemFieldChange('conditionNotes', e.target.value)}
                placeholder="Additional notes about item condition..."
                className="min-h-[60px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsItemDialogOpen(false)}
                disabled={addItemMutation.isPending || updateItemMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addItemMutation.isPending || updateItemMutation.isPending}
              >
                {addItemMutation.isPending || updateItemMutation.isPending
                  ? 'Saving...'
                  : editingItem
                  ? 'Update Item'
                  : 'Add Item'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
