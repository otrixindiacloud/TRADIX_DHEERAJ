// Test script to verify enquiry status update
import { db } from './server/db.js';
import { enquiries } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function testEnquiryStatusUpdate() {
  try {
    console.log("Testing enquiry status update...");
    
    // Find an enquiry with status "New" or "In Progress"
    const testEnquiry = await db.select().from(enquiries)
      .where(eq(enquiries.status, 'New'))
      .limit(1);
    
    if (testEnquiry.length === 0) {
      console.log("No test enquiry found with status 'New'");
      return;
    }
    
    console.log("Found test enquiry:", testEnquiry[0].id, testEnquiry[0].enquiryNumber);
    console.log("Current status:", testEnquiry[0].status);
    
    // Try to update the status
    const [updated] = await db.update(enquiries)
      .set({ status: 'Quoted', updatedAt: new Date() })
      .where(eq(enquiries.id, testEnquiry[0].id))
      .returning();
    
    console.log("✅ Updated enquiry status successfully!");
    console.log("New status:", updated.status);
    
    // Revert the change
    await db.update(enquiries)
      .set({ status: testEnquiry[0].status, updatedAt: new Date() })
      .where(eq(enquiries.id, testEnquiry[0].id));
    
    console.log("Reverted status back to original");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  process.exit(0);
}

testEnquiryStatusUpdate();
