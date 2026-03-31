import { config } from 'dotenv';
config();

async function main() {
  const { db } = await import('../server/db');
  const { charmDatabase, charmSightings } = await import('../server/db/schema');
  const { eq } = await import('drizzle-orm');

  const charm = await db.select().from(charmDatabase).where(eq(charmDatabase.styleId, '797561CZ'));
  console.log('Charm:', JSON.stringify(charm, null, 2));

  const sightings = await db.select().from(charmSightings).where(eq(charmSightings.styleId, '797561CZ'));
  console.log('Sightings:', JSON.stringify(sightings, null, 2));
}

main().then(() => process.exit(0));
