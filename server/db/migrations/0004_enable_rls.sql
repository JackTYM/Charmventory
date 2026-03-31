-- Migration: Enable Row-Level Security for Data API
-- This migration enables RLS on all user-owned tables and creates
-- policies that use auth.user_id() from Neon Auth JWTs

-- Create authenticated role if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated;
  END IF;
END
$$;

-- Create anonymous role if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anonymous') THEN
    CREATE ROLE anonymous;
  END IF;
END
$$;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anonymous;

-- Grant permissions on all tables to authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Grant read-only on public tables to anonymous
GRANT SELECT ON charm_database, charm_images, charm_sightings, catalogs, catalog_revisions, catalog_pages, sellers TO anonymous;

-- Grant sequence usage for identity columns
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- ============================================
-- USERS TABLE
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY users_select_own ON users
  FOR SELECT TO authenticated
  USING (id::text = auth.user_id());

-- Users can update their own profile
CREATE POLICY users_update_own ON users
  FOR UPDATE TO authenticated
  USING (id::text = auth.user_id())
  WITH CHECK (id::text = auth.user_id());

-- Users can insert their own profile (on first login)
CREATE POLICY users_insert_own ON users
  FOR INSERT TO authenticated
  WITH CHECK (id::text = auth.user_id());

-- Public profiles can be read by anyone (for profile pages)
CREATE POLICY users_select_public ON users
  FOR SELECT TO authenticated
  USING (true);

-- ============================================
-- ITEMS TABLE (user's collection)
-- ============================================
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Users can read their own items
CREATE POLICY items_select_own ON items
  FOR SELECT TO authenticated
  USING (user_id::text = auth.user_id());

-- Users can insert their own items
CREATE POLICY items_insert_own ON items
  FOR INSERT TO authenticated
  WITH CHECK (user_id::text = auth.user_id());

-- Users can update their own items
CREATE POLICY items_update_own ON items
  FOR UPDATE TO authenticated
  USING (user_id::text = auth.user_id())
  WITH CHECK (user_id::text = auth.user_id());

-- Users can delete their own items
CREATE POLICY items_delete_own ON items
  FOR DELETE TO authenticated
  USING (user_id::text = auth.user_id());

-- ============================================
-- ITEM_IMAGES TABLE
-- ============================================
ALTER TABLE item_images ENABLE ROW LEVEL SECURITY;

-- Users can manage images for their items
CREATE POLICY item_images_all ON item_images
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = item_images.item_id
      AND items.user_id::text = auth.user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM items
      WHERE items.id = item_images.item_id
      AND items.user_id::text = auth.user_id()
    )
  );

-- ============================================
-- WISHLIST_ITEMS TABLE
-- ============================================
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY wishlist_items_all ON wishlist_items
  FOR ALL TO authenticated
  USING (user_id::text = auth.user_id())
  WITH CHECK (user_id::text = auth.user_id());

-- ============================================
-- WISHLIST_LINKS TABLE
-- ============================================
ALTER TABLE wishlist_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY wishlist_links_all ON wishlist_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wishlist_items
      WHERE wishlist_items.id = wishlist_links.wishlist_item_id
      AND wishlist_items.user_id::text = auth.user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wishlist_items
      WHERE wishlist_items.id = wishlist_links.wishlist_item_id
      AND wishlist_items.user_id::text = auth.user_id()
    )
  );

-- ============================================
-- WISHLIST_IMAGES TABLE
-- ============================================
ALTER TABLE wishlist_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY wishlist_images_all ON wishlist_images
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wishlist_items
      WHERE wishlist_items.id = wishlist_images.wishlist_item_id
      AND wishlist_items.user_id::text = auth.user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wishlist_items
      WHERE wishlist_items.id = wishlist_images.wishlist_item_id
      AND wishlist_items.user_id::text = auth.user_id()
    )
  );

-- ============================================
-- SELLERS TABLE (shared, public read)
-- ============================================
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

-- Anyone can read sellers
CREATE POLICY sellers_select_all ON sellers
  FOR SELECT TO authenticated
  USING (true);

-- Authenticated users can create sellers
CREATE POLICY sellers_insert ON sellers
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Anonymous can read sellers
CREATE POLICY sellers_select_anonymous ON sellers
  FOR SELECT TO anonymous
  USING (true);

-- ============================================
-- SELLER_REVIEWS TABLE
-- ============================================
ALTER TABLE seller_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews
CREATE POLICY seller_reviews_select_all ON seller_reviews
  FOR SELECT TO authenticated
  USING (true);

-- Users can manage their own reviews
CREATE POLICY seller_reviews_insert_own ON seller_reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id::text = auth.user_id());

CREATE POLICY seller_reviews_update_own ON seller_reviews
  FOR UPDATE TO authenticated
  USING (user_id::text = auth.user_id())
  WITH CHECK (user_id::text = auth.user_id());

CREATE POLICY seller_reviews_delete_own ON seller_reviews
  FOR DELETE TO authenticated
  USING (user_id::text = auth.user_id());

-- ============================================
-- USER_SELLER_LISTS TABLE (personal lists)
-- ============================================
ALTER TABLE user_seller_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_seller_lists_all ON user_seller_lists
  FOR ALL TO authenticated
  USING (user_id::text = auth.user_id())
  WITH CHECK (user_id::text = auth.user_id());

-- ============================================
-- POSTS TABLE (social feed)
-- ============================================
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read posts (public feed)
CREATE POLICY posts_select_all ON posts
  FOR SELECT TO authenticated
  USING (true);

-- Users can manage their own posts
CREATE POLICY posts_insert_own ON posts
  FOR INSERT TO authenticated
  WITH CHECK (user_id::text = auth.user_id());

CREATE POLICY posts_update_own ON posts
  FOR UPDATE TO authenticated
  USING (user_id::text = auth.user_id())
  WITH CHECK (user_id::text = auth.user_id());

CREATE POLICY posts_delete_own ON posts
  FOR DELETE TO authenticated
  USING (user_id::text = auth.user_id());

-- ============================================
-- POST_IMAGES TABLE
-- ============================================
ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;

-- Anyone can read post images
CREATE POLICY post_images_select_all ON post_images
  FOR SELECT TO authenticated
  USING (true);

-- Users can manage images for their posts
CREATE POLICY post_images_insert_own ON post_images
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_images.post_id
      AND posts.user_id::text = auth.user_id()
    )
  );

CREATE POLICY post_images_update_own ON post_images
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_images.post_id
      AND posts.user_id::text = auth.user_id()
    )
  );

CREATE POLICY post_images_delete_own ON post_images
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_images.post_id
      AND posts.user_id::text = auth.user_id()
    )
  );

-- ============================================
-- POST_ITEM_TAGS TABLE
-- ============================================
ALTER TABLE post_item_tags ENABLE ROW LEVEL SECURITY;

-- Anyone can read tags
CREATE POLICY post_item_tags_select_all ON post_item_tags
  FOR SELECT TO authenticated
  USING (true);

-- Users can manage tags for their posts
CREATE POLICY post_item_tags_insert_own ON post_item_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_item_tags.post_id
      AND posts.user_id::text = auth.user_id()
    )
  );

CREATE POLICY post_item_tags_delete_own ON post_item_tags
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_item_tags.post_id
      AND posts.user_id::text = auth.user_id()
    )
  );

-- ============================================
-- PROFILE_PRIVACY TABLE
-- ============================================
ALTER TABLE profile_privacy ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_privacy_all ON profile_privacy
  FOR ALL TO authenticated
  USING (user_id::text = auth.user_id())
  WITH CHECK (user_id::text = auth.user_id());

-- ============================================
-- PUBLIC CHARM DATABASE (read-only for all)
-- ============================================
ALTER TABLE charm_database ENABLE ROW LEVEL SECURITY;

CREATE POLICY charm_database_select_all ON charm_database
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY charm_database_select_anonymous ON charm_database
  FOR SELECT TO anonymous
  USING (true);

-- ============================================
-- CHARM_IMAGES (read-only for all)
-- ============================================
ALTER TABLE charm_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY charm_images_select_all ON charm_images
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY charm_images_select_anonymous ON charm_images
  FOR SELECT TO anonymous
  USING (true);

-- ============================================
-- CHARM_SIGHTINGS (read-only for all)
-- ============================================
ALTER TABLE charm_sightings ENABLE ROW LEVEL SECURITY;

CREATE POLICY charm_sightings_select_all ON charm_sightings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY charm_sightings_select_anonymous ON charm_sightings
  FOR SELECT TO anonymous
  USING (true);

-- ============================================
-- CATALOGS (read-only for all)
-- ============================================
ALTER TABLE catalogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalogs_select_all ON catalogs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY catalogs_select_anonymous ON catalogs
  FOR SELECT TO anonymous
  USING (true);

-- ============================================
-- CATALOG_REVISIONS (read-only for all)
-- ============================================
ALTER TABLE catalog_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_revisions_select_all ON catalog_revisions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY catalog_revisions_select_anonymous ON catalog_revisions
  FOR SELECT TO anonymous
  USING (true);

-- ============================================
-- CATALOG_PAGES (read-only for all)
-- ============================================
ALTER TABLE catalog_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_pages_select_all ON catalog_pages
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY catalog_pages_select_anonymous ON catalog_pages
  FOR SELECT TO anonymous
  USING (true);

-- ============================================
-- CHARM_CONTRIBUTIONS
-- ============================================
ALTER TABLE charm_contributions ENABLE ROW LEVEL SECURITY;

-- Anyone can read contributions
CREATE POLICY charm_contributions_select_all ON charm_contributions
  FOR SELECT TO authenticated
  USING (true);

-- Authenticated users can create contributions
CREATE POLICY charm_contributions_insert ON charm_contributions
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Users can update/delete their own pending contributions
CREATE POLICY charm_contributions_update_own ON charm_contributions
  FOR UPDATE TO authenticated
  USING (contributed_by = auth.user_id() AND status = 'pending')
  WITH CHECK (contributed_by = auth.user_id() AND status = 'pending');

CREATE POLICY charm_contributions_delete_own ON charm_contributions
  FOR DELETE TO authenticated
  USING (contributed_by = auth.user_id() AND status = 'pending');

-- Refresh Data API schema cache after migration
-- Note: Run this manually or via API after migration:
-- PATCH /projects/{project_id}/branches/{branch_id}/data-api/{database_name}
