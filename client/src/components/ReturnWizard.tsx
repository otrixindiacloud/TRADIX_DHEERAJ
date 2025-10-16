import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FileText, 
  Edit3, 
  CheckCircle, 
  ArrowLeft, 
  ArrowRight, 
  X, 
  AlertCircle,
  Package,
  Calendar,
  User,
  Building2,
  DollarSign,
  Loader2,
  RotateCcw,
  AlertTriangle
} from "lucide-react";

// Form schemas for each step
const headerDetailsSchema = z.object({
  returnNumber: z.string().min(1, "Return number is required"),
  goodsReceiptId: z.string().optional(),
  supplierId: z.string().optional(),
  returnDate: z.string().min(1, "Return date is required"),
  returnReason: z.string().min(1, "Return reason is required"),
  status: z.enum(["Draft", "Pending Approval", "Approved", "Returned", "Credited"]),
  notes: z.string().optional(),
  // Additional optional header fields displayed in the header details page
  receiptNumber: z.string().optional(),
  receiptDate: z.string().optional(),
  receivedBy: z.string().optional(),
  expectedDate: z.string().optional(),
  actualDate: z.string().optional(),
  itemsExpected: z.number().optional(),
  itemsReceived: z.number().optional(),
  discrepancy: z.string().optional(),
  supplierName: z.string().optional(),
  supplierAddress: z.string().optional(),
  supplierContactPerson: z.string().optional(),
  supplierLpoNumber: z.string().optional(),
  customerLpoNumber: z.string().optional(),
  totalValue: z.number().optional(),
  supplierIdDisplay: z.string().optional(),
});

const returnItemSchema = z.object({
  id: z.string(),
  serialNo: z.number(),
  itemId: z.string().optional(),
  itemDescription: z.string().min(1, "Item description is required"),
  quantityReturned: z.number().min(1, "Quantity must be at least 1"),
  unitCost: z.number().min(0),
  totalCost: z.number().min(0),
  returnReason: z.string().min(1, "Return reason is required"),
  conditionNotes: z.string().optional(),
});

const returnItemsSchema = z.object({
  items: z.array(returnItemSchema),
});

type HeaderDetailsForm = z.infer<typeof headerDetailsSchema>;
type ReturnItemForm = z.infer<typeof returnItemSchema>;
type ReturnItemsForm = z.infer<typeof returnItemsSchema>;

interface ReturnWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goodsReceipts: any[];
  suppliers: any[];
  items: any[];
}

export default function ReturnWizard({ open, onOpenChange, goodsReceipts, suppliers, items }: ReturnWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [returnItems, setReturnItems] = useState<ReturnItemForm[]>([]);
  const [wizardKey, setWizardKey] = useState(0);
  const [extractedReceiptNumber, setExtractedReceiptNumber] = useState<string | null>(null);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Form for header details
  const headerForm = useForm<HeaderDetailsForm>({
    resolver: zodResolver(headerDetailsSchema),
    defaultValues: {
      returnNumber: "",
      goodsReceiptId: "",
      supplierId: "",
      returnDate: "",
      returnReason: "",
      status: "Draft",
      notes: "",
      receiptNumber: "",
      receiptDate: "",
      receivedBy: "",
      expectedDate: "",
      actualDate: "",
      itemsExpected: 0,
      itemsReceived: 0,
      discrepancy: "",
      supplierName: "",
      supplierAddress: "",
      supplierContactPerson: "",
      supplierLpoNumber: "",
      customerLpoNumber: "",
      totalValue: 0,
      supplierIdDisplay: "",
    },
  });

  // Form for return items
  const itemsForm = useForm<ReturnItemsForm>({
    resolver: zodResolver(returnItemsSchema),
    defaultValues: {
      items: [],
    },
  });

  // Query to fetch complete receipt data
  const { data: receiptData, isLoading: isLoadingReceiptData, error: receiptDataError } = useQuery({
    queryKey: ["receipt-complete", extractedReceiptNumber],
    queryFn: async () => {
      if (!extractedReceiptNumber) return null;
      console.log('Fetching receipt data for:', extractedReceiptNumber);
      const response = await fetch(`/api/receipts/complete/${extractedReceiptNumber}`);
      if (!response.ok) {
        throw new Error('Failed to fetch receipt data');
      }
      const result = await response.json();
      console.log('Receipt data fetched:', result);
      return result;
    },
    enabled: !!extractedReceiptNumber,
    retry: 1,
  });

  // Create return mutation
  const createReturnMutation = useMutation({
    mutationFn: async (data: HeaderDetailsForm & { items: ReturnItemForm[] }) => {
      console.log('Sending return data to API:', data);
      const response = await apiRequest("POST", "/api/receipt-returns", data);
      const result = await response.json();
      console.log('API response:', result);
      return result;
    },
    onSuccess: async (data) => {
      console.log('Return created successfully:', data);
      
      // Extract return ID from response - API returns { success: true, data: {...}, returnId: "..." }
      const returnId = data?.returnId || data?.data?.id || data?.id;
      console.log('Extracted return ID:', returnId);
      
      // Invalidate and refetch all return-related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["receipt-returns"] }),
        queryClient.invalidateQueries({ queryKey: ["receipt-returns-stats"] }),
        queryClient.refetchQueries({ queryKey: ["receipt-returns"] }),
        queryClient.refetchQueries({ queryKey: ["receipt-returns-stats"] })
      ]);
      
      console.log('Queries invalidated and refetched');
      
      const returnNumber = data?.data?.returnNumber || data?.returnNumber || '';
      
      toast({
        title: "Success",
        description: `Return ${returnNumber} processed successfully. Navigating to detail page...`,
      });
      
      // Close the wizard first
      handleClose();
      
      // Navigate to return detail page using the ID
      if (returnId) {
        console.log('Navigating to return detail page with ID:', returnId);
        // Use setTimeout to ensure the dialog closes before navigation
        setTimeout(() => {
          setLocation(`/receipt-returns/${returnId}`);
        }, 200);
      } else {
        console.error('No return ID found in response:', data);
        toast({
          title: "Warning",
          description: "Return created but couldn't navigate to detail page. Please check the returns list.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error('Error creating return:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create return",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setCurrentStep(1);
    setUploadedFile(null);
    setExtractedData(null);
    setReturnItems([]);
    setExtractedReceiptNumber(null);
    setIsManualEntry(false);
    setActiveTab('upload');
    headerForm.reset();
    itemsForm.reset();
    setWizardKey(prev => prev + 1);
    onOpenChange(false);
  };

  // Reset wizard state when dialog opens
  React.useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setUploadedFile(null);
      setExtractedData(null);
      setReturnItems([]);
      setExtractedReceiptNumber(null);
      setIsManualEntry(false);
      setActiveTab('upload');
      headerForm.reset();
      itemsForm.reset();
      setWizardKey(prev => prev + 1);
    }
  }, [open]);

  // Populate form with real receipt data when fetched
  React.useEffect(() => {
    if (receiptData?.success && receiptData?.data) {
      console.log('Processing receipt data:', receiptData.data);
      const data = receiptData.data;
      const receipt = data.receipt;
      const supplier = data.supplier;
      const items = data.items || []; // Items are returned separately in the API response
      
      // Convert receipt items to the expected format
      const convertedItems: ReturnItemForm[] = items.map((item: any, index: number) => ({
        id: item.id || (index + 1).toString(),
        serialNo: index + 1,
        itemId: item.itemId || item.id || "",
        itemDescription: item.itemDescription || item.description || '',
        quantityReturned: Number(item.quantity) || Number(item.receivedQuantity) || 0,
        unitCost: Number(item.unitCost) || Number(item.unitPrice) || 0,
        totalCost: Number(item.totalCost) || Number(item.totalPrice) || (Number(item.quantity) * Number(item.unitCost)) || 0,
        returnReason: "Quality Issue", // Default reason
        conditionNotes: "",
      }));

      // Calculate totals from items
      const totalItemsExpected = items.reduce((sum: number, item: any) => sum + (Number(item.expectedQuantity) || Number(item.quantity) || 0), 0);
      const totalItemsReceived = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || Number(item.receivedQuantity) || 0), 0);
      const totalValue = items.reduce((sum: number, item: any) => sum + (Number(item.totalCost) || Number(item.totalPrice) || (Number(item.quantity) * Number(item.unitCost)) || 0), 0);

      // Update form with real data
      const currentFormValues = headerForm.getValues();
      const formData = {
        returnNumber: currentFormValues.returnNumber || `RET-${Date.now()}`,
        returnDate: currentFormValues.returnDate || new Date().toISOString().split('T')[0],
        goodsReceiptId: receipt.id || "",
        supplierId: receipt.supplierId || "",
        returnReason: currentFormValues.returnReason || "Quality Issue",
        status: (receipt.status || "Draft") as any,
        notes: receipt.notes || currentFormValues.notes || "",
        receiptNumber: receipt.receiptNumber || receipt.number || "",
        receiptDate: receipt.receiptDate || receipt.date || new Date(receipt.createdAt).toISOString().split('T')[0] || "",
        receivedBy: receipt.receivedBy || "system",
        expectedDate: receipt.expectedDate || receipt.expectedDeliveryDate || "",
        actualDate: receipt.actualDate || receipt.actualDeliveryDate || receipt.receiptDate || new Date(receipt.createdAt).toISOString().split('T')[0] || "",
        itemsExpected: totalItemsExpected,
        itemsReceived: totalItemsReceived,
        discrepancy: (receipt.hasDiscrepancy || totalItemsExpected !== totalItemsReceived) ? "YES" : "NO",
        supplierName: supplier?.name || "",
        supplierAddress: supplier?.address || "",
        supplierContactPerson: `${supplier?.name || ''}\n${supplier?.email || ''}\n${supplier?.phone || ''}`,
        supplierLpoNumber: receipt.lpoNumber || receipt.supplierLpoNumber || "",
        customerLpoNumber: receipt.customerLpoNumber || receipt.customerLpo || "",
        totalValue: totalValue || receipt.totalValue || receipt.totalAmount || 0,
        supplierIdDisplay: supplier?.supplierId || supplier?.id || "",
      };

      // Only update if we have real data
      if (receipt.id && supplier?.name) {
        console.log('Updating form with real receipt data...');
        console.log('Receipt:', receipt.receiptNumber);
        console.log('Supplier:', supplier.name);
        console.log('Items:', convertedItems.length);
        
        headerForm.reset(formData);
        setReturnItems(convertedItems);
        itemsForm.setValue("items", convertedItems);
        
        console.log('Form updated with real data:', formData);
        
        // Show success message
        toast({
          title: "Receipt Data Loaded",
          description: `Successfully loaded data for receipt ${receipt.receiptNumber}`,
        });
      } else {
        console.log('Insufficient data to populate form:', {
          hasReceiptId: !!receipt.id,
          hasSupplierName: !!supplier?.name,
          receipt: receipt,
          supplier: supplier
        });
      }
    } else if (receiptDataError && extractedData) {
      // If receipt not found in database, use extracted data from document
      console.log('Receipt not found in database, using extracted data from document');
      
      // Convert extracted items to return items format
      const convertedItems: ReturnItemForm[] = extractedData.items?.map((item: any, index: number) => ({
        id: item.id || (index + 1).toString(),
        serialNo: index + 1,
        itemId: "", // Will be filled when user selects from inventory
        itemDescription: item.itemDescription || item.description || '',
        quantityReturned: Number(item.quantity) || Number(item.receivedQuantity) || 0,
        unitCost: Number(item.unitCost) || Number(item.unitPrice) || 0,
        totalCost: Number(item.totalCost) || Number(item.totalPrice) || 0,
        returnReason: "Quality Issue", // Default reason
        conditionNotes: "",
      })) || [];

      // Update form with extracted data
      const currentFormValues = headerForm.getValues();
      const formData = {
        returnNumber: currentFormValues.returnNumber || `RET-${Date.now()}`,
        returnDate: currentFormValues.returnDate || new Date().toISOString().split('T')[0],
        goodsReceiptId: "", // Will be selected by user
        supplierId: "", // Will be selected by user
        returnReason: currentFormValues.returnReason || "Quality Issue",
        status: currentFormValues.status || "Draft",
        notes: extractedData.notes || currentFormValues.notes || "",
        receiptNumber: extractedData.receiptNumber || extractedData.invoiceNumber || "",
        receiptDate: extractedData.receiptDate || extractedData.invoiceDate || "",
        receivedBy: extractedData.receivedBy || "",
        expectedDate: extractedData.expectedDate || "",
        actualDate: extractedData.actualDate || "",
        itemsExpected: extractedData.itemsExpected || 0,
        itemsReceived: extractedData.itemsReceived || 0,
        discrepancy: extractedData.discrepancy || "",
        supplierName: extractedData.supplierName || "",
        supplierAddress: extractedData.supplierAddress || "",
        supplierContactPerson: extractedData.supplierContactPerson || "",
        supplierLpoNumber: extractedData.supplierLpoNumber || "",
        customerLpoNumber: extractedData.customerLpoNumber || "",
        totalValue: extractedData.totalValue || 0,
        supplierIdDisplay: extractedData.supplierId || "",
      };

      console.log('Updating form with extracted data from document...');
      console.log('Receipt Number:', formData.receiptNumber);
      console.log('Supplier:', formData.supplierName);
      console.log('Items:', convertedItems.length);
      
      headerForm.reset(formData);
      setReturnItems(convertedItems);
      itemsForm.setValue("items", convertedItems);
      
      console.log('Form updated with extracted data:', formData);
      
      // Show info message
      toast({
        title: "Document Data Loaded",
        description: `Loaded data from document. Please select the corresponding goods receipt.`,
      });
    }
  }, [receiptData, receiptDataError, extractedData, extractedReceiptNumber, toast]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setIsProcessing(true);
      
      // Reset state to ensure fresh data
      setExtractedData(null);
      setReturnItems([]);
      setExtractedReceiptNumber(null);
      headerForm.reset();
      itemsForm.reset();
      setWizardKey(prev => prev + 1);
      
      try {
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('document', file);
        
        // Call the document processing API
        const response = await fetch('/api/document-processing/extract-return?t=' + Date.now(), {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error Response:', errorText);
          throw new Error(`Failed to process document: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Document processing result:', result);
        
        if (result.success && result.data) {
          const extractedData = result.data;
          
          // Extract receipt number from the document
          const receiptNumber = extractedData.receiptNumber;
          if (receiptNumber) {
            setExtractedReceiptNumber(receiptNumber);
            console.log('Extracted receipt number:', receiptNumber);
          } else {
            throw new Error('No receipt number found in the document');
          }
          
          // Set basic extracted data for immediate display
          const processedData = {
            returnNumber: extractedData.returnNumber || `RET-${Date.now()}`,
            returnDate: extractedData.returnDate || new Date().toISOString().split('T')[0],
            returnReason: extractedData.returnReason || "Quality Issue",
            status: (extractedData.status as any) || "Draft",
            notes: extractedData.notes || "",
            receiptNumber: receiptNumber,
            receiptDate: extractedData.receiptDate || "",
            supplierName: extractedData.supplierName || "",
            supplierAddress: extractedData.supplierAddress || "",
            supplierContactPerson: extractedData.supplierContactPerson || "",
            items: extractedData.items || []
          };
          
          setExtractedData(processedData);
          setReturnItems([]);
          headerForm.reset(processedData);
          itemsForm.setValue("items", []);
        } else {
          throw new Error(result.message || 'Failed to extract data from document');
        }
      } catch (error) {
        console.error('Error processing document:', error);
        
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to process document",
          variant: "destructive",
        });
        
        // Reset state on error
        setUploadedFile(null);
        setExtractedData(null);
        setReturnItems([]);
        setExtractedReceiptNumber(null);
        headerForm.reset();
        itemsForm.reset();
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      // Create a synthetic event to reuse the handleFileUpload logic
      const syntheticEvent = {
        target: {
          files: [file]
        }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      
      await handleFileUpload(syntheticEvent);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleManualEntry = () => {
    setIsManualEntry(true);
    setActiveTab('manual');
    setUploadedFile(null);
    setExtractedData(null);
    setReturnItems([]);
    setExtractedReceiptNumber(null);
    
    // Initialize form with default values for manual entry
    const defaultValues = {
      returnNumber: `RET-${Date.now()}`,
      returnDate: new Date().toISOString().split('T')[0],
      returnReason: "Quality Issue",
      status: "Draft" as any,
      notes: "",
      goodsReceiptId: "",
      supplierId: "",
    };
    
    headerForm.reset(defaultValues);
    itemsForm.reset({ items: [] });
    
    toast({
      title: "Manual Entry Mode",
      description: "You can now manually enter return details. Please proceed to the next step.",
    });
  };

  const handleTabChange = (tab: 'upload' | 'manual') => {
    setActiveTab(tab);
    if (tab === 'manual') {
      handleManualEntry();
    } else {
      setIsManualEntry(false);
      setUploadedFile(null);
      setExtractedData(null);
      setReturnItems([]);
      setExtractedReceiptNumber(null);
      headerForm.reset();
      itemsForm.reset();
    }
  };

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = (data: HeaderDetailsForm) => {
    console.log('=== SUBMIT BUTTON CLICKED ===');
    console.log('Form is valid, onSubmit called');
    console.log('Creating return with data:', data);
    console.log('Items to save:', returnItems);
    
    // Validate we have items
    if (!returnItems || returnItems.length === 0) {
      console.error('No items to return!');
      toast({
        title: "Validation Error",
        description: "Please add at least one item to return",
        variant: "destructive",
      });
      return;
    }
    
    // Validate all required fields
    if (!data.returnNumber) {
      toast({
        title: "Validation Error",
        description: "Return number is required",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.returnDate) {
      toast({
        title: "Validation Error",
        description: "Return date is required",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.returnReason) {
      toast({
        title: "Validation Error",
        description: "Return reason is required",
        variant: "destructive",
      });
      return;
    }
    
    // Format data according to the backend schema
    const returnData = {
      returnNumber: data.returnNumber,
      goodsReceiptId: data.goodsReceiptId ? data.goodsReceiptId : undefined,
      supplierId: data.supplierId ? data.supplierId : undefined,
      returnDate: data.returnDate,
      returnReason: data.returnReason,
      status: data.status || "Draft",
      notes: data.notes || "",
      items: returnItems,
    };
    
    console.log('Validation passed. Sending return data to backend:', returnData);
    createReturnMutation.mutate(returnData);
  };

  const updateItem = (index: number, field: keyof ReturnItemForm, value: any) => {
    const updatedItems = [...returnItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Auto-calculate total cost
    const item = updatedItems[index];
    if (field === 'quantityReturned' || field === 'unitCost') {
      const totalCost = item.quantityReturned * item.unitCost;
      updatedItems[index].totalCost = totalCost;
    }
    
    setReturnItems(updatedItems);
    itemsForm.setValue("items", updatedItems);
  };

  const removeItem = (index: number) => {
    const updatedItems = returnItems.filter((_, i) => i !== index);
    setReturnItems(updatedItems);
    itemsForm.setValue("items", updatedItems);
  };

  const addItem = () => {
    const newItem: ReturnItemForm = {
      id: Date.now().toString(),
      serialNo: returnItems.length + 1,
      itemId: "",
      itemDescription: "",
      quantityReturned: 1,
      unitCost: 0,
      totalCost: 0,
      returnReason: "Quality Issue",
      conditionNotes: "",
    };
    const updatedItems = [...returnItems, newItem];
    setReturnItems(updatedItems);
    itemsForm.setValue("items", updatedItems);
  };

  const steps = [
    { number: 1, title: "Upload Document", icon: Upload },
    { number: 2, title: "Header Details", icon: Edit3 },
    { number: 3, title: "Items Details", icon: Package },
    { number: 4, title: "Review & Submit", icon: CheckCircle },
  ];

  const progress = (currentStep / 4) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={wizardKey}>
      <DialogContent className="w-[95vw] h-[85vh] max-w-[95vw] max-h-[85vh] overflow-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <RotateCcw className="h-4 w-4" />
            Process Return Wizard
          </DialogTitle>
          <DialogDescription className="text-xs">
            Process a return by uploading a document and reviewing the extracted information
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-1 pb-2">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Step {currentStep} of 4</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Step Indicators */}
        <div className="flex justify-between items-center py-2">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;
            
            return (
              <div key={step.number} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  isActive 
                    ? 'border-orange-500 bg-orange-500 text-white' 
                    : isCompleted 
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-300 bg-gray-100 text-gray-400'
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`text-xs mt-1 ${isActive ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="py-2 flex-1 overflow-hidden">
          {/* Step 1: Upload Document or Manual Entry */}
          {currentStep === 1 && (
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Upload className="h-4 w-4" />
                  Upload Document or Manual Entry
                </CardTitle>
                <CardDescription className="text-xs">
                  Upload a PDF document to extract return information automatically or enter details manually
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 h-full flex flex-col">
                {/* Tab Navigation */}
                <div className="flex space-x-1 mb-4 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => handleTabChange('upload')}
                    className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                      activeTab === 'upload'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Upload className="h-3 w-3 mr-1 inline" />
                    Upload Document
                  </button>
                  <button
                    onClick={() => handleTabChange('manual')}
                    className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                      activeTab === 'manual'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Edit3 className="h-3 w-3 mr-1 inline" />
                    Manual Entry
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'upload' ? (
                  !uploadedFile ? (
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer flex-1 flex flex-col justify-center"
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <h3 className="text-sm font-medium text-gray-900 mb-1">
                        Drop your PDF here or click to browse
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">
                        Supported format: PDF files only
                      </p>
                      <Button variant="outline" size="sm">
                        Choose File
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1 flex flex-col">
                      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <FileText className="h-5 w-5 text-green-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-900">{uploadedFile.name}</p>
                          <p className="text-xs text-green-700">
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUploadedFile(null);
                            setExtractedData(null);
                            setReturnItems([]);
                            setIsManualEntry(false);
                            headerForm.reset();
                            itemsForm.reset();
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {isProcessing ? (
                        <div className="flex items-center justify-center py-4 flex-1">
                          <div className="text-center">
                            <Loader2 className="h-6 w-6 animate-spin text-orange-600 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">Processing document...</p>
                            <p className="text-xs text-gray-500">Extracting return information</p>
                          </div>
                        </div>
                      ) : extractedData && (
                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="h-4 w-4 text-orange-600" />
                            <span className="text-sm font-medium text-orange-900">Document processed successfully!</span>
                          </div>
                          <p className="text-xs text-orange-700">
                            Found {extractedData.items?.length || 0} items and extracted header information.
                          </p>
                          {extractedReceiptNumber && (
                            <p className="text-xs text-orange-600 font-medium mt-1">
                              Receipt Number: {extractedReceiptNumber}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  /* Manual Entry Tab */
                  <div className="space-y-4 flex-1 flex flex-col justify-center">
                    <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg text-center">
                      <Edit3 className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-blue-900 mb-2">
                        Manual Entry Mode
                      </h3>
                      <p className="text-sm text-blue-700 mb-4">
                        Create a return by manually entering all the required details. You can fill in the return information, select items, and configure quantities without uploading any documents.
                      </p>
                      <div className="space-y-2 text-xs text-blue-600">
                        <p>• Enter return header details manually</p>
                        <p>• Select items from your inventory</p>
                        <p>• Configure quantities and reasons</p>
                        <p>• Review and submit the return</p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white border border-gray-200 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Quick Start</h4>
                      <div className="space-y-2 text-xs text-gray-600">
                        <p>• Return number will be auto-generated</p>
                        <p>• Select goods receipt and supplier in next step</p>
                        <p>• Add items and configure details</p>
                        <p>• Review all information before submitting</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </CardContent>
            </Card>
          )}

          {/* Step 2: Header Details */}
          {currentStep === 2 && (
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Edit3 className="h-4 w-4" />
                  {isManualEntry ? "Enter Header Details" : "Review Header Details"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isManualEntry ? 
                    "Enter the return header information manually" :
                    isLoadingReceiptData ? 
                    "Fetching receipt data..." : 
                    receiptDataError ? 
                    "Receipt not found in database. Using extracted data from document." :
                    "Review and edit the extracted header information from the document"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 h-full overflow-y-auto">
                {isLoadingReceiptData && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-orange-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Loading receipt data...</p>
                      <p className="text-xs text-gray-500">Receipt: {extractedReceiptNumber}</p>
                      <p className="text-xs text-gray-400">Fetching from database...</p>
                    </div>
                  </div>
                )}
                
                {receiptDataError && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Using Document Data</span>
                    </div>
                    <p className="text-xs text-blue-700">
                      Receipt "{extractedReceiptNumber}" not found in the system. Using extracted data from document. Please select the corresponding goods receipt.
                    </p>
                  </div>
                )}
                <Form {...headerForm}>
                  <form className="space-y-3">
                    {/* Receipt & Goods Receipt Information Card */}
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-600" />
                          Goods Receipt Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Basic Receipt Information Section */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-1 border-b border-blue-300">
                            <Package className="h-3.5 w-3.5 text-blue-700" />
                            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wide">Receipt Details</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={headerForm.control}
                              name="goodsReceiptId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Goods Receipt {!isManualEntry && <span className="text-red-500">*</span>}</FormLabel>
                                  <Select onValueChange={(val) => {
                                    field.onChange(val);
                                    const selected = goodsReceipts.find((r: any) => r.id === val);
                                    if (selected?.supplierId) {
                                      headerForm.setValue("supplierId", selected.supplierId);
                                      headerForm.setValue("supplierName", selected.supplierName || selected.supplier?.name || "");
                                    }
                                  }} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-8 text-xs bg-white">
                                        <SelectValue placeholder="Select Receipt" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="" className="text-xs">None (Manual Entry)</SelectItem>
                                      {goodsReceipts.map((receipt: any) => (
                                        <SelectItem key={receipt.id} value={receipt.id} className="text-xs">
                                          {receipt.receiptNumber || receipt.number || `GR-${receipt.id}`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={headerForm.control}
                              name="receiptNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Receipt #</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-8 text-xs bg-white font-medium" readOnly={!isManualEntry} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            <FormField
                              control={headerForm.control}
                              name="status"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Status</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-8 text-xs bg-white font-medium" readOnly />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={headerForm.control}
                              name="receiptDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Receipt Date</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-8 text-xs bg-white" readOnly />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={headerForm.control}
                              name="receivedBy"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Received By</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-8 text-xs bg-white" readOnly />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={headerForm.control}
                              name="totalValue"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Total Value</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <span className="absolute left-2 top-1.5 text-xs text-gray-500">BHD</span>
                                      <Input 
                                        {...field} 
                                        value={field.value || 0}
                                        className="h-8 text-xs bg-white font-bold text-green-600 pl-10" 
                                        readOnly 
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* LPO Information Section */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-1 border-b border-blue-300">
                            <FileText className="h-3.5 w-3.5 text-blue-700" />
                            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wide">LPO References</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={headerForm.control}
                              name="customerLpoNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Customer LPO</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-8 text-xs bg-white font-medium" readOnly />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={headerForm.control}
                              name="supplierLpoNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Supplier LPO</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-8 text-xs bg-white font-medium" readOnly />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Delivery Dates Section */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-1 border-b border-blue-300">
                            <Calendar className="h-3.5 w-3.5 text-blue-700" />
                            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wide">Delivery Timeline</h3>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <FormField
                              control={headerForm.control}
                              name="expectedDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Expected Date</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-8 text-xs bg-white" readOnly />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={headerForm.control}
                              name="actualDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Actual Date</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-8 text-xs bg-white" readOnly />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={headerForm.control}
                              name="supplierId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Supplier {!isManualEntry && <span className="text-red-500">*</span>}</FormLabel>
                                  <Select onValueChange={(val) => {
                                    field.onChange(val);
                                    const selected = suppliers.find((s: any) => s.id === val);
                                    if (selected) {
                                      headerForm.setValue("supplierName", selected.name || "");
                                      headerForm.setValue("supplierAddress", selected.address || "");
                                      headerForm.setValue("supplierContactPerson", `${selected.name || ''}\n${selected.email || ''}\n${selected.phone || ''}`);
                                      headerForm.setValue("supplierIdDisplay", selected.supplierId || selected.id || "");
                                    }
                                  }} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-8 text-xs bg-white">
                                        <SelectValue placeholder="Select Supplier" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {suppliers.map((supplier: any) => (
                                        <SelectItem key={supplier.id} value={supplier.id} className="text-xs">
                                          {supplier.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Items Summary Section */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-1 border-b border-blue-300">
                            <DollarSign className="h-3.5 w-3.5 text-blue-700" />
                            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wide">Items Summary</h3>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <FormField
                              control={headerForm.control}
                              name="itemsExpected"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Items Expected</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="number" className="h-8 text-xs bg-white" readOnly />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={headerForm.control}
                              name="itemsReceived"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Items Received</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="number" className="h-8 text-xs bg-white" readOnly />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={headerForm.control}
                              name="discrepancy"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Discrepancy</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-8 text-xs bg-white font-medium" readOnly />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Additional Notes Section */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-1 border-b border-blue-300">
                            <AlertCircle className="h-3.5 w-3.5 text-blue-700" />
                            <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wide">Additional Notes</h3>
                          </div>
                          <FormField
                            control={headerForm.control}
                            name="notes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold">Notes</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    {...field} 
                                    rows={3}
                                    className="text-xs bg-white resize-vertical" 
                                    readOnly 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Supplier Information Card */}
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-purple-600" />
                          Supplier Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Basic Supplier Details Section */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-1 border-b border-purple-300">
                            <User className="h-3.5 w-3.5 text-purple-700" />
                            <h3 className="text-xs font-bold text-purple-900 uppercase tracking-wide">Supplier Details</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={headerForm.control}
                              name="supplierName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Supplier Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-8 text-xs bg-white font-medium" readOnly />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={headerForm.control}
                              name="supplierIdDisplay"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Supplier ID</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-8 text-xs bg-white font-medium" readOnly />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Contact Information Section */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-1 border-b border-purple-300">
                            <Building2 className="h-3.5 w-3.5 text-purple-700" />
                            <h3 className="text-xs font-bold text-purple-900 uppercase tracking-wide">Contact Information</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={headerForm.control}
                              name="supplierAddress"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Supplier Address</FormLabel>
                                  <FormControl>
                                    <Textarea rows={3} {...field} placeholder="Supplier Address" className="text-xs bg-white" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={headerForm.control}
                              name="supplierContactPerson"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold">Supplier Contact</FormLabel>
                                  <FormControl>
                                    <Textarea rows={3} {...field} placeholder="Contact Person" className="text-xs bg-white" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        {/* Order Reference Section */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-1 border-b border-purple-300">
                            <FileText className="h-3.5 w-3.5 text-purple-700" />
                            <h3 className="text-xs font-bold text-purple-900 uppercase tracking-wide">Order Reference</h3>
                          </div>
                          <FormField
                            control={headerForm.control}
                            name="supplierLpoNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold">Supplier LPO Number</FormLabel>
                                <FormControl>
                                  <Input {...field} className="h-8 text-xs bg-white font-medium" readOnly />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Return Details Card */}
                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 min-h-[260px] max-h-[420px] overflow-auto">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <RotateCcw className="h-4 w-4 text-orange-600" />
                          Return Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                          <FormField
                            control={headerForm.control}
                            name="returnNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold">
                                  Return Number <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="e.g. RET-20251009-LD6ZH" className="h-8 text-xs bg-white min-w-[180px]" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={headerForm.control}
                            name="returnDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold">
                                  Return Date <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} className="h-8 text-xs bg-white min-w-[180px]" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={headerForm.control}
                            name="returnReason"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold">
                                  Return Reason <span className="text-red-500">*</span>
                                </FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-8 text-xs bg-white min-w-[180px]">
                                      <SelectValue placeholder="Select reason" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Damaged" className="text-xs">Damaged</SelectItem>
                                    <SelectItem value="Wrong Item" className="text-xs">Wrong Item</SelectItem>
                                    <SelectItem value="Quality Issue" className="text-xs">Quality Issue</SelectItem>
                                    <SelectItem value="Excess Quantity" className="text-xs">Excess Quantity</SelectItem>
                                    <SelectItem value="Expired" className="text-xs">Expired</SelectItem>
                                    <SelectItem value="Customer Request" className="text-xs">Customer Request</SelectItem>
                                    <SelectItem value="Other" className="text-xs">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={headerForm.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-semibold">Status</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="h-8 text-xs bg-white min-w-[180px]">
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Draft" className="text-xs">Draft</SelectItem>
                                    <SelectItem value="Pending Approval" className="text-xs">Pending Approval</SelectItem>
                                    <SelectItem value="Approved" className="text-xs">Approved</SelectItem>
                                    <SelectItem value="Returned" className="text-xs">Returned</SelectItem>
                                    <SelectItem value="Credited" className="text-xs">Credited</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={headerForm.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-semibold">Notes</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Enter any additional notes..."
                                  rows={5}
                                  {...field} 
                                  className="text-xs bg-white min-h-[80px] max-h-[180px] resize-vertical" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Items Details */}
          {currentStep === 3 && (
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4" />
                  {isManualEntry ? "Enter Items Details" : "Review Items Details"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isManualEntry ? 
                    "Add items to return manually" :
                    isLoadingReceiptData ? 
                    "Fetching receipt items..." : 
                    receiptDataError ? 
                    "Receipt not found in database. Using extracted items from document." :
                    "Review and edit the extracted items information from the document"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 h-full overflow-y-auto">
                {isLoadingReceiptData && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-orange-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Loading receipt items...</p>
                      <p className="text-xs text-gray-500">Receipt: {extractedReceiptNumber}</p>
                    </div>
                  </div>
                )}
                
                {receiptDataError && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Using Document Data</span>
                    </div>
                    <p className="text-xs text-blue-700">
                      Receipt "{extractedReceiptNumber}" not found in the system. Using extracted items from document. Please select the corresponding goods receipt and map items to inventory.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium">Return Items ({returnItems.length})</h3>
                    <Button onClick={addItem} variant="outline" size="sm" className="h-7 text-xs">
                      <Package className="h-3 w-3 mr-1" />
                      Add Item
                    </Button>
                  </div>
                  
                  <div className="space-y-1">
                    {returnItems.map((item, index) => (
                      <Card key={item.id} className="p-2">
                        <div className="space-y-1">
                          {/* Item Header with Serial and Description */}
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-12">
                              <Label className="text-xs font-medium">S.l.</Label>
                              <Input
                                type="number"
                                value={item.serialNo}
                                onChange={(e) => updateItem(index, 'serialNo', Number(e.target.value))}
                                min="1"
                                className="h-6 text-xs"
                              />
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs font-medium">
                                Item Description <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                value={item.itemDescription}
                                onChange={(e) => updateItem(index, 'itemDescription', e.target.value)}
                                placeholder="Enter item description..."
                                className="h-6 text-xs"
                              />
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeItem(index)}
                              className="h-6 text-xs px-2"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          {/* Quantity and Pricing Row */}
                          <div className="grid grid-cols-4 gap-1">
                            <div>
                              <Label className="text-xs font-medium">
                                Qty Returned <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.quantityReturned}
                                onChange={(e) => updateItem(index, 'quantityReturned', Number(e.target.value))}
                                min="1"
                                className="h-6 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium">Unit Cost</Label>
                              <Input
                                type="number"
                                step="0.001"
                                value={item.unitCost}
                                onChange={(e) => updateItem(index, 'unitCost', Number(e.target.value))}
                                min="0"
                                className="h-6 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium">Total Cost</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.totalCost}
                                onChange={(e) => updateItem(index, 'totalCost', Number(e.target.value))}
                                min="0"
                                className="h-6 text-xs"
                                readOnly
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium">
                                Return Reason <span className="text-red-500">*</span>
                              </Label>
                              <Select onValueChange={(val) => updateItem(index, 'returnReason', val)} value={item.returnReason}>
                                <SelectTrigger className="h-6 text-xs">
                                  <SelectValue placeholder="Select reason" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Damaged" className="text-xs">Damaged</SelectItem>
                                  <SelectItem value="Wrong Item" className="text-xs">Wrong Item</SelectItem>
                                  <SelectItem value="Quality Issue" className="text-xs">Quality Issue</SelectItem>
                                  <SelectItem value="Excess Quantity" className="text-xs">Excess Quantity</SelectItem>
                                  <SelectItem value="Expired" className="text-xs">Expired</SelectItem>
                                  <SelectItem value="Customer Request" className="text-xs">Customer Request</SelectItem>
                                  <SelectItem value="Other" className="text-xs">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          {/* Condition Notes */}
                          <div className="grid grid-cols-1 gap-1">
                            <div>
                              <Label className="text-xs font-medium">Condition Notes</Label>
                              <Input
                                value={item.conditionNotes}
                                onChange={(e) => updateItem(index, 'conditionNotes', e.target.value)}
                                placeholder="Enter condition notes..."
                                className="h-6 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                  
                  {returnItems.length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No items found. Click "Add Item" to add items manually.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Review & Submit */}
          {currentStep === 4 && (
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Review & Submit
                </CardTitle>
                <CardDescription className="text-xs">
                  Review all information before processing the return
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 h-full overflow-y-auto">
                {/* Validation Errors Display */}
                {Object.keys(headerForm.formState.errors).length > 0 && (
                  <Card className="bg-red-50 border-red-200 mb-3">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-semibold text-red-900">Validation Errors</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1">
                        {Object.entries(headerForm.formState.errors).map(([field, error]) => (
                          <li key={field} className="text-xs text-red-700">
                            <strong>{field}:</strong> {error?.message as string}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                
                {/* Items Validation Warning */}
                {returnItems.length === 0 && (
                  <Card className="bg-yellow-50 border-yellow-200 mb-3">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm font-semibold text-yellow-900">No Items Added</span>
                      </div>
                      <p className="text-xs text-yellow-700 mt-1">
                        Please add at least one item to return in Step 3
                      </p>
                    </CardContent>
                  </Card>
                )}
                
                <div className="space-y-3">
                  {/* Goods Receipt Summary */}
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        Goods Receipt Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <Label className="text-xs font-medium text-gray-600">Receipt Number</Label>
                          <p className="text-sm font-bold text-blue-900">{headerForm.getValues('receiptNumber')}</p>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-600">Receipt Date</Label>
                          <p className="text-xs font-medium">{headerForm.getValues('receiptDate')}</p>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-600">Customer LPO</Label>
                          <p className="text-sm font-bold text-blue-900">{headerForm.getValues('customerLpoNumber') || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-600">Total Value</Label>
                          <p className="text-sm font-bold text-green-600">BHD {(headerForm.getValues('totalValue') || 0).toFixed(3)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Supplier Summary */}
                  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-purple-600" />
                        Supplier Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div>
                          <Label className="text-xs font-medium text-gray-600">Supplier Name</Label>
                          <p className="text-sm font-bold text-purple-900">{headerForm.getValues('supplierName')}</p>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-600">Supplier ID</Label>
                          <p className="text-sm font-bold text-purple-900">{headerForm.getValues('supplierIdDisplay') || 'N/A'}</p>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-600">Supplier LPO</Label>
                          <p className="text-sm font-bold text-purple-900">{headerForm.getValues('supplierLpoNumber') || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-white rounded border border-purple-200">
                          <Label className="text-xs font-medium text-gray-600">Address</Label>
                          <p className="whitespace-pre-wrap text-xs text-gray-700">{headerForm.getValues('supplierAddress') || 'N/A'}</p>
                        </div>
                        <div className="p-2 bg-white rounded border border-purple-200">
                          <Label className="text-xs font-medium text-gray-600">Contact Person</Label>
                          <p className="whitespace-pre-wrap text-xs text-gray-700">{headerForm.getValues('supplierContactPerson') || 'N/A'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Return Summary */}
                  <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <RotateCcw className="h-4 w-4 text-orange-600" />
                        Return Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <div>
                          <Label className="text-xs font-medium text-gray-600">Return Number</Label>
                          <p className="text-sm font-bold text-orange-900">{headerForm.getValues('returnNumber')}</p>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-600">Return Date</Label>
                          <p className="text-xs font-medium">{headerForm.getValues('returnDate')}</p>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-600">Return Reason</Label>
                          <Badge variant="outline" className="text-xs">{headerForm.getValues('returnReason')}</Badge>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-600">Status</Label>
                          <Badge variant="outline" className="text-xs">{headerForm.getValues('status')}</Badge>
                        </div>
                      </div>
                      {headerForm.getValues('notes') && (
                        <div className="p-2 bg-white rounded border border-orange-200">
                          <Label className="text-xs font-medium text-gray-600">Notes</Label>
                          <p className="text-xs text-gray-700">{headerForm.getValues('notes')}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Items Summary */}
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Return Items Summary ({returnItems.length})
                    </h3>
                    <div className="space-y-1">
                      {returnItems.map((item, index) => (
                        <div key={item.id} className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="grid grid-cols-6 gap-2">
                            <div className="col-span-2">
                              <p className="text-xs font-medium">{item.serialNo}. {item.itemDescription}</p>
                              <p className="text-xs text-gray-500">Qty: {item.quantityReturned} × BHD {item.unitCost.toFixed(3)}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Total Cost</Label>
                              <p className="text-xs font-bold text-green-600">BHD {item.totalCost.toFixed(2)}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Reason</Label>
                              <p className="text-xs">{item.returnReason}</p>
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs text-gray-500">Notes</Label>
                              <p className="text-xs">{item.conditionNotes || 'None'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 p-3 bg-gradient-to-r from-orange-100 to-orange-200 border-2 border-orange-300 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-orange-900">Total Return Value:</span>
                        <span className="text-xl font-bold text-orange-700">
                          BHD {returnItems.reduce((sum, item) => sum + item.totalCost, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-3 border-t">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
            size="sm"
            className="h-8 text-xs"
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Previous
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} size="sm" className="h-8 text-xs">
              Cancel
            </Button>
            
            {currentStep < 4 ? (
              <Button
                onClick={nextStep}
                disabled={currentStep === 1 && activeTab === 'upload' && !uploadedFile && !extractedData}
                size="sm"
                className="h-8 text-xs"
              >
                Next
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={async (e) => {
                  e.preventDefault();
                  console.log('=== SUBMIT BUTTON CLICKED ===');
                  console.log('Event:', e);
                  console.log('Form state:', headerForm.formState);
                  console.log('Form errors:', headerForm.formState.errors);
                  console.log('Form values:', headerForm.getValues());
                  console.log('Return items:', returnItems);
                  console.log('Is mutation pending:', createReturnMutation.isPending);
                  
                  // First, trigger validation
                  const isValid = await headerForm.trigger();
                  console.log('Form validation result:', isValid);
                  console.log('Form errors after validation:', headerForm.formState.errors);
                  
                  if (!isValid) {
                    console.error('Form validation failed:', headerForm.formState.errors);
                    const errorMessages = Object.entries(headerForm.formState.errors)
                      .map(([field, error]) => `${field}: ${error?.message}`)
                      .join(', ');
                    toast({
                      title: "Validation Error",
                      description: errorMessages || "Please fill in all required fields correctly",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Check if we have items
                  if (!returnItems || returnItems.length === 0) {
                    console.error('No items to return!');
                    toast({
                      title: "Validation Error",
                      description: "Please add at least one item to return",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Trigger form submission
                  headerForm.handleSubmit(onSubmit)(e);
                }}
                disabled={createReturnMutation.isPending}
                size="sm"
                className="h-8 text-xs"
                type="button"
              >
                {createReturnMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Submit
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
