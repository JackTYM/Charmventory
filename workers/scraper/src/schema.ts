import { pgTable, text, timestamp, boolean, decimal, uuid, pgEnum, index } from 'drizzle-orm/pg-core'

export const itemTypeEnum = pgEnum('item_type', [
  'charm', 'clip', 'murano', 'safety_chain', 'spacer', 'earring', 'necklace',
  'bracelet', 'bangle', 'ring', 'brooch', 'pendant', 'watch', 'ornament', 'keychain',
  'box', 'catalogue', 'gift_with_purchase', 'other'
])

export const charmImageTypeEnum = pgEnum('charm_image_type', ['official', 'community', 'catalog'])

export const charmDatabase = pgTable('charm_database', {
  styleId: text('style_id').primaryKey(),
  name: text('name').notNull(),
  brand: text('brand').default('Pandora'),
  collection: text('collection'),
  type: itemTypeEnum('type').default('charm'),
  releaseDate: timestamp('release_date'),
  discontinueDate: timestamp('discontinue_date'),
  catalogueSeason: text('catalogue_season'),
  originalPrice: decimal('original_price', { precision: 10, scale: 2 }),
  currency: text('currency').default('USD'),
  region: text('region'),
  materials: text('materials'),
  colors: text('colors'),
  description: text('description'),
  isLimited: boolean('is_limited').default(false),
  isCountryExclusive: boolean('is_country_exclusive').default(false),
  exclusiveCountry: text('exclusive_country'),
  isRetired: boolean('is_retired').default(false),
  processing: boolean('processing').default(false),
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
