-- Fix sales orders foreign key constraints to allow quotation deletion
-- This migration fixes the remaining 500 error when deleting quotations

-- Drop existing foreign key constraint on sales_orders table
ALTER TABLE sales_orders 
DROP CONSTRAINT IF EXISTS sales_orders_quotation_id_quotations_id_fk;

-- Add foreign key constraint with SET NULL on delete
ALTER TABLE sales_orders 
ADD CONSTRAINT sales_orders_quotation_id_quotations_id_fk 
FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL;

-- Verify the constraint was added
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'sales_orders'
  AND kcu.column_name = 'quotation_id';
