ALTER TYPE "public"."item_type" ADD VALUE 'spacer' BEFORE 'earring';--> statement-breakpoint
ALTER TABLE "charm_database" ADD COLUMN "processing" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "charm_sightings" ADD CONSTRAINT "charm_sightings_style_id_charm_database_style_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."charm_database"("style_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "charm_db_name_idx" ON "charm_database" USING btree ("name");--> statement-breakpoint
CREATE INDEX "charm_db_collection_idx" ON "charm_database" USING btree ("collection");--> statement-breakpoint
CREATE INDEX "charm_db_type_idx" ON "charm_database" USING btree ("type");--> statement-breakpoint
CREATE INDEX "charm_db_created_at_idx" ON "charm_database" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "charm_images_style_id_idx" ON "charm_images" USING btree ("style_id");--> statement-breakpoint
CREATE INDEX "charm_images_approved_idx" ON "charm_images" USING btree ("approved");--> statement-breakpoint
CREATE INDEX "charm_sightings_style_id_idx" ON "charm_sightings" USING btree ("style_id");--> statement-breakpoint
CREATE INDEX "charm_sightings_scraped_by_idx" ON "charm_sightings" USING btree ("scraped_by");--> statement-breakpoint
CREATE INDEX "charm_sightings_created_at_idx" ON "charm_sightings" USING btree ("created_at");