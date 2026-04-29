-- Migration: Add admin RLS policies for viewing all user data
-- Admin is identified by email 'jacksonkyarger@gmail.com'

-- Create a helper function to check if current user is admin
-- Uses public schema since auth schema is managed by Neon
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id::text = auth.user_id()
    AND email = 'jacksonkyarger@gmail.com'
  );
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================
-- USERS TABLE - Admin can read all users
-- ============================================
CREATE POLICY users_admin_select_all ON users
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================
-- ITEMS TABLE - Admin can read all items
-- ============================================
CREATE POLICY items_admin_select_all ON items
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================
-- POSTS TABLE - Admin already has access via posts_select_all
-- No change needed since posts are public
-- ============================================

-- ============================================
-- ITEM_IMAGES TABLE - Admin can read all
-- ============================================
CREATE POLICY item_images_admin_select_all ON item_images
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================
-- WISHLIST_ITEMS TABLE - Admin can read all
-- ============================================
CREATE POLICY wishlist_items_admin_select_all ON wishlist_items
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================
-- WISHLIST_LINKS TABLE - Admin can read all
-- ============================================
CREATE POLICY wishlist_links_admin_select_all ON wishlist_links
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================
-- WISHLIST_IMAGES TABLE - Admin can read all
-- ============================================
CREATE POLICY wishlist_images_admin_select_all ON wishlist_images
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================
-- USER_SELLER_LISTS TABLE - Admin can read all
-- ============================================
CREATE POLICY user_seller_lists_admin_select_all ON user_seller_lists
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================
-- PROFILE_PRIVACY TABLE - Admin can read all
-- ============================================
CREATE POLICY profile_privacy_admin_select_all ON profile_privacy
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================
-- CHARM_CONTRIBUTIONS - Admin can update/review all
-- ============================================
CREATE POLICY charm_contributions_admin_update ON charm_contributions
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
