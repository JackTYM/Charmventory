-- Migration: Add DELETE and UPDATE RLS policies for sellers table
-- Only the creator of a seller can update or delete it

-- Users can update their own sellers
CREATE POLICY sellers_update_own ON sellers
  FOR UPDATE TO authenticated
  USING (created_by::text = auth.user_id())
  WITH CHECK (created_by::text = auth.user_id());

-- Users can delete their own sellers
CREATE POLICY sellers_delete_own ON sellers
  FOR DELETE TO authenticated
  USING (created_by::text = auth.user_id());
