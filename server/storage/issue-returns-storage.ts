import { db } from "../db";
import { issueReturns, stockIssue, stockIssueItems, customers, suppliers, items } from "../../shared/schema";
import { eq, desc, and, or, like } from "drizzle-orm";

export class IssueReturnStorage {
  // Get all issue returns
  async getIssueReturns() {
    const results = await db
      .select({
        id: issueReturns.id,
        returnNumber: issueReturns.returnNumber,
        stockIssueId: issueReturns.stockIssueId,
        returnType: issueReturns.returnType,
        priority: issueReturns.priority,
        description: issueReturns.description,
        returnedBy: issueReturns.returnedBy,
        returnDate: issueReturns.returnDate,
        status: issueReturns.status,
        resolution: issueReturns.resolution,
        assignedTo: issueReturns.assignedTo,
        estimatedResolution: issueReturns.estimatedResolution,
        notes: issueReturns.notes,
        createdAt: issueReturns.createdAt,
        updatedAt: issueReturns.updatedAt,
        // Join with stock issue to get issue number
        stockIssueNumber: stockIssue.issueNumber,
        // Join with customer
        customerName: customers.name,
        // Join with supplier
        supplierName: suppliers.name,
      })
      .from(issueReturns)
      .leftJoin(stockIssue, eq(issueReturns.stockIssueId, stockIssue.id))
      .leftJoin(customers, eq(stockIssue.customerId, customers.id))
      .leftJoin(suppliers, eq(stockIssue.supplierId, suppliers.id))
      .orderBy(desc(issueReturns.createdAt));

    return results;
  }

  // Get issue return by ID
  async getIssueReturnById(id: string) {
    const [result] = await db
      .select({
        id: issueReturns.id,
        returnNumber: issueReturns.returnNumber,
        stockIssueId: issueReturns.stockIssueId,
        returnType: issueReturns.returnType,
        priority: issueReturns.priority,
        description: issueReturns.description,
        returnedBy: issueReturns.returnedBy,
        returnDate: issueReturns.returnDate,
        status: issueReturns.status,
        resolution: issueReturns.resolution,
        assignedTo: issueReturns.assignedTo,
        estimatedResolution: issueReturns.estimatedResolution,
        notes: issueReturns.notes,
        createdAt: issueReturns.createdAt,
        updatedAt: issueReturns.updatedAt,
        // Join with stock issue to get issue number
        stockIssueNumber: stockIssue.issueNumber,
        // Join with customer
        customerName: customers.name,
        // Join with supplier
        supplierName: suppliers.name,
      })
      .from(issueReturns)
      .leftJoin(stockIssue, eq(issueReturns.stockIssueId, stockIssue.id))
      .leftJoin(customers, eq(stockIssue.customerId, customers.id))
      .leftJoin(suppliers, eq(stockIssue.supplierId, suppliers.id))
      .where(eq(issueReturns.id, id));

    return result;
  }

  // Create new issue return
  async createIssueReturn(data: any) {
    const [issueReturn] = await db.insert(issueReturns).values({
      returnNumber: data.returnNumber,
      stockIssueId: data.stockIssueId,
      returnType: data.returnType,
      priority: data.priority,
      description: data.description,
      returnedBy: data.returnedBy,
      returnDate: data.returnDate ? new Date(data.returnDate) : new Date(),
      status: data.status || "Open",
      resolution: data.resolution,
      assignedTo: data.assignedTo,
      estimatedResolution: data.estimatedResolution ? new Date(data.estimatedResolution) : null,
      notes: data.notes,
    }).returning();

    return issueReturn;
  }

  // Update issue return
  async updateIssueReturn(id: string, data: any) {
    const [issueReturn] = await db
      .update(issueReturns)
      .set({
        returnNumber: data.returnNumber,
        stockIssueId: data.stockIssueId,
        returnType: data.returnType,
        priority: data.priority,
        description: data.description,
        returnedBy: data.returnedBy,
        returnDate: data.returnDate ? new Date(data.returnDate) : undefined,
        status: data.status,
        resolution: data.resolution,
        assignedTo: data.assignedTo,
        estimatedResolution: data.estimatedResolution ? new Date(data.estimatedResolution) : null,
        notes: data.notes,
        updatedAt: new Date(),
      })
      .where(eq(issueReturns.id, id))
      .returning();

    return issueReturn;
  }

  // Delete issue return
  async deleteIssueReturn(id: string) {
    const [deleted] = await db
      .delete(issueReturns)
      .where(eq(issueReturns.id, id))
      .returning();

    return deleted;
  }

  // Get stock issue details for wizard
  async getStockIssueById(id: string) {
    const [stockIssue] = await db
      .select()
      .from(stockIssue)
      .where(eq(stockIssue.id, id));

    if (!stockIssue) return null;

    // Get stock issue items
    const stockIssueItemsData = await db
      .select()
      .from(stockIssueItems)
      .where(eq(stockIssueItems.stockIssueId, id));

    // Get customer information
    const customer = await db
      .select()
      .from(customers)
      .where(eq(customers.id, stockIssue.customerId))
      .then(rows => rows[0] || null);

    // Get supplier information
    const supplier = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, stockIssue.supplierId))
      .then(rows => rows[0] || null);

    return {
      ...stockIssue,
      items: stockIssueItemsData,
      customer,
      supplier,
    };
  }
}

export const issueReturnStorage = new IssueReturnStorage();
