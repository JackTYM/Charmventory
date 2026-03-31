import 'dotenv/config'
import { db } from '../server/db'
import { charmSightings, charmDatabase } from '../server/db/schema'
import { eq, sql, like } from 'drizzle-orm'

async function main() {
  const waybackCount = await db.select({ count: sql<number>`count(*)` })
    .from(charmSightings)
    .where(eq(charmSightings.scrapedBy, 'wayback'))

  const byEra = await db.select({
    catalogName: charmSightings.catalogName,
    count: sql<number>`count(*)`
  })
    .from(charmSightings)
    .where(eq(charmSightings.scrapedBy, 'wayback'))
    .groupBy(charmSightings.catalogName)

  // Check charms created by wayback
  const waybackCharms = await db.select({ count: sql<number>`count(*)` })
    .from(charmDatabase)
    .where(like(charmDatabase.createdBy, 'scraper:wayback'))

  // Sample sightings
  const samples = await db.select()
    .from(charmSightings)
    .where(eq(charmSightings.scrapedBy, 'wayback'))
    .limit(5)

  console.log('Total wayback sightings:', waybackCount[0]?.count)
  console.log('By catalog/era:', byEra)
  console.log('Wayback charms in database:', waybackCharms[0]?.count)
  console.log('Sample sightings:', samples.map(s => ({
    styleId: s.styleId,
    name: s.extractedName,
    price: s.extractedPrice,
    year: s.year
  })))
  process.exit(0)
}

main()
