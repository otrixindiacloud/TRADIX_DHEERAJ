-- Fix invoice foreign key constraints to allow delivery deletion
-- This migration fixes the remaining 500 error when deleting delivery notes

-- Drop existing foreign key constraints on invoices table
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_delivery_id_deliveries_id_fk;

ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_generated_from_delivery_id_deliveries_id_fk;

-- Add foreign key constraints with SET NULL on delete
ALTER TABLE invoices 
ADD CONSTRAINT invoices_delivery_id_deliveries_id_fk 
FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE SET NULL;

ALTER TABLE invoices 
ADD CONSTRAINT invoices_generated_from_delivery_id_deliveries_id_fk 
FOREIGN KEY (generated_from_delivery_id) REFERENCES deliveries(id) ON DELETE SET NULL;

-- Verify the constraints were added
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
  AND tc.table_name = 'invoices'
  AND (kcu.column_name = 'delivery_id' OR kcu.column_name = 'generated_from_delivery_id');
