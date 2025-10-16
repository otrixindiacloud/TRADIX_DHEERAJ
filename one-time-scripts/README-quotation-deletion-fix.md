# Quotation Deletion Fix

This directory contains scripts to fix the quotation deletion issue caused by foreign key constraints.

## Problem
Quotations cannot be deleted because they are referenced by other tables (sales orders, customer acceptances, purchase orders) with foreign key constraints that don't allow deletion.

## Solution
The fix involves two parts:

### 1. Database Schema Fix
Run the SQL script to update foreign key constraints to use `ON DELETE SET NULL` instead of the default `RESTRICT`:

```bash
# Connect to your PostgreSQL database and run:
psql -d your_database_name -f fix-quotation-deletion-constraints.sql
```

Or manually execute the SQL commands in `fix-quotation-deletion-constraints.sql`.

### 2. Code Improvements
The following improvements have been made to the codebase:

#### Backend Changes:
- **`server/storage/quotation-storage.ts`**: Enhanced `deleteQuotation` method with:
  - Transaction support for atomicity
  - Proper error handling for foreign key violations
  - Deletion of related records (quotation items, approvals)
  - Clear error messages for constraint violations

- **`server/routes/quotations.ts`**: Improved DELETE endpoint with:
  - Better error handling and logging
  - Specific error messages for different failure scenarios
  - Proper HTTP status codes (400 for constraint violations, 404 for not found)

#### Frontend Changes:
- **`client/src/pages/quotations.tsx`**: Enhanced error handling:
  - Displays specific error messages from the server
  - Better user feedback for different error scenarios

## Testing
After applying the database fixes, test quotation deletion:

1. Try deleting a quotation with no references - should succeed
2. Try deleting a quotation referenced by sales orders - should show clear error message
3. Try deleting a quotation referenced by customer acceptances - should show clear error message
4. Try deleting a quotation referenced by purchase orders - should show clear error message

## Verification
After running the SQL script, you can verify the constraints were updated correctly by checking the `delete_rule` column in the verification query output. All constraints should show `SET NULL` instead of `RESTRICT`.
