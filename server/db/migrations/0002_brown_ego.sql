CREATE TABLE "charm_sightings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"style_id" text NOT NULL,
	"catalog_id" uuid,
	"catalog_name" text,
	"year" integer,
	"season" text,
	"region" text,
	"page_number" integer,
	"extracted_name" text,
	"extracted_price" numeric(10, 2),
	"extracted_currency" text DEFAULT 'USD',
	"extracted_description" text,
	"image_url" text,
	"source_url" text,
	"scraped_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "charm_sightings" ADD CONSTRAINT "charm_sightings_catalog_id_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."catalogs"("id") ON DELETE set null ON UPDATE no action;