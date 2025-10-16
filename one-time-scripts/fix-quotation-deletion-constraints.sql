-- Fix quotation deletion foreign key constraints
-- This script fixes all foreign key constraints that prevent quotation deletion

-- 1. Fix purchase_orders table foreign key constraint
ALTER TABLE purchase_orders 
DROP CONSTRAINT IF EXISTS purchase_orders_quotation_id_quotations_id_fk;

ALTER TABLE purchase_orders 
ADD CONSTRAINT purchase_orders_quotation_id_quotations_id_fk 
FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL;

-- 2. Fix sales_orders table foreign key constraint
ALTER TABLE sales_orders 
DROP CONSTRAINT IF EXISTS sales_orders_quotation_id_quotations_id_fk;

ALTER TABLE sales_orders 
ADD CONSTRAINT sales_orders_quotation_id_quotations_id_fk 
FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL;

-- 3. Fix customer_acceptances table foreign key constraint
ALTER TABLE customer_acceptances 
DROP CONSTRAINT IF EXISTS customer_acceptances_quotation_id_quotations_id_fk;

ALTER TABLE customer_acceptances 
ADD CONSTRAINT customer_acceptances_quotation_id_quotations_id_fk 
FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL;

-- 4. Verify all constraints are properly set
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
  AND tc.table_schema = ccu.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('purchase_orders', 'sales_orders', 'customer_acceptances')
  AND kcu.column_name = 'quotation_id'
ORDER BY tc.table_name;
