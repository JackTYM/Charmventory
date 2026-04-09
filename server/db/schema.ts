import { pgTable, text, timestamp, boolean, integer, decimal, uuid, pgEnum, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Enums
export const itemTypeEnum = pgEnum('item_type', [
  'charm', 'clip', 'murano', 'safety_chain', 'spacer', 'earring', 'necklace',
  'bracelet', 'bangle', 'ring', 'brooch', 'pendant', 'watch', 'ornament', 'keychain',
  'box', 'catalogue', 'gift_with_purchase', 'other'
])

export const conditionEnum = pgEnum('condition', [
  'new', 'like_new', 'good', 'fair', 'poor'
])

export const authenticEnum = pgEnum('authentic', ['yes', 'no', 'unknown'])

export const priorityEnum = pgEnum('priority', ['high', 'medium', 'low'])

export const imageCategoryEnum = pgEnum('image_category', [
  'item', 'receipt', 'hallmark', 'damage', 'other'
])

export const sellerListTypeEnum = pgEnum('seller_list_type', ['preferred', 'do_not_buy'])

export const sourceTypeEnum = pgEnum('source_type', ['authorized_retailer', 'reseller', 'personal_shopper', 'private_seller'])

export const privacySectionEnum = pgEnum('privacy_section', [
  'collection', 'wishlist', 'for_sale', 'preferred_sellers', 'do_not_buy'
])

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(), // User ID
  email: text('email').notNull().unique(),
  name: text('name'),
  slug: text('slug'), // URL-friendly username
  avatar: text('avatar'),
  bio: text('bio'),
  socialLinks: text('social_links'), // JSON string of social links
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Items (owned collection)
export const items = pgTable('items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // Basic info
  type: itemTypeEnum('type').notNull().default('charm'),
  name: text('name').notNull(),
  brand: text('brand').default('Pandora'),
  itemNumber: text('item_number'), // Style ID
  collection: text('collection'), // Moments, Essence, Timeless, ME, etc.
  description: text('description'),

  // Details
  materials: text('materials'), // JSON array
  color: text('color'),
  collaboration: text('collaboration'), // Disney, Marvel, etc.
  catalogueRelease: text('catalogue_release'), // Season/year
  hallmarkVisible: text('hallmark_visible'),

  // Pricing
  originalPrice: decimal('original_price', { precision: 10, scale: 2 }),
  pricePaid: decimal('price_paid', { precision: 10, scale: 2 }),
  currentValue: decimal('current_value', { precision: 10, scale: 2 }),

  // Inventory
  amountOnHand: integer('amount_on_hand').default(1),
  condition: conditionEnum('condition').default('new'),
  damageNotes: text('damage_notes'),

  // Rarity & Edition
  rarity: integer('rarity').default(1), // 1-3 scale
  isLimited: boolean('is_limited').default(false),
  isCountryExclusive: boolean('is_country_exclusive').default(false),
  countryExclusive: text('country_exclusive'),

  // Gift with Purchase
  isGiftWithPurchase: boolean('is_gift_with_purchase').default(false),
  isNumberedGwp: boolean('is_numbered_gwp').default(false),
  gwpNumber: text('gwp_number'),

  // Physical
  weightGrams: decimal('weight_grams', { precision: 6, scale: 2 }),
  size: text('size'), // Bangle 1-3, Ring 46-64, Bracelet 16-23

  // Authenticity
  isAuthentic: authenticEnum('is_authentic').default('yes'),
  authenticationStatus: text('authentication_status'),
  authenticatedBy: text('authenticated_by'),

  // Purchase info
  source: text('source'), // Pandora.net, in-store, Mercari, etc.
  sourceName: text('source_name'), // Store name or seller
  datePurchased: timestamp('date_purchased'),

  // Warranty & Care
  warrantyEnd: timestamp('warranty_end'),
  warrantyContact: text('warranty_contact'),
  carePlanEnd: timestamp('care_plan_end'),
  carePlanYears: integer('care_plan_years'),

  // Notes
  notes: text('notes'),
  customMetadata: text('custom_metadata'), // JSON for custom fields

  // For sale/trade
  isForSale: boolean('is_for_sale').default(false),
  isForTrade: boolean('is_for_trade').default(false),
  askingPrice: decimal('asking_price', { precision: 10, scale: 2 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Item Images
export const itemImages = pgTable('item_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  category: imageCategoryEnum('category').default('item'),
  caption: text('caption'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Wishlist Items
export const wishlistItems = pgTable('wishlist_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  name: text('name').notNull(),
  itemNumber: text('item_number'), // Style ID if known
  collection: text('collection'),
  materials: text('materials'),

  estimatedPrice: decimal('estimated_price', { precision: 10, scale: 2 }),
  priority: priorityEnum('priority').default('medium'),
  quantityWanted: integer('quantity_wanted').default(1),

  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Wishlist Links (where item is for sale)
export const wishlistLinks = pgTable('wishlist_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  wishlistItemId: uuid('wishlist_item_id').notNull().references(() => wishlistItems.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  screenshotUrl: text('screenshot_url'),
  price: decimal('price', { precision: 10, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Wishlist Images
export const wishlistImages = pgTable('wishlist_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  wishlistItemId: uuid('wishlist_item_id').notNull().references(() => wishlistItems.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  caption: text('caption'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Sellers (global, shared across users)
export const sellers = pgTable('sellers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  sourceType: sourceTypeEnum('source_type'), // Authorized Retailer, Reseller, Personal Shopper
  platform: text('platform'), // Etsy, Mercari, eBay, Instagram, etc.
  url: text('url'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Seller Reviews (public vouching system)
export const sellerReviews = pgTable('seller_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  isVouch: boolean('is_vouch').notNull(), // true = vouch, false = warn
  message: text('message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// User Seller Lists (personal preferred/do-not-buy lists)
export const userSellerLists = pgTable('user_seller_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sellerId: uuid('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  listType: sellerListTypeEnum('list_type').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Posts (social feed)
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content'),
  postType: text('post_type'), // new_charm, bracelet_build, bag_photo, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Post Images
export const postImages = pgTable('post_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  caption: text('caption'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Post Item Tags (linking posts to Style IDs)
export const postItemTags = pgTable('post_item_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  itemNumber: text('item_number').notNull(), // Style ID
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Profile Privacy Settings
export const profilePrivacy = pgTable('profile_privacy', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  section: privacySectionEnum('section').notNull(),
  isPublic: boolean('is_public').default(true),
})

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  items: many(items),
  wishlistItems: many(wishlistItems),
  sellerReviews: many(sellerReviews),
  userSellerLists: many(userSellerLists),
  posts: many(posts),
  privacySettings: many(profilePrivacy),
}))

export const itemsRelations = relations(items, ({ one, many }) => ({
  user: one(users, { fields: [items.userId], references: [users.id] }),
  images: many(itemImages),
}))

export const itemImagesRelations = relations(itemImages, ({ one }) => ({
  item: one(items, { fields: [itemImages.itemId], references: [items.id] }),
}))

export const wishlistItemsRelations = relations(wishlistItems, ({ one, many }) => ({
  user: one(users, { fields: [wishlistItems.userId], references: [users.id] }),
  links: many(wishlistLinks),
  images: many(wishlistImages),
}))

export const wishlistLinksRelations = relations(wishlistLinks, ({ one }) => ({
  wishlistItem: one(wishlistItems, { fields: [wishlistLinks.wishlistItemId], references: [wishlistItems.id] }),
}))

export const wishlistImagesRelations = relations(wishlistImages, ({ one }) => ({
  wishlistItem: one(wishlistItems, { fields: [wishlistImages.wishlistItemId], references: [wishlistItems.id] }),
}))

export const sellersRelations = relations(sellers, ({ many }) => ({
  reviews: many(sellerReviews),
  userLists: many(userSellerLists),
}))

export const sellerReviewsRelations = relations(sellerReviews, ({ one }) => ({
  seller: one(sellers, { fields: [sellerReviews.sellerId], references: [sellers.id] }),
  user: one(users, { fields: [sellerReviews.userId], references: [users.id] }),
}))

export const userSellerListsRelations = relations(userSellerLists, ({ one }) => ({
  user: one(users, { fields: [userSellerLists.userId], references: [users.id] }),
  seller: one(sellers, { fields: [userSellerLists.sellerId], references: [sellers.id] }),
}))

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, { fields: [posts.userId], references: [users.id] }),
  images: many(postImages),
  itemTags: many(postItemTags),
}))

export const postImagesRelations = relations(postImages, ({ one }) => ({
  post: one(posts, { fields: [postImages.postId], references: [posts.id] }),
}))

export const postItemTagsRelations = relations(postItemTags, ({ one }) => ({
  post: one(posts, { fields: [postItemTags.postId], references: [posts.id] }),
}))

export const profilePrivacyRelations = relations(profilePrivacy, ({ one }) => ({
  user: one(users, { fields: [profilePrivacy.userId], references: [users.id] }),
}))

// ============================================
// CROWDSOURCED CHARM DATABASE
// ============================================

export const contributionStatusEnum = pgEnum('contribution_status', ['pending', 'approved', 'rejected'])

export const charmImageTypeEnum = pgEnum('charm_image_type', ['official', 'community', 'catalog'])

// Global charm database (crowdsourced)
export const charmDatabase = pgTable('charm_database', {
  styleId: text('style_id').primaryKey(), // e.g., "798469C01"
  name: text('name').notNull(),
  brand: text('brand').default('Pandora'),
  collection: text('collection'),
  type: itemTypeEnum('type').default('charm'),

  // Release info
  releaseDate: timestamp('release_date'),
  discontinueDate: timestamp('discontinue_date'),
  catalogueSeason: text('catalogue_season'), // e.g., "Spring 2024"

  // Pricing
  originalPrice: decimal('original_price', { precision: 10, scale: 2 }),
  currency: text('currency').default('USD'),
  region: text('region'), // US, UK, EU, etc.

  // Details
  materials: text('materials'), // JSON array
  colors: text('colors'), // JSON array
  description: text('description'),

  // Flags
  isLimited: boolean('is_limited').default(false),
  isCountryExclusive: boolean('is_country_exclusive').default(false),
  exclusiveCountry: text('exclusive_country'),
  isRetired: boolean('is_retired').default(false),
  processing: boolean('processing').default(false), // True while scraper is still adding data

  // Metadata
  createdBy: text('created_by'),
  verified: boolean('verified').default(false),
  verifiedBy: text('verified_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('charm_db_name_idx').on(table.name),
  index('charm_db_collection_idx').on(table.collection),
  index('charm_db_type_idx').on(table.type),
  index('charm_db_created_at_idx').on(table.createdAt),
])

// Charm images (community-contributed)
export const charmImages = pgTable('charm_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  styleId: text('style_id').notNull().references(() => charmDatabase.styleId, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  imageType: charmImageTypeEnum('image_type').default('community'),
  caption: text('caption'),
  uploadedBy: text('uploaded_by'),
  approved: boolean('approved').default(false),
  approvedBy: text('approved_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('charm_images_style_id_idx').on(table.styleId),
  index('charm_images_approved_idx').on(table.approved),
])

export const revisionStatusEnum = pgEnum('revision_status', ['pending', 'approved', 'rejected'])

// Catalogs (base record for year/season/region combo)
export const catalogs = pgTable('catalogs', {
  id: uuid('id').primaryKey().defaultRandom(),
  year: integer('year').notNull(),
  season: text('season').notNull(), // Spring, Summer, Autumn, Winter, Valentine's Day, etc.
  region: text('region').default('US'), // US, UK, EU, AU, Asia, Other
  currentRevisionId: uuid('current_revision_id'), // Points to the active approved revision
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Catalog revisions (each PDF version)
export const catalogRevisions = pgTable('catalog_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  catalogId: uuid('catalog_id').notNull().references(() => catalogs.id, { onDelete: 'cascade' }),
  pdfUrl: text('pdf_url').notNull(), // URL to the stored PDF
  pageCount: integer('page_count').default(0),
  hasOcr: boolean('has_ocr').default(false), // Whether PDF has selectable text
  ocrText: text('ocr_text'), // Full-text for search indexing
  revisionNote: text('revision_note'), // What changed in this revision
  status: revisionStatusEnum('status').default('pending'),
  reviewedBy: text('reviewed_by'), // Admin who approved/rejected
  reviewNote: text('review_note'), // Reason for rejection
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
})

// Catalog pages (legacy - for individual page uploads, will be converted to PDF)
export const catalogPages = pgTable('catalog_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  catalogName: text('catalog_name').notNull(), // e.g., "Spring/Summer 2024"
  year: integer('year').notNull(),
  season: text('season'), // Spring, Summer, Fall, Winter
  region: text('region'), // US, UK, EU, etc.
  pageNumber: integer('page_number'),
  imageUrl: text('image_url').notNull(),
  ocrText: text('ocr_text'), // OCR-extracted text from the page
  uploadedBy: text('uploaded_by'),
  approved: boolean('approved').default(false),
  approvedBy: text('approved_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Charm contributions (pending changes/additions)
export const charmContributions = pgTable('charm_contributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  styleId: text('style_id').notNull(), // May not exist yet if new charm
  contributionType: text('contribution_type').notNull(), // 'new_charm', 'edit_field', 'add_image'
  field: text('field'), // Which field being edited
  oldValue: text('old_value'),
  newValue: text('new_value'),
  imageUrl: text('image_url'), // For image contributions
  notes: text('notes'),
  contributedBy: text('contributed_by').notNull(),
  status: contributionStatusEnum('status').default('pending'),
  reviewedBy: text('reviewed_by'),
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
})

// Charm database relations
export const charmDatabaseRelations = relations(charmDatabase, ({ one, many }) => ({
  creator: one(users, { fields: [charmDatabase.createdBy], references: [users.id] }),
  verifier: one(users, { fields: [charmDatabase.verifiedBy], references: [users.id] }),
  images: many(charmImages),
  sightings: many(charmSightings),
}))

export const charmImagesRelations = relations(charmImages, ({ one }) => ({
  charm: one(charmDatabase, { fields: [charmImages.styleId], references: [charmDatabase.styleId] }),
  uploader: one(users, { fields: [charmImages.uploadedBy], references: [users.id] }),
}))

export const catalogsRelations = relations(catalogs, ({ one, many }) => ({
  currentRevision: one(catalogRevisions, { fields: [catalogs.currentRevisionId], references: [catalogRevisions.id] }),
  revisions: many(catalogRevisions),
}))

export const catalogRevisionsRelations = relations(catalogRevisions, ({ one }) => ({
  catalog: one(catalogs, { fields: [catalogRevisions.catalogId], references: [catalogs.id] }),
}))

export const catalogPagesRelations = relations(catalogPages, ({ one }) => ({
  uploader: one(users, { fields: [catalogPages.uploadedBy], references: [users.id] }),
}))

export const charmContributionsRelations = relations(charmContributions, ({ one }) => ({
  contributor: one(users, { fields: [charmContributions.contributedBy], references: [users.id] }),
  reviewer: one(users, { fields: [charmContributions.reviewedBy], references: [users.id] }),
}))

// ============================================
// CHARM SIGHTINGS (every catalog appearance)
// ============================================

// Track every time a charm is seen in a catalog
export const charmSightings = pgTable('charm_sightings', {
  id: uuid('id').primaryKey().defaultRandom(),
  styleId: text('style_id').notNull().references(() => charmDatabase.styleId, { onDelete: 'cascade' }), // FK to charm_database

  // Catalog reference
  catalogId: uuid('catalog_id').references(() => catalogs.id, { onDelete: 'set null' }),
  catalogName: text('catalog_name'), // e.g., "Spring 2024 US"
  year: integer('year'),
  season: text('season'),
  region: text('region'),
  pageNumber: integer('page_number'),

  // Extracted data from this specific sighting
  extractedName: text('extracted_name'),
  extractedPrice: decimal('extracted_price', { precision: 10, scale: 2 }),
  extractedCurrency: text('extracted_currency').default('USD'),
  extractedDescription: text('extracted_description'),
  imageUrl: text('image_url'), // Image from this catalog

  // Source tracking
  sourceUrl: text('source_url'), // Direct link to catalog/page
  scrapedBy: text('scraped_by'), // Which scraper found this

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('charm_sightings_style_id_idx').on(table.styleId),
  index('charm_sightings_scraped_by_idx').on(table.scrapedBy),
  index('charm_sightings_created_at_idx').on(table.createdAt),
])

export const charmSightingsRelations = relations(charmSightings, ({ one }) => ({
  charm: one(charmDatabase, { fields: [charmSightings.styleId], references: [charmDatabase.styleId] }),
  catalog: one(catalogs, { fields: [charmSightings.catalogId], references: [catalogs.id] }),
}))
