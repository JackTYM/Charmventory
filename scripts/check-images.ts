import 'dotenv/config'
import { db } from '../server/db'
import { charmImages } from '../server/db/schema'
import { eq } from 'drizzle-orm'

async function main() {
  const images = await db.select().from(charmImages).where(eq(charmImages.styleId, '750341'))
  console.log('Images for 750341:')
  images.forEach((img, i) => {
    console.log(`${i+1}. [${img.imageType}] ${img.url?.substring(0, 80)}...`)
    console.log(`   uploadedBy: ${img.uploadedBy}, createdAt: ${img.createdAt}`)
  })
  process.exit(0)
}
main()
