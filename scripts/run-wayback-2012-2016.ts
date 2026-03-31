import 'dotenv/config'
import { db } from '../server/db'
import { charmSightings, charmDatabase, charmImages } from '../server/db/schema'
import { eq, like } from 'drizzle-orm'

const waybackApi = 'https://web.archive.org'
const cdxApi = 'https://web.archive.org/cdx/search/cdx'

interface ParsedProduct {
  styleId: string
  name?: string
  price?: number
  currency?: string
  collection?: string
  imageUrl?: string
}

function parseWwwV1(html: string): ParsedProduct | null {
  // Extract from meta tags:
  // <meta name="id" content="791031"/>
  // <meta name="name" content="Kleid, Charm mit Anhänger"/>
  // <meta name="price" content="35,00 EUR"/>
  // <meta name="collection" content="Moments"/>

  const idMatch = html.match(/<meta\s+name="id"\s+content="([^"]+)"/i)
  if (!idMatch) return null

  const styleId = idMatch[1].toUpperCase()

  const nameMatch = html.match(/<meta\s+name="name"\s+content="([^"]+)"/i)
  const name = nameMatch ? decodeHtmlEntities(nameMatch[1]) : `Product ${styleId}`

  const priceMatch = html.match(/<meta\s+name="price"\s+content="([\d.,]+)\s*([A-Z]{3})"/i)
  let price: number | undefined
  let currency = 'USD'
  if (priceMatch) {
    // Handle European format (35,00) vs US format (35.00)
    price = parseFloat(priceMatch[1].replace(',', '.'))
    currency = priceMatch[2]
  }

  const collectionMatch = html.match(/<meta\s+name="collection"\s+content="([^"]+)"/i)
  const collection = collectionMatch ? collectionMatch[1] : undefined

  // Try to get image from og:image
  const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
  let imageUrl: string | undefined
  if (imageMatch) {
    let imgSrc = imageMatch[1]
    if (imgSrc.startsWith('/web/')) {
      imgSrc = `https://web.archive.org${imgSrc}`
    }
    imageUrl = imgSrc
  }

  return { styleId, name, price, currency, collection, imageUrl }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&szlig;/g, 'ß')
}

function inferTypeFromName(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('ring')) return 'ring'
  if (lower.includes('earring')) return 'earring'
  if (lower.includes('necklace') || lower.includes('collier')) return 'necklace'
  if (lower.includes('bracelet') || lower.includes('bangle')) return 'bracelet'
  if (lower.includes('pendant')) return 'pendant'
  if (lower.includes('brooch')) return 'brooch'
  if (lower.includes('clip')) return 'clip'
  if (lower.includes('safety chain')) return 'safety_chain'
  if (lower.includes('murano') || lower.includes('glass')) return 'murano'
  if (lower.includes('spacer')) return 'spacer'
  if (lower.includes('dangle')) return 'dangle'
  return 'charm'
}

function getRegionFromUrl(url: string): string {
  const urlLower = url.toLowerCase()
  if (urlLower.includes('/en-us')) return 'US'
  if (urlLower.includes('/en-gb')) return 'UK'
  if (urlLower.includes('/en-au')) return 'AU'
  if (urlLower.includes('/de-de')) return 'DE'
  if (urlLower.includes('/fr-fr')) return 'FR'
  if (urlLower.includes('/da-dk')) return 'DK'
  return 'US'
}

function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return 'Spring'
  if (month >= 6 && month <= 8) return 'Summer'
  if (month >= 9 && month <= 11) return 'Autumn'
  return 'Winter'
}

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  console.log('Clearing old www-v1 (2012-2016) wayback data...')
  // We'll use a different catalog name to distinguish from 2008-2011
  await db.delete(charmSightings).where(like(charmSightings.catalogName, '%www-v1%'))

  console.log('Querying CDX for 2012-2016 era...\n')

  // URL patterns for product pages (category/styleId format)
  const categories = ['charms', 'bracelets', 'clips', 'earrings', 'necklaces', 'rings', 'dangles', 'spacers']
  const locales = ['en-us', 'en-gb', 'de-de', 'fr-fr', 'da-dk', 'en-au']

  const urlPatterns: string[] = []
  for (const locale of locales) {
    for (const category of categories) {
      urlPatterns.push(`www.pandora.net/${locale}/explore/products/${category}/`)
    }
  }

  // Collect all product URLs
  const pageUrls: Array<{ timestamp: string; url: string; styleId: string }> = []

  for (const pattern of urlPatterns) {
    console.log(`  Querying ${pattern}...`)
    const cdxUrl = `${cdxApi}?url=${encodeURIComponent(pattern)}` +
      `&matchType=prefix&output=json&from=20120101&to=20161231` +
      `&filter=statuscode:200&filter=mimetype:text/html&collapse=urlkey`

    try {
      await delay(1000)
      const response = await fetch(cdxUrl)
      if (!response.ok) {
        console.log(`    CDX error: ${response.status}`)
        continue
      }

      const data = await response.json()
      if (!Array.isArray(data) || data.length < 2) {
        console.log(`    No results`)
        continue
      }

      let count = 0
      for (let i = 1; i < data.length; i++) {
        const [urlkey, timestamp, original] = data[i]

        // Extract style ID from URL - last path segment, 5+ alphanumeric chars
        const match = original.match(/\/explore\/products\/[^/]+\/([a-z0-9]{5,})(?:[?#]|$)/i)
        if (!match) continue

        const styleId = match[1].toUpperCase()

        // Skip duplicates by styleId
        if (pageUrls.some(p => p.styleId === styleId)) continue

        pageUrls.push({ timestamp, url: original, styleId })
        count++
      }

      if (count > 0) {
        console.log(`    Found ${count} product URLs`)
      }
    } catch (e: any) {
      console.log(`    Error: ${e.message}`)
    }
  }

  console.log(`\nFound ${pageUrls.length} unique product URLs`)
  console.log('Scraping all products...\n')

  const charmsToInsert: any[] = []
  const sightingsToInsert: any[] = []
  const imagesToInsert: any[] = []
  const seenStyleIds = new Set<string>()

  let processed = 0
  let errors = 0
  const BATCH_SIZE = 50

  for (const { timestamp, url, styleId } of pageUrls) {
    try {
      await delay(200)
      const archiveUrl = `${waybackApi}/web/${timestamp}/${url}`

      const response = await fetch(archiveUrl, {
        headers: { 'User-Agent': 'Charmventory Bot' },
        signal: AbortSignal.timeout(15000)
      })

      if (!response.ok) {
        errors++
        continue
      }

      const html = await response.text()
      const product = parseWwwV1(html)

      if (!product) {
        errors++
        continue
      }

      // Skip duplicates by real style ID
      if (seenStyleIds.has(product.styleId)) {
        continue
      }
      seenStyleIds.add(product.styleId)

      const year = parseInt(timestamp.slice(0, 4))
      const month = parseInt(timestamp.slice(4, 6))
      const region = getRegionFromUrl(url)

      charmsToInsert.push({
        styleId: product.styleId,
        name: product.name || '',
        brand: 'Pandora',
        type: inferTypeFromName(product.name || ''),
        collection: product.collection,
        originalPrice: product.price?.toString() || null,
        currency: product.currency || 'USD',
        region,
        processing: false,
        createdBy: 'scraper:wayback:www-v1',
        verified: false,
      })

      sightingsToInsert.push({
        styleId: product.styleId,
        catalogName: 'Pandora.net Archive (www-v1)',
        year,
        season: `${getSeason(month)} ${year}`,
        region,
        extractedName: product.name,
        extractedPrice: product.price?.toString() || null,
        extractedCurrency: product.currency || 'USD',
        imageUrl: product.imageUrl,
        sourceUrl: archiveUrl,
        scrapedBy: 'wayback',
      })

      if (product.imageUrl) {
        imagesToInsert.push({
          styleId: product.styleId,
          url: product.imageUrl,
          imageType: 'official',
          uploadedBy: 'scraper:wayback:www-v1',
          approved: true,
        })
      }

      processed++

      if (processed % 10 === 0) {
        console.log(`  [${processed}] ${product.styleId}: ${product.name?.substring(0, 40)} - ${product.price || 'N/A'} ${product.currency}`)
      }

      // Flush batches
      if (charmsToInsert.length >= BATCH_SIZE) {
        console.log(`  Inserting batch of ${charmsToInsert.length}...`)
        await db.insert(charmDatabase).values(charmsToInsert).onConflictDoNothing()
        await db.insert(charmSightings).values(sightingsToInsert)
        if (imagesToInsert.length > 0) {
          await db.insert(charmImages).values(imagesToInsert).onConflictDoNothing()
        }
        charmsToInsert.length = 0
        sightingsToInsert.length = 0
        imagesToInsert.length = 0
      }
    } catch (e: any) {
      errors++
    }
  }

  // Final flush
  if (charmsToInsert.length > 0) {
    console.log(`  Inserting final batch of ${charmsToInsert.length}...`)
    await db.insert(charmDatabase).values(charmsToInsert).onConflictDoNothing()
    await db.insert(charmSightings).values(sightingsToInsert)
    if (imagesToInsert.length > 0) {
      await db.insert(charmImages).values(imagesToInsert).onConflictDoNothing()
    }
  }

  console.log(`\nDone! Processed ${processed} products (${errors} errors)`)
  process.exit(0)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
