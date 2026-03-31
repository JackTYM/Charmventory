import 'dotenv/config'
import { db } from '../server/db'
import { charmSightings, charmDatabase, charmImages } from '../server/db/schema'
import { eq, like, sql } from 'drizzle-orm'

// Test the wayback scraper for just original-v1 era

const waybackApi = 'https://web.archive.org'
const cdxApi = 'https://web.archive.org/cdx/search/cdx'

interface ParsedProduct {
  styleId: string
  name?: string
  price?: number
  currency?: string
  description?: string
  collection?: string
  materials?: string[]
  imageUrl?: string
}

function cleanName(rawName: string): string | null {
  let name = rawName
    .split('\n')[0]
    .trim()
    .replace(/\s*-\s*(?:Product catalog|Official.*Website|Genuine Jewelry).*$/i, '')
    .replace(/^(?:Jewelry\s*-\s*)?(?:Genuine Jewelry\s*-\s*)?/i, '')
    .replace(/\s*-\s*PANDORA.*$/i, '')
    .replace(/\s*-\s*Jewelry$/i, '')
    .replace(/^PANDORA\s*/i, '')
    .trim()

  if (!name || name.toLowerCase() === 'jewelry' || name.length < 3) {
    return null
  }
  return name
}

function parseOriginalV1(html: string, url: string): ParsedProduct | null {
  // 2008-2011 URLs use ?item=ProductName=XXXXX or ?item==XXXXX format
  const urlWithNameMatch = url.match(/[?&]item=([^=]+)=(\d{5,})/i)
  const urlNoNameMatch = url.match(/[?&]item==(\d{5,})/i)
  const htmlStyleMatch = html.match(/(?:item|sku|style|product)[^\d]*(\d{5,}[A-Z0-9]*)/i)

  let styleId: string | undefined
  let urlName: string | undefined

  if (urlWithNameMatch) {
    urlName = decodeURIComponent(urlWithNameMatch[1].replace(/\+/g, ' '))
    styleId = urlWithNameMatch[2].toUpperCase()
  } else if (urlNoNameMatch) {
    styleId = urlNoNameMatch[1].toUpperCase()
  } else if (htmlStyleMatch) {
    styleId = htmlStyleMatch[1].toUpperCase()
  }

  if (!styleId) return null

  // Try URL name first
  let name = urlName || ''

  // If no URL name, try HTML extraction
  if (!name) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
    const classMatch = html.match(/class="[^"]*product[^"]*name[^"]*"[^>]*>([^<]+)/i)
    name = h1Match?.[1] || classMatch?.[1] || titleMatch?.[1] || ''
  }

  name = cleanName(name) || `Charm ${styleId}`

  return { styleId, name }
}

function getRegionFromUrl(url: string): string {
  const urlLower = url.toLowerCase()
  if (urlLower.includes('/us/') || urlLower.includes('-us.')) return 'US'
  if (urlLower.includes('/uk/') || urlLower.includes('-uk.')) return 'UK'
  if (urlLower.includes('/ca/') || urlLower.includes('-ca.')) return 'CA'
  if (urlLower.includes('/au/') || urlLower.includes('-au.')) return 'AU'
  if (urlLower.includes('/de/') || urlLower.includes('-de.')) return 'DE'
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

  console.log('Querying CDX for original-v1 era (2008-2011)...')

  const urlPatterns = [
    'www.pandora.net/us/Jewelry/All/',
    'www.pandora.net/uk/Jewelry/All/',
    'www.pandora.net/ca/Jewelry/All/',
    'www.pandora.net/au/Jewelry/All/',
    'www.pandora.net/de/Jewelry/All/',
  ]

  const productPages: Array<{ timestamp: string; url: string; styleId: string }> = []

  for (const pattern of urlPatterns) {
    console.log(`  Querying ${pattern}...`)
    const cdxUrl = `${cdxApi}?url=${encodeURIComponent(pattern)}` +
      `&matchType=prefix&output=json&from=20080101&to=20111231` +
      `&filter=statuscode:200&filter=mimetype:text/html&collapse=urlkey`

    try {
      await delay(1000)
      const response = await fetch(cdxUrl)
      if (!response.ok) {
        console.log(`    Error: ${response.status}`)
        continue
      }

      const data = await response.json()
      if (!Array.isArray(data) || data.length < 2) {
        console.log('    No results')
        continue
      }

      console.log(`    Found ${data.length - 1} URLs`)

      for (let i = 1; i < data.length; i++) {
        const [urlkey, timestamp, original] = data[i]

        const htmlMatch = original.match(/\/(\d{6}[A-Z0-9]*)\.html/i)
        const itemMatch = original.match(/[?&]item=[^=]*=(\d{5,})/i) ||
                         original.match(/[?&]item==(\d{5,})/i)

        const match = htmlMatch || itemMatch
        if (!match) continue

        const styleId = match[1].toUpperCase()
        if (productPages.some(p => p.styleId === styleId)) continue

        productPages.push({ timestamp, url: original, styleId })
      }
    } catch (e: any) {
      console.log(`    Error: ${e.message}`)
    }
  }

  console.log(`\nFound ${productPages.length} unique products`)
  console.log('Scraping all products...\n')

  const toScrape = productPages
  const charmsToInsert: any[] = []
  const sightingsToInsert: any[] = []

  let processed = 0
  let errors = 0
  const BATCH_SIZE = 50

  let i = 0
  for (const { timestamp, url, styleId } of toScrape) {
    i++
    try {
      await delay(300) // Faster rate limit
      const archiveUrl = `${waybackApi}/web/${timestamp}/${url}`

      // Log every 10 items for visibility
      if (i % 10 === 0) {
        console.log(`  [${i}/${toScrape.length}] Fetching ${styleId}...`)
      }

      const response = await fetch(archiveUrl, {
        headers: { 'User-Agent': 'Charmventory Bot' },
        signal: AbortSignal.timeout(15000) // 15s timeout
      })

      if (!response.ok) {
        errors++
        continue
      }

      const html = await response.text()
      const product = parseOriginalV1(html, url)

      if (!product) {
        errors++
        continue
      }

      const year = parseInt(timestamp.slice(0, 4))
      const month = parseInt(timestamp.slice(4, 6))
      const region = getRegionFromUrl(url)

      charmsToInsert.push({
        styleId: product.styleId,
        name: product.name || '',
        brand: 'Pandora',
        type: 'charm',
        originalPrice: product.price?.toString() || null,
        currency: product.currency || 'USD',
        region,
        processing: false,
        createdBy: 'scraper:wayback',
        verified: false,
      })

      sightingsToInsert.push({
        styleId: product.styleId,
        catalogName: 'Pandora.net Archive (original-v1)',
        year,
        season: `${getSeason(month)} ${year}`,
        region,
        extractedName: product.name,
        extractedPrice: product.price?.toString() || null,
        extractedCurrency: product.currency || 'USD',
        sourceUrl: archiveUrl,
        scrapedBy: 'wayback',
      })

      processed++

      // Log progress every 100 items
      if (processed % 100 === 0) {
        console.log(`  Progress: ${processed}/${toScrape.length} (${errors} errors)`)
      }

      // Flush batches periodically
      if (charmsToInsert.length >= BATCH_SIZE) {
        console.log(`  Inserting batch of ${charmsToInsert.length} charms...`)
        await db.insert(charmDatabase).values(charmsToInsert).onConflictDoNothing()
        await db.insert(charmSightings).values(sightingsToInsert)
        charmsToInsert.length = 0
        sightingsToInsert.length = 0
      }
    } catch (e: any) {
      errors++
    }
  }

  console.log(`\nFinal: ${processed} processed, ${errors} errors`)

  console.log(`\nInserting ${charmsToInsert.length} charms and ${sightingsToInsert.length} sightings...`)

  if (charmsToInsert.length > 0) {
    await db.insert(charmDatabase).values(charmsToInsert).onConflictDoNothing()
  }
  if (sightingsToInsert.length > 0) {
    await db.insert(charmSightings).values(sightingsToInsert)
  }

  console.log('Done!')
  process.exit(0)
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
