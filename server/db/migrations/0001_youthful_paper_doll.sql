CREATE TYPE "public"."charm_image_type" AS ENUM('official', 'community', 'catalog');--> statement-breakpoint
CREATE TYPE "public"."contribution_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."revision_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('authorized_retailer', 'reseller', 'personal_shopper', 'private_seller');--> statement-breakpoint
ALTER TYPE "public"."item_type" ADD VALUE 'ornament' BEFORE 'box';--> statement-breakpoint
ALTER TYPE "public"."item_type" ADD VALUE 'keychain' BEFORE 'box';--> statement-breakpoint
CREATE TABLE "catalog_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_name" text NOT NULL,
	"year" integer NOT NULL,
	"season" text,
	"region" text,
	"page_number" integer,
	"image_url" text NOT NULL,
	"ocr_text" text,
	"uploaded_by" text,
	"approved" boolean DEFAULT false,
	"approved_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_id" uuid NOT NULL,
	"pdf_url" text NOT NULL,
	"page_count" integer DEFAULT 0,
	"has_ocr" boolean DEFAULT false,
	"ocr_text" text,
	"revision_note" text,
	"status" "revision_status" DEFAULT 'pending',
	"reviewed_by" text,
	"review_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "catalogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"season" text NOT NULL,
	"region" text DEFAULT 'US',
	"current_revision_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charm_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"style_id" text NOT NULL,
	"contribution_type" text NOT NULL,
	"field" text,
	"old_value" text,
	"new_value" text,
	"image_url" text,
	"notes" text,
	"contributed_by" text NOT NULL,
	"status" "contribution_status" DEFAULT 'pending',
	"reviewed_by" text,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "charm_database" (
	"style_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brand" text DEFAULT 'Pandora',
	"collection" text,
	"type" "item_type" DEFAULT 'charm',
	"release_date" timestamp,
	"discontinue_date" timestamp,
	"catalogue_season" text,
	"original_price" numeric(10, 2),
	"currency" text DEFAULT 'USD',
	"region" text,
	"materials" text,
	"colors" text,
	"description" text,
	"is_limited" boolean DEFAULT false,
	"is_country_exclusive" boolean DEFAULT false,
	"exclusive_country" text,
	"is_retired" boolean DEFAULT false,
	"created_by" text,
	"verified" boolean DEFAULT false,
	"verified_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charm_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"style_id" text NOT NULL,
	"url" text NOT NULL,
	"image_type" charm_image_type DEFAULT 'community',
	"caption" text,
	"uploaded_by" text,
	"approved" boolean DEFAULT false,
	"approved_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "profile_privacy" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "seller_reviews" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "user_seller_lists" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "wishlist_items" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "is_gift_with_purchase" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "is_numbered_gwp" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "gwp_number" text;--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "source_type" "source_type";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "catalog_revisions" ADD CONSTRAINT "catalog_revisions_catalog_id_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."catalogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charm_images" ADD CONSTRAINT "charm_images_style_id_charm_database_style_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."charm_database"("style_id") ON DELETE cascade ON UPDATE no action;