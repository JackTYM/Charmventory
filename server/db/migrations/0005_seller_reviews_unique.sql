-- Remove duplicate reviews, keeping only the most recent per user/seller
DELETE FROM seller_reviews 
WHERE id NOT IN (
  SELECT DISTINCT ON (seller_id, user_id) id 
  FROM seller_reviews 
  ORDER BY seller_id, user_id, created_at DESC
);

-- Add unique constraint to prevent duplicate reviews
ALTER TABLE seller_reviews ADD CONSTRAINT seller_reviews_seller_user_unique UNIQUE (seller_id, user_id);
