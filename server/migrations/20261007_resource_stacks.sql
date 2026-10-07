-- Inventory holdings are independent of the 999-unit market lot limit.
ALTER TABLE owned_items DROP CONSTRAINT IF EXISTS owned_items_quantity_check;
ALTER TABLE owned_items ADD CONSTRAINT owned_items_quantity_check CHECK (quantity BETWEEN 1 AND 2147483647);
