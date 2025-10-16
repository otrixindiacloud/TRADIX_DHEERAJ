// Test conversion and status update
import { storage } from './server/storage/index.js';

async function testConversion() {
  try {
    console.log("=== Testing Enquiry to Quotation Conversion ===\n");
    
    // Find an enquiry that hasn't been quoted yet
    const enquiries = await storage.getEnquiries(10, 0, { status: "New" });
    
    if (enquiries.length === 0) {
      console.log("No enquiries with 'New' status found");
      
      // Try "In Progress" status
      const inProgressEnquiries = await storage.getEnquiries(10, 0, { status: "In Progress" });
      if (inProgressEnquiries.length === 0) {
        console.log("No enquiries with 'In Progress' status found either");
        return;
      }
      
      const testEnquiry = inProgressEnquiries[0];
      console.log(`Found enquiry: ${testEnquiry.enquiryNumber} (Status: ${testEnquiry.status})`);
      console.log(`Enquiry ID: ${testEnquiry.id}\n`);
      
      console.log("Converting to quotation...");
      const quotation = await storage.generateQuotationFromEnquiry(testEnquiry.id, "system");
      console.log(`✅ Quotation created: ${quotation.quotationNumber}\n`);
      
      // Check the enquiry status after conversion
      const updatedEnquiry = await storage.getEnquiry(testEnquiry.id);
      console.log(`Enquiry status after conversion: ${updatedEnquiry.status}`);
      
      if (updatedEnquiry.status === "Quoted") {
        console.log("✅ SUCCESS: Enquiry status was updated to 'Quoted'!");
      } else {
        console.log(`❌ FAILED: Enquiry status is still '${updatedEnquiry.status}'`);
      }
      
      return;
    }
    
    const testEnquiry = enquiries[0];
    console.log(`Found enquiry: ${testEnquiry.enquiryNumber} (Status: ${testEnquiry.status})`);
    console.log(`Enquiry ID: ${testEnquiry.id}\n`);
    
    console.log("Converting to quotation...");
    const quotation = await storage.generateQuotationFromEnquiry(testEnquiry.id, "system");
    console.log(`✅ Quotation created: ${quotation.quotationNumber}\n`);
    
    // Check the enquiry status after conversion
    const updatedEnquiry = await storage.getEnquiry(testEnquiry.id);
    console.log(`Enquiry status after conversion: ${updatedEnquiry.status}`);
    
    if (updatedEnquiry.status === "Quoted") {
      console.log("✅ SUCCESS: Enquiry status was updated to 'Quoted'!");
    } else {
      console.log(`❌ FAILED: Enquiry status is still '${updatedEnquiry.status}'`);
    }
    
  } catch (error) {
    console.error("Error during test:", error);
    console.error("Stack trace:", error.stack);
  }
  
  process.exit(0);
}

testConversion();
