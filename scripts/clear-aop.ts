import { config } from 'dotenv';
config();

async function main() {
  const { db } = await import('../server/db');
  const { charmDatabase, charmSightings, charmImages } = await import('../server/db/schema');
  const { like } = await import('drizzle-orm');

  // Delete sightings from art-of-pandora
  const sightings = await db.delete(charmSightings).where(like(charmSightings.scrapedBy, 'art-of-pandora'));
  console.log('Deleted art-of-pandora sightings');

  // Delete images from art-of-pandora
  const images = await db.delete(charmImages).where(like(charmImages.uploadedBy, '%art-of-pandora%'));
  console.log('Deleted art-of-pandora images');

  // Delete charms created by art-of-pandora (only if not created by other scrapers)
  const charms = await db.delete(charmDatabase).where(like(charmDatabase.createdBy, 'scraper:art-of-pandora'));
  console.log('Deleted art-of-pandora charms');
}

main().then(() => process.exit(0));
