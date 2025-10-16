-- Fix delivery note deletion by adding CASCADE DELETE constraints
-- This migration fixes the 500 error when deleting delivery notes

-- First, clean up orphaned records in delivery_item table
DELETE FROM delivery_item 
WHERE delivery_id NOT IN (SELECT id FROM deliveries);

-- Drop the existing foreign key constraint on delivery_items.delivery_id
ALTER TABLE delivery_items 
DROP CONSTRAINT IF EXISTS delivery_items_delivery_id_deliveries_id_fk;

-- Add the foreign key constraint with CASCADE DELETE
ALTER TABLE delivery_items 
ADD CONSTRAINT delivery_items_delivery_id_deliveries_id_fk 
FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE;

-- Also ensure the legacy delivery_item table has proper cascade delete
-- (if it exists from the old schema)
ALTER TABLE delivery_item 
DROP CONSTRAINT IF EXISTS delivery_item_delivery_id_deliveries_id_fk;

ALTER TABLE delivery_item 
ADD CONSTRAINT delivery_item_delivery_id_deliveries_id_fk 
FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE;

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
  AND (tc.table_name = 'delivery_items' OR tc.table_name = 'delivery_item')
  AND kcu.column_name = 'delivery_id';
