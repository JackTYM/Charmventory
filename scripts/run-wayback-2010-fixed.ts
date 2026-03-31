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
  imageUrl?: string
}

function parseOriginalV1(html: string): ParsedProduct | null {
  const designerIdMatch = html.match(/designerid="([^"]+)"/i)
  if (!designerIdMatch) return null

  const styleId = designerIdMatch[1].toUpperCase()

  const altMatch = html.match(/class="ItemImage"[^>]*alt="([^"]+)"/i) ||
                   html.match(/alt="([^"]+)"[^>]*class="ItemImage"/i)

  let name = ''
  if (altMatch) {
    name = altMatch[1].replace(/\s*\([^)]+\)\s*$/, '').trim()
  }
  if (!name || name.length < 3) {
    name = `Product ${styleId}`
  }

  let price: number | undefined
  let currency = 'USD'
  // Price is in a table: <th>Retail price:</th><td>135.00&nbsp;AUD</td>
  // Match across HTML tags and whitespace
  const priceMatch = html.match(/Retail price:[\s\S]*?<td>\s*([\d,.]+)\s*(?:&nbsp;|\s)*([A-Z]{3})/i) ||
                     html.match(/Retail price:\s*([\d,.]+)\s*(?:&nbsp;)?([A-Z]{3})/i) ||
                     html.match(/([\d,.]+)\s*(?:&nbsp;)?USD/i)
  if (priceMatch) {
    price = parseFloat(priceMatch[1].replace(/,/g, ''))
    currency = priceMatch[2] || 'USD'
  }

  const imageMatch = html.match(/class="ItemImage"[^>]*src="([^"]+)"/i) ||
                     html.match(/src="([^"]+)"[^>]*class="ItemImage"/i)
  let imageUrl: string | undefined
  if (imageMatch) {
    let imgSrc = imageMatch[1]
    if (imgSrc.startsWith('/web/')) {
      imgSrc = `https://web.archive.org${imgSrc}`
    }
    imageUrl = imgSrc
  }

  return { styleId, name, price, currency, imageUrl }
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
  if (urlLower.includes('/us/')) return 'US'
  if (urlLower.includes('/uk/')) return 'UK'
  if (urlLower.includes('/ca/')) return 'CA'
  if (urlLower.includes('/au/')) return 'AU'
  if (urlLower.includes('/de/')) return 'DE'
  if (urlLower.includes('/fr/')) return 'FR'
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
  console.log('Clearing old wayback data...')
  await db.delete(charmSightings).where(eq(charmSightings.scrapedBy, 'wayback'))
  await db.delete(charmImages).where(like(charmImages.uploadedBy, 'scraper:wayback'))
  await db.delete(charmDatabase).where(like(charmDatabase.createdBy, 'scraper:wayback'))

  console.log('Querying CDX for 2008-2011 era...')

  const urlPatterns = [
    'www.pandora.net/us/Jewelry/All/',
    'www.pandora.net/uk/Jewelry/All/',
    'www.pandora.net/au/Jewelry/All/',
    'www.pandora.net/de/Jewelry/All/',
  ]

  // Collect all URLs with their internal indices (we'll fetch to get real style IDs)
  const pageUrls: Array<{ timestamp: string; url: string }> = []

  for (const pattern of urlPatterns) {
    console.log(`  Querying ${pattern}...`)
    const cdxUrl = `${cdxApi}?url=${encodeURIComponent(pattern)}` +
      `&matchType=prefix&output=json&from=20080101&to=20111231` +
      `&filter=statuscode:200&filter=mimetype:text/html&collapse=urlkey`

    try {
      await delay(1000)
      const response = await fetch(cdxUrl)
      if (!response.ok) continue

      const data = await response.json()
      if (!Array.isArray(data) || data.length < 2) continue

      console.log(`    Found ${data.length - 1} URLs`)

      for (let i = 1; i < data.length; i++) {
        const [urlkey, timestamp, original] = data[i]
        // Only keep URLs with ?item= parameter (product pages)
        if (original.includes('?item=')) {
          pageUrls.push({ timestamp, url: original })
        }
      }
    } catch (e: any) {
      console.log(`    Error: ${e.message}`)
    }
  }

  console.log(`\nFound ${pageUrls.length} product page URLs`)
  console.log('Scraping all products...\n')

  const charmsToInsert: any[] = []
  const sightingsToInsert: any[] = []
  const imagestoInsert: any[] = []
  const seenStyleIds = new Set<string>()

  let processed = 0
  let errors = 0
  const BATCH_SIZE = 50

  for (const { timestamp, url } of pageUrls) {
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
      const product = parseOriginalV1(html)

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
        originalPrice: product.price?.toString() || null,
        currency: product.currency || 'USD',
        region,
        processing: false,
        createdBy: 'scraper:wayback',
        verified: false,
      })

      sightingsToInsert.push({
        styleId: product.styleId,
        catalogName: 'Pandora.net Archive (2008-2011)',
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
        imagestoInsert.push({
          styleId: product.styleId,
          url: product.imageUrl,
          imageType: 'official',
          uploadedBy: 'scraper:wayback',
          approved: true,
        })
      }

      processed++

      if (processed % 10 === 0) {
        console.log(`  [${processed}] ${product.styleId}: ${product.name} - $${product.price || 'N/A'}`)
      }

      // Flush batches
      if (charmsToInsert.length >= BATCH_SIZE) {
        console.log(`  Inserting batch of ${charmsToInsert.length}...`)
        await db.insert(charmDatabase).values(charmsToInsert).onConflictDoNothing()
        await db.insert(charmSightings).values(sightingsToInsert)
        if (imagestoInsert.length > 0) {
          await db.insert(charmImages).values(imagestoInsert).onConflictDoNothing()
        }
        charmsToInsert.length = 0
        sightingsToInsert.length = 0
        imagestoInsert.length = 0
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
    if (imagestoInsert.length > 0) {
      await db.insert(charmImages).values(imagestoInsert).onConflictDoNothing()
    }
  }

  console.log(`\nDone! Processed ${processed} products (${errors} errors)`)
  process.exit(0)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
