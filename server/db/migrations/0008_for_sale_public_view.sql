-- Migration: Create view for publicly visible for-sale/for-trade items
-- This view exposes only limited fields (name, photo, style ID, status, price)
-- for items marked as for_sale or for_trade

-- Create a view that only exposes safe fields for for-sale/trade items
CREATE OR REPLACE VIEW items_for_sale_public AS
SELECT 
  i.id,
  i.user_id,
  i.name,
  i.item_number,
  i.type,
  i.is_for_sale,
  i.is_for_trade,
  i.asking_price,
  (
    SELECT img.url 
    FROM item_images img 
    WHERE img.item_id = i.id 
    ORDER BY img.sort_order ASC, img.created_at ASC 
    LIMIT 1
  ) as primary_image
FROM items i
WHERE i.is_for_sale = true OR i.is_for_trade = true;

-- Grant access to the view
GRANT SELECT ON items_for_sale_public TO authenticated;
GRANT SELECT ON items_for_sale_public TO anonymous;

-- Add RLS policy for items to allow reading for-sale/for-trade items from other users
-- This supplements the existing items_select_own policy
CREATE POLICY items_select_for_sale ON items
  FOR SELECT TO authenticated
  USING (
    (is_for_sale = true OR is_for_trade = true)
    AND user_id::text != auth.user_id()
  );

-- Also need to allow reading item_images for for-sale items
CREATE POLICY item_images_select_for_sale ON item_images
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = item_images.item_id
      AND (items.is_for_sale = true OR items.is_for_trade = true)
    )
  );
