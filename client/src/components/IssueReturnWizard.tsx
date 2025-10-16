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
  Truck,
  Loader2,
  Plus,
  Trash2
} from "lucide-react";

// Form schemas
const headerDetailsSchema = z.object({
  issueNumber: z.string().min(1, "Issue number is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  customerId: z.string().min(1, "Customer is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  issueReason: z.string().min(1, "Issue reason is required"),
  status: z.enum(["Draft", "Pending Approval", "Approved", "Processed", "Cancelled"]),
  notes: z.string().optional(),
});

const itemsSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    serialNo: z.number(),
    itemId: z.string(),
    itemDescription: z.string(),
    quantityIssued: z.number().min(0),
    unitCost: z.number().min(0),
    totalCost: z.number().min(0),
    issueReason: z.string(),
    conditionNotes: z.string().optional(),
  })).min(1, "At least one item is required"),
});

type HeaderDetailsForm = z.infer<typeof headerDetailsSchema>;
type ItemsForm = z.infer<typeof itemsSchema>;

interface IssueItemForm {
  id: string;
  serialNo: number;
  itemId: string;
  itemDescription: string;
  quantityIssued: number;
  unitCost: number;
  totalCost: number;
  issueReason: string;
  conditionNotes: string;
}

interface IssueReturnWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockIssues: any[];
  customers: any[];
  suppliers: any[];
  items: any[];
}

export default function IssueReturnWizard({ 
  open, 
  onOpenChange, 
  stockIssues, 
  customers, 
  suppliers, 
  items 
}: IssueReturnWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [issueItems, setIssueItems] = useState<IssueItemForm[]>([]);
  const [wizardKey, setWizardKey] = useState(0);
  const [selectedStockIssue, setSelectedStockIssue] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'select' | 'upload' | 'manual'>('select');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Form for header details
  const headerForm = useForm<HeaderDetailsForm>({
    resolver: zodResolver(headerDetailsSchema),
    defaultValues: {
      issueNumber: "",
      issueDate: new Date().toISOString().split('T')[0],
      customerId: "",
      supplierId: "",
      issueReason: "Quality Issue",
      status: "Draft",
      notes: "",
    },
  });

  // Form for items
  const itemsForm = useForm<ItemsForm>({
    resolver: zodResolver(itemsSchema),
    defaultValues: {
      items: [],
    },
  });

  // Fetch stock issue details when selected
  const { data: stockIssueData, isLoading: isLoadingStockIssue } = useQuery({
    queryKey: ['stock-issue-details', selectedStockIssue?.id],
    queryFn: async () => {
      if (!selectedStockIssue?.id) return null;
      const response = await apiRequest("GET", `/api/stock-issues/${selectedStockIssue.id}`);
      return response;
    },
    enabled: !!selectedStockIssue?.id,
  });

  // Create stock issue mutation
  const createStockIssueMutation = useMutation({
    mutationFn: async (data: HeaderDetailsForm & { items: IssueItemForm[] }) => {
      console.log('Sending stock issue data to API:', data);
      const result = await apiRequest("POST", "/api/stock-issues", data);
      console.log('API response:', result);
      return result;
    },
    onSuccess: async (data) => {
      console.log('Stock issue created successfully:', data);
      
      // Invalidate and refetch all stock issue-related queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stock-issues"] }),
        queryClient.refetchQueries({ queryKey: ["stock-issues"] })
      ]);
      
      console.log('Queries invalidated and refetched');
      
      toast({
        title: "Success",
        description: `Stock issue processed successfully`,
      });
      
      // Close the wizard and navigate to stock issues page
      console.log('Closing wizard and navigating to stock issues page...');
      handleClose();
      
      // Navigate to the stock issues page
      setLocation('/stock-issues');
    },
    onError: (error: any) => {
      console.error('Error creating stock issue:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create stock issue",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setCurrentStep(1);
    setUploadedFile(null);
    setExtractedData(null);
    setIsProcessing(false);
    setIssueItems([]);
    setSelectedStockIssue(null);
    setActiveTab('select');
    headerForm.reset();
    itemsForm.reset();
    setWizardKey(prev => prev + 1);
    onOpenChange(false);
  };

  const handleTabChange = (tab: 'select' | 'upload' | 'manual') => {
    setActiveTab(tab);
    if (tab === 'manual') {
      // Initialize form with default values for manual entry
      const defaultValues = {
        issueNumber: `IR-${Date.now()}`,
        issueDate: new Date().toISOString().split('T')[0],
        customerId: "",
        supplierId: "",
        issueReason: "Quality Issue",
        status: "Draft" as any,
        notes: "",
      };
      headerForm.reset(defaultValues);
      itemsForm.reset({ items: [] });
      setIssueItems([]);
      setSelectedStockIssue(null);
      setUploadedFile(null);
      setExtractedData(null);
    } else {
      setIssueItems([]);
      setSelectedStockIssue(null);
      setUploadedFile(null);
      setExtractedData(null);
      headerForm.reset();
      itemsForm.reset();
    }
  };

  // Reset wizard when opened
  React.useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setUploadedFile(null);
      setExtractedData(null);
      setIsProcessing(false);
      setIssueItems([]);
      setSelectedStockIssue(null);
      setActiveTab('select');
      headerForm.reset();
      itemsForm.reset();
      setWizardKey(prev => prev + 1);
    }
  }, [open]);

  // Populate form with stock issue data when fetched
  React.useEffect(() => {
    if (stockIssueData && selectedStockIssue) {
      console.log('Processing stock issue data:', stockIssueData);
      
      // Convert stock issue items to issue items format
      const convertedItems: IssueItemForm[] = stockIssueData.data?.items?.map((item: any, index: number) => ({
        id: item.id || (index + 1).toString(),
        serialNo: index + 1,
        itemId: item.itemId || "",
        itemDescription: item.itemDescription || '',
        quantityIssued: Number(item.quantityIssued) || 0,
        unitCost: Number(item.unitCost) || 0,
        totalCost: Number(item.totalCost) || 0,
        issueReason: item.issueReason || "Quality Issue",
        conditionNotes: item.conditionNotes || "",
      })) || [];

      // Update form with stock issue data
      const currentFormValues = headerForm.getValues();
      const formData = {
        issueNumber: currentFormValues.issueNumber || `STK-${Date.now()}`,
        issueDate: currentFormValues.issueDate || new Date().toISOString().split('T')[0],
        customerId: stockIssueData.data?.customerId || "",
        supplierId: stockIssueData.data?.supplierId || "",
        issueReason: currentFormValues.issueReason || "Quality Issue",
        status: currentFormValues.status || "Draft",
        notes: currentFormValues.notes || "",
      };

      console.log('Updating form with stock issue data...');
      console.log('Stock Issue ID:', selectedStockIssue.id);
      console.log('Customer:', stockIssueData.data?.customerId);
      console.log('Supplier:', stockIssueData.data?.supplierId);
      console.log('Items:', convertedItems.length);
      
      headerForm.reset(formData);
      setIssueItems(convertedItems);
      itemsForm.setValue("items", convertedItems);
      
      console.log('Form updated with stock issue data:', formData);
      
      // Show success message
      toast({
        title: "Stock Issue Data Loaded",
        description: `Successfully loaded data for stock issue ${selectedStockIssue.issueNumber}`,
      });
    }
  }, [stockIssueData, selectedStockIssue, toast]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setIsProcessing(true);

      try {
        const formData = new FormData();
        formData.append('document', file);

        const response = await fetch(`/api/document-processing/extract-stock-issue?t=${Date.now()}`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to process document: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Document processing result:', result);
        
        if (result.success && result.data) {
          const extractedData = result.data;
          
          // Set basic extracted data for immediate display
          const processedData = {
            issueNumber: extractedData.issueNumber || `STK-${Date.now()}`,
            issueDate: extractedData.issueDate || new Date().toISOString().split('T')[0],
            customerId: extractedData.customerId || "",
            supplierId: extractedData.supplierId || "",
            issueReason: extractedData.issueReason || "Quality Issue",
            status: (extractedData.status as any) || "Draft",
            notes: extractedData.notes || "",
            items: extractedData.items || []
          };
          
          setExtractedData(processedData);
          setIssueItems([]);
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
      } finally {
        setIsProcessing(false);
      }
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
    console.log('Creating stock issue with data:', data);
    console.log('Items to save:', issueItems);
    
    // Format data according to the backend schema
    const stockIssueData = {
      issueNumber: data.issueNumber,
      customerId: data.customerId,
      supplierId: data.supplierId,
      issueDate: data.issueDate,
      issueReason: data.issueReason,
      status: data.status,
      notes: data.notes,
      items: issueItems,
    };
    
    console.log('Sending stock issue data to backend:', stockIssueData);
    createStockIssueMutation.mutate(stockIssueData);
  };

  const updateItem = (index: number, field: keyof IssueItemForm, value: any) => {
    const updatedItems = [...issueItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Auto-calculate total cost
    const item = updatedItems[index];
    if (field === 'quantityIssued' || field === 'unitCost') {
      const totalCost = item.quantityIssued * item.unitCost;
      updatedItems[index].totalCost = totalCost;
    }
    
    setIssueItems(updatedItems);
    itemsForm.setValue("items", updatedItems);
  };

  const removeItem = (index: number) => {
    const updatedItems = issueItems.filter((_, i) => i !== index);
    setIssueItems(updatedItems);
    itemsForm.setValue("items", updatedItems);
  };

  const addItem = () => {
    const newItem: IssueItemForm = {
      id: Date.now().toString(),
      serialNo: issueItems.length + 1,
      itemId: "",
      itemDescription: "",
      quantityIssued: 0,
      unitCost: 0,
      totalCost: 0,
      issueReason: "Quality Issue",
      conditionNotes: "",
    };
    
    const updatedItems = [...issueItems, newItem];
    setIssueItems(updatedItems);
    itemsForm.setValue("items", updatedItems);
  };

  const steps = [
    { number: 1, title: "Select Stock Issue", icon: Package },
    { number: 2, title: "Header Details", icon: Edit3 },
    { number: 3, title: "Items Details", icon: Package },
    { number: 4, title: "Review & Submit", icon: CheckCircle },
  ];

  const progress = (currentStep / steps.length) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={wizardKey}>
      <DialogContent className="w-[95vw] h-[85vh] max-w-[95vw] max-h-[85vh] overflow-hidden">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Issue Stock Wizard
          </DialogTitle>
          <DialogDescription className="text-xs">
            Issue stock items by selecting from existing stock issues or uploading documents
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
          {/* Step 1: Select Stock Issue */}
          {currentStep === 1 && (
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4" />
                  Create Issue Return
                </CardTitle>
                <CardDescription className="text-xs">
                  Select an existing stock issue, upload a document, or create manually
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 h-full flex flex-col">
                {/* Tab Navigation */}
                <div className="flex space-x-1 mb-4 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => handleTabChange('select')}
                    className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                      activeTab === 'select'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Package className="h-3 w-3 mr-1 inline" />
                    Select Issue
                  </button>
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
                {activeTab === 'select' && (
                  <div className="space-y-4 flex-1 flex flex-col">
                    <div className="space-y-2">
                      <Label className="text-xs">Select Stock Issue</Label>
                      <Select onValueChange={(value) => {
                        const stockIssue = stockIssues.find(si => si.id === value);
                        setSelectedStockIssue(stockIssue);
                      }}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Choose a stock issue" />
                        </SelectTrigger>
                        <SelectContent>
                          {stockIssues.map((stockIssue) => (
                            <SelectItem key={stockIssue.id} value={stockIssue.id}>
                              {stockIssue.issueNumber} - {stockIssue.customerId ? customers.find(c => c.id === stockIssue.customerId)?.name : 'Unknown Customer'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {activeTab === 'upload' && (
                  <div className="space-y-4 flex-1 flex flex-col">
                    {!uploadedFile ? (
                      <div
                        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer flex-1 flex flex-col justify-center"
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
                              <p className="text-xs text-gray-500">Extracting issue information</p>
                            </div>
                          </div>
                        ) : extractedData && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-medium text-blue-900">Document processed successfully!</span>
                            </div>
                            <p className="text-xs text-blue-700">
                              Found {extractedData.items?.length || 0} items and extracted header information.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'manual' && (
                  <div className="space-y-4 flex-1 flex flex-col justify-center">
                    <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg text-center">
                      <Edit3 className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-blue-900 mb-2">
                        Manual Entry Mode
                      </h3>
                      <p className="text-sm text-blue-700 mb-4">
                        Create an issue return by manually entering all the required details. You can fill in the return information, select items, and configure quantities without uploading any documents.
                      </p>
                      <div className="space-y-2 text-xs text-blue-600">
                        <p>• Enter issue return header details manually</p>
                        <p>• Select customer and supplier</p>
                        <p>• Add items and configure details</p>
                        <p>• Review and submit the return</p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-white border border-gray-200 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Quick Start</h4>
                      <div className="space-y-2 text-xs text-gray-600">
                        <p>• Issue return number will be auto-generated</p>
                        <p>• Select customer and supplier in next step</p>
                        <p>• Add items and configure details</p>
                        <p>• Review all information before submitting</p>
                      </div>
                    </div>
                  </div>
                )}
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
                  {isLoadingStockIssue ? 
                    "Fetching stock issue data..." : 
                    "Review and edit the extracted header information"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 h-full overflow-y-auto">
                {isLoadingStockIssue && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Loading stock issue data...</p>
                    </div>
                  </div>
                )}
                
                <Form {...headerForm}>
                  <form className="space-y-2">
                    {/* Issue basics */}
                    <div className="grid grid-cols-4 gap-2">
                      <FormField
                        control={headerForm.control}
                        name="issueNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Issue Number</FormLabel>
                            <FormControl>
                              <Input {...field} className="h-7 text-xs" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={headerForm.control}
                        name="issueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Issue Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" className="h-7 text-xs" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={headerForm.control}
                        name="issueReason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Issue Reason</FormLabel>
                            <FormControl>
                              <Input {...field} className="h-7 text-xs" />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={headerForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Draft">Draft</SelectItem>
                                <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                                <SelectItem value="Approved">Approved</SelectItem>
                                <SelectItem value="Processed">Processed</SelectItem>
                                <SelectItem value="Cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Customer and Supplier */}
                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        control={headerForm.control}
                        name="customerId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Customer</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Select customer" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {customers.map((customer) => (
                                  <SelectItem key={customer.id} value={customer.id}>
                                    {customer.name}
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
                        name="supplierId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Supplier</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Select supplier" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {suppliers.map((supplier) => (
                                  <SelectItem key={supplier.id} value={supplier.id}>
                                    {supplier.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={headerForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Notes</FormLabel>
                          <FormControl>
                            <Textarea {...field} className="h-16 text-xs" placeholder="Additional notes..." />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
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
                  Review Items Details
                </CardTitle>
                <CardDescription className="text-xs">
                  Review and edit the items to be issued
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 h-full overflow-y-auto">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium">Issue Items ({issueItems.length})</h3>
                    <Button onClick={addItem} variant="outline" size="sm" className="h-7 text-xs">
                      <Package className="h-3 w-3 mr-1" />
                      Add Item
                    </Button>
                  </div>
                  
                  {issueItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No items added yet</p>
                      <p className="text-xs">Click "Add Item" to start adding items</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {issueItems.map((item, index) => (
                        <div key={item.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {item.serialNo}
                              </Badge>
                              <span className="text-sm font-medium">Item {item.serialNo}</span>
                            </div>
                            <Button
                              onClick={() => removeItem(index)}
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div>
                              <Label className="text-xs text-gray-500">Item Description</Label>
                              <Input
                                value={item.itemDescription}
                                onChange={(e) => updateItem(index, 'itemDescription', e.target.value)}
                                className="h-7 text-xs"
                                placeholder="Item description"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Quantity Issued</Label>
                              <Input
                                type="number"
                                value={item.quantityIssued}
                                onChange={(e) => updateItem(index, 'quantityIssued', Number(e.target.value))}
                                className="h-7 text-xs"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Unit Cost</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.unitCost}
                                onChange={(e) => updateItem(index, 'unitCost', Number(e.target.value))}
                                className="h-7 text-xs"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Total Cost</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.totalCost}
                                readOnly
                                className="h-7 text-xs bg-gray-50"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-gray-500">Issue Reason</Label>
                              <Input
                                value={item.issueReason}
                                onChange={(e) => updateItem(index, 'issueReason', e.target.value)}
                                className="h-7 text-xs"
                                placeholder="Quality Issue"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Condition Notes</Label>
                              <Input
                                value={item.conditionNotes}
                                onChange={(e) => updateItem(index, 'conditionNotes', e.target.value)}
                                className="h-7 text-xs"
                                placeholder="Condition notes"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
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
                  Review all information before processing the stock issue
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 h-full overflow-y-auto">
                {/* Header Summary */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Issue Information</h4>
                    <div className="space-y-1 text-xs">
                      <p><span className="font-medium">Issue Number:</span> {headerForm.watch('issueNumber')}</p>
                      <p><span className="font-medium">Issue Date:</span> {headerForm.watch('issueDate')}</p>
                      <p><span className="font-medium">Status:</span> {headerForm.watch('status')}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-2">Issue Details</h4>
                    <div className="space-y-1 text-xs">
                      <p><span className="font-medium">Issue Reason:</span> {headerForm.watch('issueReason')}</p>
                      <p><span className="font-medium">Notes:</span> {headerForm.watch('notes') || 'None'}</p>
                    </div>
                  </div>
                </div>

                {/* Items Summary */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Items to Issue ({issueItems.length})</h4>
                  <div className="space-y-2">
                    {issueItems.map((item, index) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{item.serialNo}</Badge>
                          <span className="font-medium">{item.itemDescription}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span>Qty: {item.quantityIssued} × ${item.unitCost.toFixed(2)}</span>
                          <span className="font-medium">${item.totalCost.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {issueItems.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">Total Issue Value:</span>
                        <span className="font-bold text-lg">
                          ${issueItems.reduce((sum, item) => sum + item.totalCost, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
              size="sm"
              className="h-7 text-xs"
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              size="sm"
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
          
          <div className="flex gap-2">
            {currentStep < 4 ? (
              <Button
                onClick={nextStep}
                disabled={currentStep === 1 && activeTab === 'select' && !selectedStockIssue && activeTab === 'upload' && !extractedData}
                size="sm"
                className="h-7 text-xs"
              >
                Next
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={headerForm.handleSubmit(onSubmit)}
                disabled={createStockIssueMutation.isPending}
                size="sm"
                className="h-7 text-xs"
              >
                {createStockIssueMutation.isPending ? (
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
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="hidden"
        />
      </DialogContent>
    </Dialog>
  );
}
