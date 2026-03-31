/**
 * Backfill prices for DenmarkStyle sightings that are missing prices
 */
import { db } from '../server/db'
import { charmSightings } from '../server/db/schema'
import { eq, isNull, and } from 'drizzle-orm'

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function extractPrice(html: string): Promise<number | null> {
  // Try itemprop="price">NUMBER< format first
  const itemPropContentMatch = html.match(/itemprop="price"[^>]*>(\d+(?:\.\d{2})?)</i)
  if (itemPropContentMatch) {
    return parseFloat(itemPropContentMatch[1])
  }

  // Try Price: $NUMBER format
  const priceLabelMatch = html.match(/Price:\s*\$?(\d+(?:\.\d{2})?)/i)
  if (priceLabelMatch) {
    return parseFloat(priceLabelMatch[1])
  }

  // Try itemprop="price" content="NUMBER" format
  const itemPropMatch = html.match(/itemprop="price"[^>]*content="(\d+(?:\.\d{2})?)"/i)
  if (itemPropMatch) {
    return parseFloat(itemPropMatch[1])
  }

  return null
}

async function backfillPrices() {
  console.log('Fetching DenmarkStyle sightings missing prices...')

  const sightingsToUpdate = await db.select({
    id: charmSightings.id,
    styleId: charmSightings.styleId,
    sourceUrl: charmSightings.sourceUrl,
  })
  .from(charmSightings)
  .where(and(
    eq(charmSightings.scrapedBy, 'denmarkstyle'),
    isNull(charmSightings.extractedPrice)
  ))

  console.log(`Found ${sightingsToUpdate.length} sightings to update`)

  let updated = 0
  let failed = 0

  for (const sighting of sightingsToUpdate) {
    if (!sighting.sourceUrl) {
      failed++
      continue
    }

    try {
      const response = await fetch(sighting.sourceUrl, {
        headers: {
          'User-Agent': 'Charmventory Database Bot (https://charmventory.com)',
        },
      })

      if (!response.ok) {
        failed++
        continue
      }

      const html = await response.text()
      const price = await extractPrice(html)

      if (price) {
        await db.update(charmSightings)
          .set({ extractedPrice: price.toString() })
          .where(eq(charmSightings.id, sighting.id))
        updated++

        if (updated % 100 === 0) {
          console.log(`Progress: ${updated} updated, ${failed} failed`)
        }
      } else {
        failed++
      }

      // Rate limit: 2 requests per second
      await delay(500)
    } catch (e) {
      failed++
    }
  }

  console.log(`\nDone! Updated: ${updated}, Failed: ${failed}`)
}

backfillPrices().then(() => process.exit(0))
