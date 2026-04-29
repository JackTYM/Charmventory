import puppeteer from '@cloudflare/puppeteer'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { charmDatabase, charmImages } from './schema'
import { inArray } from 'drizzle-orm'

interface Env {
  BROWSER: Fetcher
  DATABASE_URL: string
  SCRAPER_ENABLED: string
}

interface ScrapedCharm {
  styleId: string
  name: string
  brand?: string
  collection?: string
  type?: string
  originalPrice?: number
  currency?: string
  region?: string
  materials?: string[]
  description?: string
  isLimited?: boolean
  isRetired?: boolean
  imageUrls?: string[]
}

interface ScraperResult {
  scraper: string
  success: boolean
  charmsFound: number
  charmsAdded: number
  errors: string[]
  durationMs: number
}

// Shopify-based scrapers (simple fetch, no browser needed)
const SHOPIFY_SCRAPERS = [
  {
    name: 'hannoush',
    baseUrl: 'https://www.hannoush.com',
    collection: 'pandora',
  },
  {
    name: 'elisa-ilana',
    baseUrl: 'https://www.elisailana.com',
    collection: 'pandora',
  },
  {
    name: 'boolchands',
    baseUrl: 'https://www.boolchandsjewelers.com',
    collection: 'pandora',
  },
  {
    name: 'alberts',
    baseUrl: 'https://www.qudera.com',
    collection: 'pandora',
  },
]

// Browser-based scrapers (need Puppeteer for Cloudflare bypass)
const BROWSER_SCRAPERS = ['pandora-net']

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (env.SCRAPER_ENABLED !== 'true') {
      console.log('Scrapers disabled, skipping')
      return
    }

    console.log('Starting scheduled scrape run...')
    const results: ScraperResult[] = []

    // Run Shopify scrapers (no browser needed)
    for (const config of SHOPIFY_SCRAPERS) {
      try {
        const result = await runShopifyScraper(config, env)
        results.push(result)
        console.log(`${config.name}: ${result.charmsFound} found, ${result.charmsAdded} added`)
      } catch (e: any) {
        console.error(`${config.name} failed:`, e.message)
        results.push({
          scraper: config.name,
          success: false,
          charmsFound: 0,
          charmsAdded: 0,
          errors: [e.message],
          durationMs: 0,
        })
      }
    }

    // Run browser-based scrapers
    for (const name of BROWSER_SCRAPERS) {
      try {
        const result = await runBrowserScraper(name, env)
        results.push(result)
        console.log(`${name}: ${result.charmsFound} found, ${result.charmsAdded} added`)
      } catch (e: any) {
        console.error(`${name} failed:`, e.message)
        results.push({
          scraper: name,
          success: false,
          charmsFound: 0,
          charmsAdded: 0,
          errors: [e.message],
          durationMs: 0,
        })
      }
    }

    console.log('Scrape run complete:', JSON.stringify(results, null, 2))
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Health check / status
    if (url.pathname === '/status') {
      return new Response(JSON.stringify({
        status: 'ok',
        hasDatabase: !!env.DATABASE_URL,
        hasBrowser: !!env.BROWSER,
        scraperEnabled: env.SCRAPER_ENABLED,
      }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Manual trigger endpoint (for testing) - run synchronously for debugging
    // Use ?scraper=hannoush to run a single scraper
    if (url.pathname === '/run' && request.method === 'POST') {
      console.log('Manual trigger received')
      console.log('DATABASE_URL set:', !!env.DATABASE_URL)
      console.log('BROWSER set:', !!env.BROWSER)
      console.log('SCRAPER_ENABLED:', env.SCRAPER_ENABLED)

      const singleScraper = url.searchParams.get('scraper')

      try {
        if (singleScraper) {
          // Run single scraper
          const result = await runSingleScraper(singleScraper, env)
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' },
          })
        } else {
          await this.scheduled({ scheduledTime: Date.now(), cron: 'manual' } as ScheduledEvent, env, ctx)
          return new Response(JSON.stringify({ status: 'completed' }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }
      } catch (e: any) {
        console.error('Scrape failed:', e)
        return new Response(JSON.stringify({ status: 'error', error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response('Charmventory Scraper Worker', { status: 200 })
  },
}

async function runSingleScraper(name: string, env: Env): Promise<ScraperResult> {
  const shopifyConfig = SHOPIFY_SCRAPERS.find(s => s.name === name)
  if (shopifyConfig) {
    return runShopifyScraper(shopifyConfig, env)
  }
  if (BROWSER_SCRAPERS.includes(name)) {
    return runBrowserScraper(name, env)
  }
  throw new Error(`Unknown scraper: ${name}`)
}

async function runShopifyScraper(
  config: { name: string; baseUrl: string; collection: string },
  env: Env
): Promise<ScraperResult> {
  const startTime = Date.now()
  const errors: string[] = []
  const charms: ScrapedCharm[] = []

  const sql = neon(env.DATABASE_URL)
  const db = drizzle(sql)

  let page = 1
  let hasMore = true
  const pageSize = 50

  while (hasMore && page <= 20) {
    try {
      const url = `${config.baseUrl}/collections/${config.collection}/products.json?limit=${pageSize}&page=${page}`
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Charmventory Bot/1.0',
        },
      })

      if (!response.ok) {
        errors.push(`Page ${page}: HTTP ${response.status}`)
        break
      }

      const data = (await response.json()) as { products: any[] }
      const products = data.products || []

      if (products.length === 0) {
        hasMore = false
        break
      }

      for (const product of products) {
        const charm = parseShopifyProduct(product, config.name)
        if (charm) {
          charms.push(charm)
        }
      }

      if (products.length < pageSize) {
        hasMore = false
      } else {
        page++
      }
    } catch (e: any) {
      errors.push(`Page ${page}: ${e.message}`)
      break
    }
  }

  // Batch insert to database
  const addedCount = await saveCharmsBatch(db, charms, config.name)

  return {
    scraper: config.name,
    success: errors.length === 0,
    charmsFound: charms.length,
    charmsAdded: addedCount,
    errors,
    durationMs: Date.now() - startTime,
  }
}

function parseShopifyProduct(product: any, scraperName: string): ScrapedCharm | null {
  // Extract style ID from SKU or tags
  let styleId = ''
  if (product.variants?.[0]?.sku) {
    styleId = product.variants[0].sku.replace(/[^A-Z0-9]/gi, '').toUpperCase()
  }

  // Try to find style ID in tags
  if (!styleId && product.tags) {
    const tags = Array.isArray(product.tags) ? product.tags : product.tags.split(',')
    for (const tag of tags) {
      const match = tag.match(/\b(\d{6}[A-Z]?\d{0,2})\b/i)
      if (match) {
        styleId = match[1].toUpperCase()
        break
      }
    }
  }

  if (!styleId || styleId.length < 6) {
    return null
  }

  const price = product.variants?.[0]?.price ? parseFloat(product.variants[0].price) : undefined

  return {
    styleId,
    name: product.title || '',
    brand: 'Pandora',
    originalPrice: price,
    currency: 'USD',
    region: 'US',
    description: product.body_html?.replace(/<[^>]*>/g, '').slice(0, 500) || undefined,
    imageUrls: product.images?.map((img: any) => img.src).filter(Boolean) || [],
  }
}

async function runBrowserScraper(name: string, env: Env): Promise<ScraperResult> {
  const startTime = Date.now()
  const errors: string[] = []
  const charms: ScrapedCharm[] = []

  const sql = neon(env.DATABASE_URL)
  const db = drizzle(sql)

  // Launch browser via Cloudflare Browser Rendering
  const browser = await puppeteer.launch(env.BROWSER)
  const page = await browser.newPage()

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    if (name === 'pandora-net') {
      // Scrape Pandora.net
      const categories = ['charms', 'clips', 'bracelets', 'necklaces', 'earrings', 'rings']

      for (const category of categories) {
        try {
          const categoryCharms = await scrapePandoraCategory(page, category)
          charms.push(...categoryCharms)
        } catch (e: any) {
          errors.push(`Category ${category}: ${e.message}`)
        }
      }
    }
  } finally {
    await browser.close()
  }

  // Batch insert to database
  const addedCount = await saveCharmsBatch(db, charms, name)

  return {
    scraper: name,
    success: errors.length === 0,
    charmsFound: charms.length,
    charmsAdded: addedCount,
    errors,
    durationMs: Date.now() - startTime,
  }
}

async function scrapePandoraCategory(page: any, category: string): Promise<ScrapedCharm[]> {
  const charms: ScrapedCharm[] = []
  const baseUrl = `https://us.pandora.net/en/${category}/`

  await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 30000 })

  // Wait for products to load
  await page.waitForSelector('[data-testid="product-tile"]', { timeout: 10000 }).catch(() => {})

  // Extract product data from the page
  const products = await page.evaluate(() => {
    const tiles = document.querySelectorAll('[data-testid="product-tile"]')
    return Array.from(tiles).map((tile) => {
      const link = tile.querySelector('a')
      const name = tile.querySelector('[data-testid="product-name"]')?.textContent?.trim()
      const price = tile.querySelector('[data-testid="product-price"]')?.textContent?.trim()
      const img = tile.querySelector('img')?.src

      // Extract style ID from URL or data attributes
      const href = link?.href || ''
      const styleMatch = href.match(/(\d{6}[A-Z]?\d{0,2})/i)

      return {
        styleId: styleMatch?.[1]?.toUpperCase() || '',
        name: name || '',
        price: price?.replace(/[^0-9.]/g, '') || '',
        imageUrl: img || '',
      }
    })
  })

  for (const product of products) {
    if (product.styleId && product.styleId.length >= 6) {
      charms.push({
        styleId: product.styleId,
        name: product.name,
        brand: 'Pandora',
        originalPrice: product.price ? parseFloat(product.price) : undefined,
        currency: 'USD',
        region: 'US',
        imageUrls: product.imageUrl ? [product.imageUrl] : [],
      })
    }
  }

  return charms
}

async function saveCharmsBatch(db: any, charms: ScrapedCharm[], scraperName: string): Promise<number> {
  if (charms.length === 0) return 0

  let addedCount = 0
  const CHUNK_SIZE = 200 // Larger batches to reduce subrequest count
  const processedStyleIds: string[] = []

  for (let i = 0; i < charms.length; i += CHUNK_SIZE) {
    const chunk = charms.slice(i, i + CHUNK_SIZE)

    try {
      const values = chunk.map((charm) => ({
        styleId: charm.styleId,
        name: charm.name || '',
        brand: charm.brand || 'Pandora',
        collection: charm.collection || null,
        type: (charm.type as any) || 'charm',
        originalPrice: charm.originalPrice?.toString() || null,
        currency: charm.currency || 'USD',
        region: charm.region || null,
        materials: charm.materials ? JSON.stringify(charm.materials) : null,
        description: charm.description || null,
        isLimited: charm.isLimited || false,
        isRetired: charm.isRetired || false,
        processing: true,
        createdBy: `scraper:${scraperName}`,
        verified: false,
      }))

      await db.insert(charmDatabase).values(values).onConflictDoNothing()
      addedCount += chunk.length

      // Save images
      const imageValues = chunk.flatMap((charm) =>
        (charm.imageUrls || []).map((url) => ({
          styleId: charm.styleId,
          url,
          imageType: 'official' as const,
          uploadedBy: `scraper:${scraperName}`,
          approved: true,
        }))
      )

      if (imageValues.length > 0) {
        await db.insert(charmImages).values(imageValues).onConflictDoNothing()
      }

      processedStyleIds.push(...chunk.map((c) => c.styleId))
    } catch (e: any) {
      console.error(`Batch insert failed: ${e.message}`)
    }
  }

  // Mark as complete
  if (processedStyleIds.length > 0) {
    try {
      await db
        .update(charmDatabase)
        .set({ processing: false })
        .where(inArray(charmDatabase.styleId, processedStyleIds))
    } catch (e: any) {
      console.error(`Failed to mark complete: ${e.message}`)
    }
  }

  return addedCount
}
