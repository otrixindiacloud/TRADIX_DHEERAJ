import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
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
  User,
  Truck,
  ClipboardCheck
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

interface ReceiptItem {
  id?: string;
  itemId?: string;
  itemCode?: string;
  itemName?: string;
  itemDescription?: string;
  quantityExpected: number;
  quantityReceived: number;
  unit?: string;
  unitCost?: number;
  totalCost?: number;
  lotBatchNumber?: string;
  expiryDate?: string;
  notes?: string;
}

interface GoodsReceipt {
  id: string;
  receiptNumber: string;
  receiptDate: string;
  supplierLpoId: string;
  supplierId: string;
  supplierName?: string;
  supplierAddress?: string;
  receivedBy: string;
  status: "Pending" | "Partial" | "Completed" | "Discrepancy";
  notes: string;
  items?: ReceiptItem[];
  createdAt: string;
  updatedAt: string;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Pending":
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-50 text-yellow-700 border border-yellow-200">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Pending</span>
        </div>
      );
    case "Partial":
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
          <Truck className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Partial</span>
        </div>
      );
    case "Completed":
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 text-green-700 border border-green-200">
          <CheckCircle className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Completed</span>
        </div>
      );
    case "Discrepancy":
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700 border border-red-200">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Discrepancy</span>
        </div>
      );
    default:
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 text-gray-700 border border-gray-200">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{status}</span>
        </div>
      );
  }
};

export default function ReceiptDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [isEditMode, setIsEditMode] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [editedData, setEditedData] = useState<Partial<GoodsReceipt>>({});

  // Fetch receipt details
  const { data: receiptData, isLoading, error, refetch } = useQuery({
    queryKey: ['goods-receipt', id],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/goods-receipt-headers/${id}`);
      const receipt = await response.json();
      
      // Fetch items for this receipt
      const itemsResponse = await apiRequest("GET", `/api/goods-receipt-headers/${id}/items`);
      const items = await itemsResponse.json();
      
      return {
        ...receipt,
        items: items || []
      } as GoodsReceipt;
    },
    enabled: !!id,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<GoodsReceipt>) => {
      // Convert camelCase to snake_case for database
      const dbData: any = {};
      if (data.receiptDate) dbData.receipt_date = data.receiptDate;
      if (data.receivedBy) dbData.received_by = data.receivedBy;
      if (data.status) dbData.status = data.status;
      if (data.notes !== undefined) dbData.notes = data.notes;
      
      const response = await apiRequest("PUT", `/api/goods-receipt-headers/${id}`, dbData);
      const json = await response.json();
      return json;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Receipt updated successfully",
      });
      setIsEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
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

  const handleSave = () => {
    updateMutation.mutate(editedData);
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditedData({});
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Copied",
      description: "Receipt link copied to clipboard",
    });
  };

  const handleEmailShare = () => {
    const subject = `Goods Receipt ${receiptData?.receiptNumber}`;
    const body = `View the goods receipt details: ${window.location.href}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Clock className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading receipt details...</p>
        </div>
      </div>
    );
  }

  if (error || !receiptData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load receipt details</p>
          <Button onClick={() => navigate("/receipts")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Receipts
          </Button>
        </div>
      </div>
    );
  }

  const totalQuantityExpected = receiptData.items?.reduce((sum, item) => sum + (Number(item.quantityExpected) || 0), 0) || 0;
  const totalQuantityReceived = receiptData.items?.reduce((sum, item) => sum + (Number(item.quantityReceived) || 0), 0) || 0;
  const totalValue = receiptData.items?.reduce((sum, item) => sum + ((Number(item.quantityReceived) || 0) * (Number(item.unitCost) || 0)), 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-content,
          #printable-content * {
            visibility: visible;
          }
          #printable-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header - No Print */}
      <div className="bg-white border-b sticky top-0 z-10 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/receipts")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Receipts
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Receipt #{receiptData.receiptNumber}
                </h1>
                <p className="text-sm text-gray-500">
                  Created {formatDate(receiptData.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditMode(true)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrint}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsShareDialogOpen(true)}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="printable-content">
        <div className="grid gap-6">
          {/* Receipt Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Receipt Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <Label className="text-gray-600 mb-2 block">Receipt Number</Label>
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-gray-400" />
                    <span className="font-mono font-medium">{receiptData.receiptNumber}</span>
                  </div>
                </div>
                
                <div>
                  <Label className="text-gray-600 mb-2 block">Receipt Date</Label>
                  {isEditMode ? (
                    <Input
                      type="date"
                      value={editedData.receiptDate || receiptData.receiptDate}
                      onChange={(e) => setEditedData({ ...editedData, receiptDate: e.target.value })}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{formatDate(receiptData.receiptDate)}</span>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-gray-600 mb-2 block">Status</Label>
                  {isEditMode ? (
                    <Select
                      value={editedData.status || receiptData.status}
                      onValueChange={(value) => setEditedData({ ...editedData, status: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Partial">Partial</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Discrepancy">Discrepancy</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    getStatusBadge(receiptData.status)
                  )}
                </div>

                <div>
                  <Label className="text-gray-600 mb-2 block">Received By</Label>
                  {isEditMode ? (
                    <Input
                      value={editedData.receivedBy || receiptData.receivedBy}
                      onChange={(e) => setEditedData({ ...editedData, receivedBy: e.target.value })}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>{receiptData.receivedBy}</span>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-gray-600 mb-2 block">Supplier</Label>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span>{receiptData.supplierName || receiptData.supplierId}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-gray-600 mb-2 block">Total Items</Label>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-400" />
                    <span>{receiptData.items?.length || 0} items</span>
                  </div>
                </div>
              </div>

              {(receiptData.notes || isEditMode) && (
                <div className="mt-6">
                  <Label className="text-gray-600 mb-2 block">Notes</Label>
                  {isEditMode ? (
                    <Textarea
                      value={editedData.notes !== undefined ? editedData.notes : receiptData.notes}
                      onChange={(e) => setEditedData({ ...editedData, notes: e.target.value })}
                      rows={3}
                      placeholder="Add notes about this receipt..."
                    />
                  ) : (
                    <p className="text-gray-700 whitespace-pre-wrap">{receiptData.notes}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Receipt Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Expected Quantity</p>
                      <p className="text-2xl font-bold text-blue-700 mt-1">{totalQuantityExpected}</p>
                    </div>
                    <ClipboardCheck className="h-8 w-8 text-blue-400" />
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">Received Quantity</p>
                      <p className="text-2xl font-bold text-green-700 mt-1">{totalQuantityReceived}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-400" />
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Total Value</p>
                      <p className="text-2xl font-bold text-purple-700 mt-1">
                        ${totalValue.toFixed(2)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-purple-400" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Receipt Items ({receiptData.items?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Item</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">Expected</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">Received</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">Unit</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Unit Cost</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptData.items && receiptData.items.length > 0 ? (
                      receiptData.items.map((item, index) => (
                        <tr key={item.id || index} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">
                                {item.itemName || item.itemDescription || "N/A"}
                              </p>
                              {item.itemCode && (
                                <p className="text-sm text-gray-500 font-mono">{item.itemCode}</p>
                              )}
                              {item.lotBatchNumber && (
                                <p className="text-xs text-gray-400">Batch: {item.lotBatchNumber}</p>
                              )}
                            </div>
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className="text-gray-700">{Number(item.quantityExpected) || 0}</span>
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className={`font-medium ${
                              Number(item.quantityReceived) === Number(item.quantityExpected) 
                                ? "text-green-600" 
                                : Number(item.quantityReceived) > 0 
                                ? "text-yellow-600" 
                                : "text-red-600"
                            }`}>
                              {Number(item.quantityReceived) || 0}
                            </span>
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className="text-gray-600">{item.unit || "N/A"}</span>
                          </td>
                          <td className="text-right py-3 px-4">
                            <span className="text-gray-700">${(Number(item.unitCost) || 0).toFixed(2)}</span>
                          </td>
                          <td className="text-right py-3 px-4">
                            <span className="font-medium text-gray-900">
                              ${((Number(item.quantityReceived) || 0) * (Number(item.unitCost) || 0)).toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500">
                          No items found for this receipt
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {receiptData.items && receiptData.items.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 font-medium">
                        <td className="py-3 px-4 text-right" colSpan={4}>Total:</td>
                        <td className="py-3 px-4 text-right text-gray-700">
                          {totalQuantityReceived} items
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900">
                          ${totalValue.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Receipt</DialogTitle>
            <DialogDescription>
              Share this receipt with others
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleCopyLink}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleEmailShare}
            >
              <Mail className="h-4 w-4 mr-2" />
              Share via Email
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setIsShareDialogOpen(false);
                handlePrint();
              }}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
