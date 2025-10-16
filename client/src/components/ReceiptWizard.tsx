

import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
  Loader2
} from "lucide-react";

// Form schemas for each step
const headerDetailsSchema = z.object({
  receiptNumber: z.string().min(1, "Receipt number is required"),
  supplierLpoId: z.string().min(1, "Supplier LPO is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  receiptDate: z.string().min(1, "Receipt date is required"),
  receivedBy: z.string().min(1, "Received by is required"),
  status: z.enum(["Pending", "Partial", "Completed", "Discrepancy"]),
  notes: z.string().optional(),
  // Additional optional header fields displayed in the header details page
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  supplierName: z.string().optional(),
  paymentTerms: z.string().optional(),
  dueDate: z.string().optional(),
  supplierAddress: z.string().optional(),
  supplierContactPerson: z.string().optional(),
});

const itemSchema = z.object({
  id: z.string(),
  serialNo: z.number(),
  itemDescription: z.string(),
  quantity: z.number().min(0),
  unitCost: z.number().min(0),
  discountPercent: z.number().min(0).max(100),
  discountAmount: z.number().min(0),
  netTotal: z.number().min(0),
  vatPercent: z.number().min(0).max(100),
  vatAmount: z.number().min(0),
  // Legacy fields for backward compatibility
  itemName: z.string().optional(),
  description: z.string().optional(),
  unitPrice: z.number().optional(),
  totalPrice: z.number().optional(),
  receivedQuantity: z.number().optional(),
});

const itemsSchema = z.object({
  items: z.array(itemSchema),
});

type HeaderDetailsForm = z.infer<typeof headerDetailsSchema>;
type ItemForm = z.infer<typeof itemSchema>;
type ItemsForm = z.infer<typeof itemsSchema>;

interface ReceiptWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierLpos: any[];
}

export default function ReceiptWizard({ open, onOpenChange, supplierLpos }: ReceiptWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [items, setItems] = useState<ItemForm[]>([]);
  const [wizardKey, setWizardKey] = useState(0);
  const [extractedReceiptNumber, setExtractedReceiptNumber] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'upload' | 'manual'>('upload');
  const [manualReceiptNumber, setManualReceiptNumber] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form for header details
  const headerForm = useForm<HeaderDetailsForm>({
    resolver: zodResolver(headerDetailsSchema),
    defaultValues: {
      receiptNumber: "",
      supplierLpoId: "",
      supplierId: "",
      receiptDate: "",
      receivedBy: "",
      status: "Pending",
      notes: "",
      invoiceNumber: "",
      invoiceDate: "",
      supplierName: "",
      paymentTerms: "",
      dueDate: "",
      supplierAddress: "",
      supplierContactPerson: "",
    },
  });

  // Form for items
  const itemsForm = useForm<ItemsForm>({
    resolver: zodResolver(itemsSchema),
    defaultValues: {
      items: [],
    },
  });

  // Determine which receipt number to use
  const activeReceiptNumber = inputMode === 'manual' ? manualReceiptNumber : extractedReceiptNumber;

  // Query to fetch complete goods receipt data
  const { data: goodsReceiptData, isLoading: isLoadingGoodsReceiptData, error: goodsReceiptDataError } = useQuery({
    queryKey: ["goods-receipt-complete", activeReceiptNumber],
    queryFn: async () => {
      if (!activeReceiptNumber) return null;
      console.log('Fetching goods receipt data for:', activeReceiptNumber);
      const response = await fetch(`/api/goods-receipt-headers/complete/${activeReceiptNumber}`);
      if (!response.ok) {
        throw new Error('Failed to fetch goods receipt data');
      }
      const result = await response.json();
      console.log('Goods receipt data fetched:', result);
      return result;
    },
    enabled: !!activeReceiptNumber,
    retry: 1,
  });

  // Create receipt mutation
  const createReceiptMutation = useMutation({
    mutationFn: async (data: HeaderDetailsForm & { items: ItemForm[] }) => {
      console.log('Sending data to API:', data);
      const result = await apiRequest("POST", "/api/receipts", data);
      console.log('API response:', result);
      return result;
    },
    onSuccess: async (data) => {
      console.log('Receipt created successfully:', data);
      
      // Invalidate and refetch all receipt-related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["receipts"] }),
        queryClient.invalidateQueries({ queryKey: ["receipts-stats"] }),
        queryClient.refetchQueries({ queryKey: ["receipts"] }),
        queryClient.refetchQueries({ queryKey: ["receipts-stats"] })
      ]);
      
      console.log('Queries invalidated and refetched');
      
      toast({
        title: "Success",
        description: `Receipt saved successfully`,
      });
      
      // Close the wizard
      console.log('Closing wizard...');
      handleClose();
    },
    onError: (error: any) => {
      console.error('Error creating receipt:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create receipt",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setCurrentStep(1);
    setUploadedFile(null);
    setExtractedData(null);
    setItems([]);
    setExtractedReceiptNumber(null);
    setInputMode('upload');
    setManualReceiptNumber('');
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
      setItems([]);
      setExtractedReceiptNumber(null);
      setInputMode('upload');
      setManualReceiptNumber('');
      headerForm.reset();
      itemsForm.reset();
      setWizardKey(prev => prev + 1);
    }
  }, [open]);

  // Populate form with real goods receipt data when fetched
  React.useEffect(() => {
    if (goodsReceiptData?.success && goodsReceiptData?.data) {
      console.log('Processing goods receipt data:', goodsReceiptData.data);
      const data = goodsReceiptData.data;
      const goodsReceipt = data.goodsReceipt;
      const supplier = data.supplier;
      const supplierLpo = data.supplierLpo;
      
      // Convert goods receipt items to the expected format
      const convertedItems: ItemForm[] = goodsReceipt.items?.map((item: any, index: number) => ({
        id: item.id || (index + 1).toString(),
        serialNo: index + 1,
        itemDescription: item.itemDescription || item.description || '',
        quantity: Number(item.quantity) || 0,
        unitCost: Number(item.unitCost) || 0,
        discountPercent: Number(item.discountPercent) || 0,
        discountAmount: Number(item.discountAmount) || 0,
        netTotal: Number(item.netTotal) || 0,
        vatPercent: Number(item.vatPercent) || 0,
        vatAmount: Number(item.vatAmount) || 0,
        // Legacy fields
        itemName: item.itemDescription || '',
        description: item.itemDescription || '',
        unitPrice: Number(item.unitCost) || 0,
        totalPrice: Number(item.netTotal) + Number(item.vatAmount) || 0,
        receivedQuantity: Number(item.quantity) || 0,
      })) || [];

      // Update form with real data - always use goods receipt values when found
      const formData = {
        receiptNumber: goodsReceipt.receiptNumber || activeReceiptNumber || `REC-${Date.now()}`,
        receiptDate: goodsReceipt.receiptDate || new Date().toISOString().split('T')[0],
        receivedBy: goodsReceipt.receivedBy || "System User",
        supplierLpoId: goodsReceipt.supplierLpoId || supplierLpo?.id || supplierLpos[0]?.id || "",
        supplierId: goodsReceipt.supplierId || supplier?.id || supplierLpos[0]?.supplierId || "",
        status: goodsReceipt.status || "Pending",
        notes: goodsReceipt.notes || "",
        // Additional fields from goods receipt
        invoiceNumber: goodsReceipt.lpoNumber || supplierLpo?.lpoNumber || "",
        invoiceDate: goodsReceipt.receiptDate || "",
        supplierName: supplier?.name || "",
        paymentTerms: supplierLpo?.paymentTerms || "",
        dueDate: goodsReceipt.expectedDeliveryDate || "",
        supplierAddress: supplier?.address || "",
        supplierContactPerson: supplier?.contactPerson || `${supplier?.name || ''}\n${supplier?.email || ''}\n${supplier?.phone || ''}`,
      };

      // Only update if we have real goods receipt data
      if (goodsReceipt.receiptNumber) {
        console.log('Updating form with goods receipt data...');
        console.log('Goods Receipt:', goodsReceipt.receiptNumber);
        console.log('Supplier:', supplier?.name || 'Not available');
        console.log('Items:', convertedItems.length);
        
        headerForm.reset(formData);
        setItems(convertedItems);
        itemsForm.setValue("items", convertedItems);
        
        console.log('Form updated with goods receipt data:', formData);
        
        // Show success message
        toast({
          title: "Goods Receipt Data Loaded",
          description: `Successfully loaded data for goods receipt ${goodsReceipt.receiptNumber}`,
        });
      } else {
        console.log('No goods receipt number found:', {
          goodsReceipt: goodsReceipt,
          supplier: supplier
        });
      }
    }
  }, [goodsReceiptData, activeReceiptNumber, supplierLpos, toast]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setIsProcessing(true);
      
      // Reset state to ensure fresh data
      setExtractedData(null);
      setItems([]);
      setExtractedReceiptNumber(null);
      headerForm.reset();
      itemsForm.reset();
      setWizardKey(prev => prev + 1);
      
      try {
        // First test if the API is reachable
        console.log('Testing document processing API availability...');
        try {
          const testResponse = await fetch('/api/document-processing/test');
          if (testResponse.ok) {
            const testResult = await testResponse.json();
            console.log('API test successful:', testResult);
          } else {
            console.warn('API test failed:', testResponse.status, testResponse.statusText);
          }
        } catch (testError) {
          console.error('API test error:', testError);
          throw new Error('Document processing API is not available. Please check if the server is running.');
        }
        
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('document', file);
        
        // Call the document processing API
        console.log('Sending request to document processing API...');
        const response = await fetch('/api/document-processing/extract-receipt?t=' + Date.now(), {
          method: 'POST',
          body: formData,
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          let errorText;
          try {
            errorText = await response.text();
            console.error('API Error Response:', errorText);
          } catch (e) {
            console.error('Could not read error response:', e);
            errorText = 'Unknown error';
          }
          throw new Error(`Failed to process document: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        let result;
        try {
          result = await response.json();
          console.log('Document processing result:', result);
        } catch (e) {
          console.error('Could not parse JSON response:', e);
          throw new Error('Invalid response format from server');
        }
        
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
          
          // Set basic extracted data for immediate display (minimal data)
          const processedData = {
            receiptNumber: extractedData.receiptNumber || `REC-${Date.now()}`,
            receiptDate: extractedData.receiptDate || extractedData.invoiceDate || new Date().toISOString().split('T')[0],
            receivedBy: extractedData.receivedBy || "System User",
            supplierLpoId: supplierLpos[0]?.id || "",
            supplierId: supplierLpos[0]?.supplierId || "",
            status: (extractedData.status as any) || "Pending",
            notes: extractedData.notes || "",
            invoiceNumber: receiptNumber, // Keep for compatibility
            invoiceDate: extractedData.invoiceDate || "",
            supplierName: "", // Will be populated from real data
            paymentTerms: "", // Will be populated from real data
            dueDate: "", // Will be populated from real data
            supplierAddress: "", // Will be populated from real data
            supplierContactPerson: "", // Will be populated from real data
            items: [] // Will be populated from real data
          };
          
          setExtractedData(processedData);
          // Don't populate items yet - wait for real data
          setItems([]);
          headerForm.reset(processedData);
          itemsForm.setValue("items", []);
        } else {
          throw new Error(result.message || 'Failed to extract data from document');
        }
      } catch (error) {
        console.error('Error processing document:', error);
        
        const errorMessage = error instanceof Error ? error.message : "Failed to process document";
        
        toast({
          title: "PDF Processing Error",
          description: errorMessage,
          variant: "destructive",
        });
        
        // Show additional help for common issues
        if (errorMessage.includes('image-based')) {
          toast({
            title: "PDF Type Issue",
            description: "This PDF appears to be image-based. Try using the manual entry option instead.",
            variant: "destructive",
          });
        } else if (errorMessage.includes('empty') || errorMessage.includes('corrupted')) {
          toast({
            title: "PDF File Issue",
            description: "The PDF file may be corrupted. Try a different file or use manual entry.",
            variant: "destructive",
          });
        }
        
        // Reset state on error but keep the file for retry
        setExtractedData(null);
        setItems([]);
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

  const handleManualReceiptNumberChange = (value: string) => {
    setManualReceiptNumber(value);
    // Reset other states when switching to manual mode
    if (value && inputMode === 'manual') {
      setUploadedFile(null);
      setExtractedData(null);
      setItems([]);
      setExtractedReceiptNumber(null);
      headerForm.reset();
      itemsForm.reset();
    }
  };

  const handleInputModeChange = (mode: 'upload' | 'manual') => {
    setInputMode(mode);
    // Reset states when switching modes
    setUploadedFile(null);
    setExtractedData(null);
    setItems([]);
    setExtractedReceiptNumber(null);
    setManualReceiptNumber('');
    headerForm.reset();
    itemsForm.reset();
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
    console.log('Creating receipt with data:', data);
    console.log('Items to save:', items);
    
    // Format data according to the backend schema
    const additionalInfo = {
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      supplierName: data.supplierName,
      paymentTerms: data.paymentTerms,
      dueDate: data.dueDate,
      supplierAddress: data.supplierAddress,
      supplierContactPerson: data.supplierContactPerson,
      items: items,
    };

    const receiptData = {
      receiptNumber: data.receiptNumber,
      supplierLpoId: data.supplierLpoId,
      supplierId: data.supplierId,
      receiptDate: data.receiptDate,
      receivedBy: data.receivedBy,
      status: data.status,
      notes: data.notes ? `${data.notes}\n\nAdditional Info: ${JSON.stringify(additionalInfo, null, 2)}` : `Additional Info: ${JSON.stringify(additionalInfo, null, 2)}`,
      items: items,
    };
    
    console.log('Sending receipt data to backend:', receiptData);
    createReceiptMutation.mutate(receiptData);
  };

  const updateItem = (index: number, field: keyof ItemForm, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Auto-calculate related fields
    const item = updatedItems[index];
    if (field === 'quantity' || field === 'unitCost') {
      // Calculate discount amount
      const discountAmount = (item.quantity * item.unitCost * item.discountPercent) / 100;
      updatedItems[index].discountAmount = discountAmount;
      
      // Calculate net total
      const netTotal = (item.quantity * item.unitCost) - discountAmount;
      updatedItems[index].netTotal = netTotal;
      
      // Calculate VAT amount
      const vatAmount = (netTotal * item.vatPercent) / 100;
      updatedItems[index].vatAmount = vatAmount;
      
      // Update legacy fields for backward compatibility
      updatedItems[index].unitPrice = item.unitCost;
      updatedItems[index].totalPrice = netTotal + vatAmount;
    } else if (field === 'discountPercent') {
      // Recalculate discount amount and net total
      const discountAmount = (item.quantity * item.unitCost * item.discountPercent) / 100;
      updatedItems[index].discountAmount = discountAmount;
      
      const netTotal = (item.quantity * item.unitCost) - discountAmount;
      updatedItems[index].netTotal = netTotal;
      
      // Recalculate VAT amount
      const vatAmount = (netTotal * item.vatPercent) / 100;
      updatedItems[index].vatAmount = vatAmount;
      
      // Update legacy fields
      updatedItems[index].totalPrice = netTotal + vatAmount;
    } else if (field === 'vatPercent') {
      // Recalculate VAT amount
      const vatAmount = (item.netTotal * item.vatPercent) / 100;
      updatedItems[index].vatAmount = vatAmount;
      
      // Update legacy fields
      updatedItems[index].totalPrice = item.netTotal + vatAmount;
    }
    
    setItems(updatedItems);
    itemsForm.setValue("items", updatedItems);
  };

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
    itemsForm.setValue("items", updatedItems);
  };

  const addItem = () => {
    const newItem: ItemForm = {
      id: Date.now().toString(),
      serialNo: items.length + 1,
      itemDescription: "",
      quantity: 0,
      unitCost: 0,
      discountPercent: 0,
      discountAmount: 0,
      netTotal: 0,
      vatPercent: 0,
      vatAmount: 0,
      // Legacy fields
      itemName: "",
      description: "",
      unitPrice: 0,
      totalPrice: 0,
      receivedQuantity: 0,
    };
    const updatedItems = [...items, newItem];
    setItems(updatedItems);
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
            <FileText className="h-4 w-4" />
            New Receipt Wizard
          </DialogTitle>
          <DialogDescription className="text-xs">
            Create a new receipt by uploading a document and reviewing the extracted information
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
                    ? 'border-blue-500 bg-blue-500 text-white' 
                    : isCompleted 
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-300 bg-gray-100 text-gray-400'
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`text-xs mt-1 ${isActive ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
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
                  {inputMode === 'upload' ? 'Upload Receipt Document' : 'Enter Receipt Number'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {inputMode === 'upload' 
                    ? 'Upload a goods receipt PDF document to extract receipt information automatically'
                    : 'Enter a receipt number to fetch data from the database'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 h-full flex flex-col">
                {/* Input Mode Toggle */}
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={inputMode === 'upload' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleInputModeChange('upload')}
                    className="h-8 text-xs"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Upload PDF
                  </Button>
                  <Button
                    variant={inputMode === 'manual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleInputModeChange('manual')}
                    className="h-8 text-xs"
                  >
                    <Edit3 className="h-3 w-3 mr-1" />
                    Manual Entry
                  </Button>
                </div>

                {inputMode === 'upload' ? (
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
                          setItems([]);
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
                          <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">Processing document...</p>
                          <p className="text-xs text-gray-500">Extracting receipt information</p>
                        </div>
                      </div>
                    ) : extractedData ? (
                      <div className="space-y-3">
                        <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              <CheckCircle className="h-6 w-6 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-green-900 mb-1">
                                Receipt Uploaded Successfully!
                              </h3>
                              <p className="text-xs text-green-700">
                                The receipt has been processed. Click "Next" to review the details.
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setUploadedFile(null);
                              setExtractedData(null);
                              setItems([]);
                              setExtractedReceiptNumber(null);
                              headerForm.reset();
                              itemsForm.reset();
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            className="h-8 text-xs"
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Change PDF
                          </Button>
                        </div>
                      </div>
                    ) : uploadedFile && !extractedData && !isProcessing ? (
                      <div className="space-y-3 flex-1 flex flex-col">
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <span className="text-sm font-medium text-red-900">PDF Processing Failed</span>
                          </div>
                          <p className="text-xs text-red-700 mb-3">
                            Unable to extract data from the PDF. This might be due to:
                          </p>
                          <ul className="text-xs text-red-600 list-disc list-inside space-y-1 mb-3">
                            <li>PDF is image-based (scanned document)</li>
                            <li>PDF is corrupted or empty</li>
                            <li>PDF has security restrictions</li>
                          </ul>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setUploadedFile(null);
                                setExtractedData(null);
                                setItems([]);
                                setExtractedReceiptNumber(null);
                                headerForm.reset();
                                itemsForm.reset();
                              }}
                              className="h-7 text-xs"
                            >
                              Try Different File
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setInputMode('manual');
                                setUploadedFile(null);
                                setExtractedData(null);
                                setItems([]);
                                setExtractedReceiptNumber(null);
                                headerForm.reset();
                                itemsForm.reset();
                              }}
                              className="h-7 text-xs"
                            >
                              <Edit3 className="h-3 w-3 mr-1" />
                              Try Manual Entry
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    </div>
                  )
                ) : (
                  <div className="space-y-4 flex-1 flex flex-col">
                    <div className="space-y-2">
                      <Label htmlFor="receiptNumber" className="text-sm font-medium">
                        Receipt Number
                      </Label>
                      <Input
                        id="receiptNumber"
                        placeholder="Enter goods receipt number (e.g., GR-2025-001)"
                        value={manualReceiptNumber}
                        onChange={(e) => handleManualReceiptNumberChange(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <p className="text-xs text-gray-500">
                        Enter a goods receipt number to fetch existing data, or enter a new number to create a new receipt
                      </p>
                    </div>
                    
                    {isLoadingGoodsReceiptData && (
                      <div className="flex items-center justify-center py-4">
                        <div className="text-center">
                          <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">Fetching goods receipt data...</p>
                          <p className="text-xs text-gray-500">Receipt: {manualReceiptNumber}</p>
                        </div>
                      </div>
                    )}
                    
                    {goodsReceiptDataError && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">Creating new receipt</span>
                        </div>
                        <p className="text-xs text-blue-700">
                          Receipt "{manualReceiptNumber}" will be created as a new material receipt. Click "Next" to continue with manual data entry.
                        </p>
                      </div>
                    )}
                    
                    {goodsReceiptData?.success && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-900">Goods receipt found!</span>
                        </div>
                        <p className="text-xs text-green-700">
                          Successfully loaded data for goods receipt {manualReceiptNumber}
                        </p>
                      </div>
                    )}
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
                  Review Header Details
                </CardTitle>
                <CardDescription className="text-xs">
                  Review and edit the header information from the goods receipt
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 h-full overflow-y-auto">
                {isLoadingGoodsReceiptData && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Loading goods receipt data...</p>
                      <p className="text-xs text-gray-500">Receipt: {activeReceiptNumber}</p>
                    </div>
                  </div>
                )}
                
                {!isLoadingGoodsReceiptData && (
                  <Form {...headerForm}>
                    <form className="space-y-3">
                      {/* Row 1: GRN Number, GRN Date, Supplier Name, Payment Terms */}
                      <div className="grid grid-cols-4 gap-2">
                        <FormField
                          control={headerForm.control}
                          name="invoiceNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">GRN Number</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g. GRN-20251011-ITONL" className="h-8 text-xs" />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={headerForm.control}
                          name="invoiceDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">GRN Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} className="h-8 text-xs" />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={headerForm.control}
                          name="supplierName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">Supplier Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Supplier Name" className="h-8 text-xs" />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={headerForm.control}
                          name="paymentTerms"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">Payment Terms</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g. Net 30" className="h-8 text-xs" />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Row 2: Due Date, Receipt Number, Receipt Date, Received By */}
                      <div className="grid grid-cols-4 gap-2">
                        <FormField
                          control={headerForm.control}
                          name="dueDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">Due Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} className="h-8 text-xs" />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={headerForm.control}
                          name="receiptNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">Receipt Number</FormLabel>
                              <FormControl>
                                <Input {...field} className="h-8 text-xs" readOnly />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={headerForm.control}
                          name="receiptDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">Receipt Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} className="h-8 text-xs" />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={headerForm.control}
                          name="receivedBy"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">Received By</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="System User" className="h-8 text-xs" />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Row 3: Supplier LPO, Status, Notes (spanning 2 columns) */}
                      <div className="grid grid-cols-4 gap-2">
                        <FormField
                          control={headerForm.control}
                          name="supplierLpoId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">Supplier LPO</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select Supplier LPO" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {supplierLpos.map((lpo: any) => (
                                    <SelectItem key={lpo.id} value={lpo.id} className="text-xs">
                                      {lpo.lpoNumber}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={headerForm.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">Status</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Pending" className="text-xs">Pending</SelectItem>
                                  <SelectItem value="Partial" className="text-xs">Partial</SelectItem>
                                  <SelectItem value="Completed" className="text-xs">Completed</SelectItem>
                                  <SelectItem value="Discrepancy" className="text-xs">Discrepancy</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={headerForm.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel className="text-xs font-medium">Notes</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Enter any additional notes..."
                                  rows={1}
                                  {...field} 
                                  className="text-xs resize-none"
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Row 4: Supplier Address and Contact (2 columns each) */}
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={headerForm.control}
                          name="supplierAddress"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">Supplier Name & Address</FormLabel>
                              <FormControl>
                                <Textarea 
                                  rows={3} 
                                  {...field} 
                                  placeholder="Supplier Name&#10;Address line&#10;supplier@test.com&#10;+1888777666" 
                                  className="text-xs resize-none"
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={headerForm.control}
                          name="supplierContactPerson"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">Supplier Contact Person</FormLabel>
                              <FormControl>
                                <Textarea 
                                  rows={3} 
                                  {...field} 
                                  placeholder="Contact Name&#10;email@example.com&#10;+1888777666" 
                                  className="text-xs resize-none"
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Items Details */}
          {currentStep === 3 && (
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4" />
                  Review Items Details
                </CardTitle>
                <CardDescription className="text-xs">
                  {isLoadingGoodsReceiptData ? 
                    "Checking for existing goods receipt items..." : 
                    goodsReceiptDataError ? 
                    "No existing goods receipt found. You can add items manually below." :
                    "Review and edit the items information from the goods receipt"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 h-full overflow-y-auto">
                {isLoadingGoodsReceiptData && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Loading goods receipt items...</p>
                      <p className="text-xs text-gray-500">Receipt: {activeReceiptNumber}</p>
                    </div>
                  </div>
                )}
                
                {goodsReceiptDataError && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Creating new receipt</span>
                    </div>
                    <p className="text-xs text-blue-700">
                      Receipt "{activeReceiptNumber}" will be created as a new material receipt. Please add items below.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium">Items ({items.length})</h3>
                    <Button onClick={addItem} variant="outline" size="sm" className="h-7 text-xs">
                      <Package className="h-3 w-3 mr-1" />
                      Add Item
                    </Button>
                  </div>
                  
                  <div className="space-y-1">
                    {items.map((item, index) => (
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
                              <Label className="text-xs font-medium">Item Description</Label>
                              <Input
                                value={item.itemDescription}
                                onChange={(e) => updateItem(index, 'itemDescription', e.target.value)}
                                placeholder="Enter item description"
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
                              <Label className="text-xs font-medium">Qty</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                                min="0"
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
                              <Label className="text-xs font-medium">Disc %</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={item.discountPercent}
                                onChange={(e) => updateItem(index, 'discountPercent', Number(e.target.value))}
                                min="0"
                                max="100"
                                className="h-6 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium">Disc Amt</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.discountAmount}
                                onChange={(e) => updateItem(index, 'discountAmount', Number(e.target.value))}
                                min="0"
                                className="h-6 text-xs"
                              />
                            </div>
                          </div>
                          
                          {/* Totals Row */}
                          <div className="grid grid-cols-3 gap-1">
                            <div>
                              <Label className="text-xs font-medium">Net Total</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.netTotal}
                                onChange={(e) => updateItem(index, 'netTotal', Number(e.target.value))}
                                min="0"
                                className="h-6 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium">VAT %</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={item.vatPercent}
                                onChange={(e) => updateItem(index, 'vatPercent', Number(e.target.value))}
                                min="0"
                                max="100"
                                className="h-6 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium">VAT Amt</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.vatAmount}
                                onChange={(e) => updateItem(index, 'vatAmount', Number(e.target.value))}
                                min="0"
                                className="h-6 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                  
                  {items.length === 0 && (
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
                  Review all information before creating the receipt
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 h-full overflow-y-auto">
                <div className="space-y-2">
                  {/* Header Summary */}
                  <div>
                    <h3 className="text-sm font-medium mb-1 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Receipt Summary
                    </h3>
                    <div className="grid grid-cols-4 gap-1 p-2 bg-gray-50 rounded-lg">
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Invoice No</Label>
                        <p className="text-xs font-medium">{headerForm.getValues('invoiceNumber')}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Invoice Date</Label>
                        <p className="text-xs font-medium">{headerForm.getValues('invoiceDate')}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Supplier Name</Label>
                        <p className="text-xs font-medium">{headerForm.getValues('supplierName')}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Payment Terms</Label>
                        <p className="text-xs font-medium">{headerForm.getValues('paymentTerms')}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Due Date</Label>
                        <p className="text-xs font-medium">{headerForm.getValues('dueDate')}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Receipt Number</Label>
                        <p className="text-xs font-medium">{headerForm.getValues('receiptNumber')}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Receipt Date</Label>
                        <p className="text-xs font-medium">{headerForm.getValues('receiptDate')}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Received By</Label>
                        <p className="text-xs font-medium">{headerForm.getValues('receivedBy')}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Status</Label>
                        <Badge variant="outline" className="text-xs">{headerForm.getValues('status')}</Badge>
                      </div>
                      <div></div>
                      <div></div>
                      <div></div>
                    </div>
                  </div>

                  {/* Items Summary */}
                  <div>
                    <h3 className="text-sm font-medium mb-1 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Items Summary ({items.length})
                    </h3>
                    <div className="space-y-1">
                      {items.map((item, index) => (
                        <div key={item.id} className="p-2 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-6 gap-1 mb-1">
                            <div>
                              <p className="text-xs font-medium">{item.serialNo}. {item.itemDescription}</p>
                              <p className="text-xs text-gray-500">Qty: {item.quantity} × BHD {item.unitCost.toFixed(3)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-medium">BHD {item.netTotal.toFixed(2)}</p>
                              <p className="text-xs text-gray-500">+ VAT: BHD {item.vatAmount.toFixed(2)}</p>
                            </div>
                            <div className="text-xs text-gray-600">
                              <div>Disc: {item.discountPercent}%</div>
                              <div>BHD {item.discountAmount.toFixed(2)}</div>
                            </div>
                            <div className="text-xs text-gray-600">
                              <div>Net: BHD {item.netTotal.toFixed(2)}</div>
                            </div>
                            <div className="text-xs text-gray-600">
                              <div>VAT: {item.vatPercent}%</div>
                            </div>
                            <div className="text-right text-xs font-medium">
                              <div>Total:</div>
                              <div>BHD {(item.netTotal + item.vatAmount).toFixed(2)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Total Amount:</span>
                        <span className="text-lg font-bold text-blue-600">
                          BHD {items.reduce((sum, item) => sum + item.netTotal + item.vatAmount, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Supplier blocks */}
                  <div className="grid grid-cols-2 gap-1">
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <h4 className="text-xs font-medium mb-1">Supplier Name & Address</h4>
                      <p className="whitespace-pre-wrap text-xs text-gray-700">{headerForm.getValues('supplierAddress')}</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <h4 className="text-xs font-medium mb-1">Supplier Contact Person</h4>
                      <p className="whitespace-pre-wrap text-xs text-gray-700">{headerForm.getValues('supplierContactPerson')}</p>
                    </div>
                  </div>

                  {/* Notes */}
                  {headerForm.getValues('notes') && (
                    <div>
                      <h3 className="text-sm font-medium mb-1">Notes</h3>
                      <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded-lg">
                        {headerForm.getValues('notes')}
                      </p>
                    </div>
                  )}
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
                disabled={currentStep === 1 && inputMode === 'upload' && !uploadedFile || currentStep === 1 && inputMode === 'manual' && !manualReceiptNumber}
                size="sm"
                className="h-8 text-xs"
              >
                Next
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={headerForm.handleSubmit(onSubmit)}
                disabled={createReceiptMutation.isPending}
                size="sm"
                className="h-8 text-xs"
              >
                {createReceiptMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Create Receipt
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
