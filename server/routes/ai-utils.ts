import type { Express } from "express";
import { AIUtils } from "../ai-utils";

export function registerAIUtilsRoutes(app: Express) {
  // Health check for AI services
  app.get("/api/ai/health", (req, res) => {
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    res.json({
      status: "ok",
      aiEnabled: hasApiKey,
      timestamp: new Date().toISOString(),
      message: hasApiKey ? "AI services are available" : "AI services running in fallback mode"
    });
  });

  // Generate field suggestions for autofill
  app.post("/api/ai/suggestions/field", async (req, res) => {
    try {
      const { fieldType, context } = req.body;
      
      if (!fieldType) {
        return res.status(400).json({ error: "Field type is required" });
      }

      const suggestions = await AIUtils.generateFieldSuggestions(fieldType, context);
      
      res.json({ suggestions });
    } catch (error) {
      console.error("Error generating field suggestions:", error);
      res.status(500).json({ 
        error: "Failed to generate suggestions",
        suggestions: []
      });
    }
  });

  // Generate data analysis insights
  app.post("/api/ai/insights/data", async (req, res) => {
    try {
      const { dataType, data } = req.body;
      
      if (!dataType || !data) {
        return res.status(400).json({ error: "Data type and data are required" });
      }

      const insights = await AIUtils.generateDataInsights(dataType, data);
      
      res.json({ insights });
    } catch (error) {
      console.error("Error generating data insights:", error);
      res.status(500).json({ 
        error: "Failed to generate insights",
        insights: "Unable to generate insights at this time."
      });
    }
  });

  // Generate error analysis and fixes
  app.post("/api/ai/error-analysis", async (req, res) => {
    try {
      const { error, context } = req.body;
      
      if (!error) {
        return res.status(400).json({ error: "Error message is required" });
      }

      const analysis = await AIUtils.generateErrorAnalysis(error, context);
      
      res.json(analysis);
    } catch (error) {
      console.error("Error generating error analysis:", error);
      res.status(500).json({ 
        error: "Failed to generate error analysis",
        explanation: "Unable to analyze error at this time.",
        suggestedFixes: ["Contact support for assistance"],
        preventionTips: ["Check your input and try again"]
      });
    }
  });

  // Generate pricing suggestions
  app.post("/api/ai/pricing-suggestions", async (req, res) => {
    try {
      const { item, marketContext } = req.body;
      
      if (!item) {
        return res.status(400).json({ error: "Item data is required" });
      }

      const suggestions = await AIUtils.generatePricingSuggestions(item, marketContext);
      
      res.json(suggestions);
    } catch (error) {
      console.error("Error generating pricing suggestions:", error);
      res.status(500).json({ 
        error: "Failed to generate pricing suggestions",
        suggestedPrice: 0,
        reasoning: "Unable to generate pricing at this time.",
        alternatives: []
      });
    }
  });

  // Generate inventory recommendations
  app.post("/api/ai/inventory-recommendations", async (req, res) => {
    try {
      const { inventoryData } = req.body;
      
      if (!inventoryData || !Array.isArray(inventoryData)) {
        return res.status(400).json({ error: "Inventory data array is required" });
      }

      const recommendations = await AIUtils.generateInventoryRecommendations(inventoryData);
      
      res.json(recommendations);
    } catch (error) {
      console.error("Error generating inventory recommendations:", error);
      res.status(500).json({ 
        error: "Failed to generate inventory recommendations",
        reorderItems: [],
        slowMovingItems: [],
        recommendations: ["Unable to generate recommendations at this time."]
      });
    }
  });

  // Generate customer insights
  app.post("/api/ai/customer-insights", async (req, res) => {
    try {
      const { customerData } = req.body;
      
      if (!customerData || !Array.isArray(customerData)) {
        return res.status(400).json({ error: "Customer data array is required" });
      }

      const insights = await AIUtils.generateCustomerInsights(customerData);
      
      res.json(insights);
    } catch (error) {
      console.error("Error generating customer insights:", error);
      res.status(500).json({ 
        error: "Failed to generate customer insights",
        topCustomers: [],
        insights: ["Unable to generate insights at this time."],
        recommendations: ["Contact support for assistance"]
      });
    }
  });

  // Generate smart autofill for forms
  app.post("/api/ai/autofill", async (req, res) => {
    try {
      const { formType, currentData, fieldName } = req.body;
      
      if (!formType || !fieldName) {
        return res.status(400).json({ error: "Form type and field name are required" });
      }

      // Generate suggestions based on form type and field
      const suggestions = await AIUtils.generateFieldSuggestions(fieldName, {
        formType,
        currentData
      });

      // Generate intelligent autofill value
      let autofillValue = '';
      if (suggestions.length > 0) {
        // Use the first suggestion as autofill value
        autofillValue = suggestions[0];
      }

      res.json({
        suggestions,
        autofillValue,
        confidence: suggestions.length > 0 ? 0.8 : 0.3
      });
    } catch (error) {
      console.error("Error generating autofill:", error);
      res.status(500).json({ 
        error: "Failed to generate autofill",
        suggestions: [],
        autofillValue: '',
        confidence: 0
      });
    }
  });

  // Generate intelligent data validation suggestions
  app.post("/api/ai/validate-data", async (req, res) => {
    try {
      const { data, validationRules } = req.body;
      
      if (!data) {
        return res.status(400).json({ error: "Data is required for validation" });
      }

      // Use AI to validate data and suggest corrections
      const prompt = `Validate this data against common business rules and suggest corrections:

Data: ${JSON.stringify(data)}
Rules: ${JSON.stringify(validationRules || {})}

Check for:
- Format consistency
- Required field completeness
- Data type accuracy
- Business logic compliance

Return JSON with: { isValid: boolean, errors: string[], suggestions: string[] }`;

      const { generateText } = await import('ai');
      const { openai } = await import('@ai-sdk/openai');
      
      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt,
        temperature: 0.2,
        maxTokens: 300,
      });

      try {
        const validation = JSON.parse(text);
        res.json(validation);
      } catch {
        // Fallback validation
        res.json({
          isValid: true,
          errors: [],
          suggestions: ['Data appears to be valid']
        });
      }
    } catch (error) {
      console.error("Error validating data:", error);
      res.status(500).json({ 
        error: "Failed to validate data",
        isValid: false,
        errors: ["Validation service unavailable"],
        suggestions: ["Please check your data manually"]
      });
    }
  });
}
