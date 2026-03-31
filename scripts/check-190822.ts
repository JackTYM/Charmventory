import 'dotenv/config'
import { db } from '../server/db'
import { charmSightings, charmDatabase } from '../server/db/schema'
import { eq } from 'drizzle-orm'

async function main() {
  const sightings = await db.select().from(charmSightings).where(eq(charmSightings.styleId, '190822'))
  console.log('Sightings:', JSON.stringify(sightings, null, 2))
  
  const charm = await db.select().from(charmDatabase).where(eq(charmDatabase.styleId, '190822'))
  console.log('Charm:', JSON.stringify(charm, null, 2))
  
  process.exit(0)
}
main()
