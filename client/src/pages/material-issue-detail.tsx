import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Edit, Package, Calendar, User, Building2, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import StockIssueWizard from "@/components/StockIssueWizard";

export default function MaterialIssueDetailPage() {
  const [, params] = useRoute("/material-issue/:id");
  const [, setLocation] = useLocation();
  const [isEditMode, setIsEditMode] = useState(false);
  const issueId = params?.id;

  // Define type for issue data
  type IssueItem = {
    id?: string | number;
    itemDescription?: string;
    item_description?: string;
    quantityIssued?: number;
    quantity_issued?: number;
    unitCost?: number | string;
    unit_cost?: number | string;
    totalCost?: number | string;
    total_cost?: number | string;
    issueReason?: string;
    issue_reason?: string;
    conditionNotes?: string;
    condition_notes?: string;
    // add other fields as needed
  };

  type IssueResponse = {
    items?: IssueItem[];
    issueNumber?: string | number;
    issue_number?: string | number;
    issueDate?: string;
    issue_date?: string;
    deliveryNumber?: string | number;
    delivery_number?: string | number;
    customerId?: string | number;
    customer_id?: string | number;
    supplierId?: string | number;
    supplier_id?: string | number;
    issueReason?: string;
    issue_reason?: string;
    notes?: string;
    status?: string;
    // add other fields as needed
  };

  // Fetch issue details with items
  const { data: issueData, isLoading, error, refetch } = useQuery<IssueResponse>({
    queryKey: ["stock-issue", issueId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/stock-issues/${issueId}`);
      return await response.json();
    },
    enabled: !!issueId,
  });

  // Fetch customers for edit mode
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/customers");
      return await response.json();
    },
  });

  // Fetch suppliers for edit mode
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/suppliers");
      return await response.json();
    },
  });

  // Fetch items for edit mode
  const { data: items = [] } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/inventory-items");
      return await response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !issueData) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p>Failed to load material issue details</p>
              <Button onClick={() => setLocation("/stock-issues")} className="mt-4">
                Back to List
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const issue = issueData;
  const issueItems = issue.items || [];

  // Calculate totals
  const totalQuantity = issueItems.reduce((sum: number, item: any) => sum + (item.quantityIssued || item.quantity_issued || 0), 0);
  const totalValue = issueItems.reduce((sum: number, item: any) => sum + parseFloat(item.totalCost || item.total_cost || 0), 0);

  // Get status badge color
  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "draft": return "bg-gray-500";
      case "pending approval": return "bg-yellow-500";
      case "approved": return "bg-green-500";
      case "processed": return "bg-blue-500";
      case "cancelled": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const handleEditComplete = async () => {
    setIsEditMode(false);
    await refetch();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/stock-issues")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Material Issue Details</h1>
            <p className="text-muted-foreground">
              Issue #{issue.issueNumber || issue.issue_number || "N/A"}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsEditMode(true)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      {/* Status and Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Issue Summary</CardTitle>
            <Badge className={getStatusColor(issue.status)}>
              {issue.status || "Draft"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{issueItems.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Quantity</p>
                <p className="text-2xl font-bold">{totalQuantity}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Header Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Header Information</CardTitle>
          <CardDescription>General details about this material issue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Issue Number</p>
                  <p className="text-base font-semibold">{issue.issueNumber || issue.issue_number || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Issue Date</p>
                  <p className="text-base font-semibold">
                    {issue.issueDate || issue.issue_date 
                      ? new Date(issue.issueDate || issue.issue_date || '').toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Delivery Number</p>
                  <p className="text-base font-semibold">{issue.deliveryNumber || issue.delivery_number || "N/A"}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Customer</p>
                  <p className="text-base font-semibold">{issue.customerId || issue.customer_id || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Supplier</p>
                  <p className="text-base font-semibold">{issue.supplierId || issue.supplier_id || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Issue Reason</p>
                  <p className="text-base font-semibold">{issue.issueReason || issue.issue_reason || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>
          {(issue.notes) && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                <p className="text-base whitespace-pre-wrap">{issue.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Items Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Item Details</CardTitle>
          <CardDescription>List of all items in this material issue</CardDescription>
        </CardHeader>
        <CardContent>
          {issueItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No items found for this issue</p>
            </div>
          ) : (
            <div className="space-y-4">
              {issueItems.map((item: any, index: number) => {
                const itemDescription = item.itemDescription || item.item_description || "N/A";
                const quantityIssued = item.quantityIssued || item.quantity_issued || 0;
                const unitCost = parseFloat(item.unitCost || item.unit_cost || 0);
                const totalCost = parseFloat(item.totalCost || item.total_cost || 0);
                const issueReason = item.issueReason || item.issue_reason || "";
                const conditionNotes = item.conditionNotes || item.condition_notes || "";

                return (
                  <Card key={item.id || index} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-lg font-semibold">
                            #{index + 1}
                          </Badge>
                          <div>
                            <h4 className="font-semibold text-lg">{itemDescription}</h4>
                            {issueReason && (
                              <p className="text-sm text-muted-foreground">Reason: {issueReason}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">${totalCost.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">Total Cost</p>
                        </div>
                      </div>
                      <Separator className="my-3" />
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Quantity Issued</p>
                          <p className="text-base font-semibold">{quantityIssued}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Unit Cost</p>
                          <p className="text-base font-semibold">${unitCost.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Cost</p>
                          <p className="text-base font-semibold">${totalCost.toFixed(2)}</p>
                        </div>
                      </div>
                      {conditionNotes && (
                        <>
                          <Separator className="my-3" />
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Condition Notes</p>
                            <p className="text-base">{conditionNotes}</p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Wizard Dialog */}
      {isEditMode && (
        <StockIssueWizard
          open={isEditMode}
          onOpenChange={(open) => {
            if (!open) {
              handleEditComplete();
            }
          }}
          customers={customers}
          suppliers={suppliers}
          items={items}
          editData={issue}
        />
      )}
    </div>
  );
}
