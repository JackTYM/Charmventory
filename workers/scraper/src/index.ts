import puppeteer from '@cloudflare/puppeteer'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { charmDatabase, charmImages } from './schema'
import { inArray } from 'drizzle-orm'

interface Env {
  BROWSER: Fetcher
  DATABASE_URL: string
  SCRAPER_ENABLED: string
  SCRAPER_SECRET: string
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
]

// Browser-based scrapers (need Puppeteer for Cloudflare bypass or JS rendering)
const BROWSER_SCRAPERS = ['pandora-net', 'flipsnack']

// Direct fetch scrapers (no browser needed)
const DIRECT_SCRAPERS = ['boolchands', 'alberts']

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (env.SCRAPER_ENABLED !== 'true') {
      console.log('Scrapers disabled, skipping')
      return
    }

    // Determine which scrapers to run based on cron time
    // 0:00 UTC - Shopify + Direct scrapers (fast, no browser)
    // 1:00 UTC - flipsnack (browser)
    // 2:00 UTC - pandora-net (browser)
    const hour = new Date(event.scheduledTime).getUTCHours()
    console.log(`Scheduled run at hour ${hour} UTC`)

    const results: ScraperResult[] = []

    if (hour === 0) {
      // Run Shopify scrapers
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

      // Run direct fetch scrapers
      for (const name of DIRECT_SCRAPERS) {
        try {
          const result = await runDirectScraper(name, env)
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
    } else if (hour === 1) {
      // Run flipsnack (browser)
      try {
        const result = await runBrowserScraper('flipsnack', env)
        results.push(result)
        console.log(`flipsnack: ${result.charmsFound} found, ${result.charmsAdded} added`)
      } catch (e: any) {
        console.error('flipsnack failed:', e.message)
        results.push({
          scraper: 'flipsnack',
          success: false,
          charmsFound: 0,
          charmsAdded: 0,
          errors: [e.message],
          durationMs: 0,
        })
      }
    } else if (hour === 2) {
      // Run pandora-net (browser)
      try {
        const result = await runBrowserScraper('pandora-net', env)
        results.push(result)
        console.log(`pandora-net: ${result.charmsFound} found, ${result.charmsAdded} added`)
      } catch (e: any) {
        console.error('pandora-net failed:', e.message)
        results.push({
          scraper: 'pandora-net',
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
    // Requires Authorization header with secret token
    // Use ?scraper=hannoush to run a single scraper
    if (url.pathname === '/run' && request.method === 'POST') {
      // Verify secret token
      const authHeader = request.headers.get('Authorization')
      const expectedToken = `Bearer ${env.SCRAPER_SECRET}`
      if (!env.SCRAPER_SECRET || authHeader !== expectedToken) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      console.log('Manual trigger received (authorized)')
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
  if (DIRECT_SCRAPERS.includes(name)) {
    return runDirectScraper(name, env)
  }
  if (BROWSER_SCRAPERS.includes(name)) {
    return runBrowserScraper(name, env)
  }
  throw new Error(`Unknown scraper: ${name}`)
}

async function runDirectScraper(name: string, env: Env): Promise<ScraperResult> {
  const startTime = Date.now()
  const errors: string[] = []
  const charms: ScrapedCharm[] = []

  const sql = neon(env.DATABASE_URL)
  const db = drizzle(sql)

  try {
    if (name === 'boolchands') {
      const boolchandsCharms = await scrapeBoolchands(null)
      charms.push(...boolchandsCharms)
    } else if (name === 'alberts') {
      const albertsCharms = await scrapeAlberts(null)
      charms.push(...albertsCharms)
    }
  } catch (e: any) {
    errors.push(`${name}: ${e.message}`)
  }

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
      try {
        const pandoraCharms = await scrapePandoraNet(page)
        charms.push(...pandoraCharms)
      } catch (e: any) {
        errors.push(`Pandora.net: ${e.message}`)
      }
    } else if (name === 'flipsnack') {
      try {
        const flipsnackCharms = await scrapeFlipsnack(page)
        charms.push(...flipsnackCharms)
      } catch (e: any) {
        errors.push(`Flipsnack: ${e.message}`)
      }
    } else if (name === 'boolchands') {
      try {
        const boolchandsCharms = await scrapeBoolchands(page)
        charms.push(...boolchandsCharms)
      } catch (e: any) {
        errors.push(`Boolchands: ${e.message}`)
      }
    } else if (name === 'alberts') {
      try {
        const albertsCharms = await scrapeAlberts(page)
        charms.push(...albertsCharms)
      } catch (e: any) {
        errors.push(`Alberts: ${e.message}`)
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

async function scrapePandoraNet(page: any): Promise<ScrapedCharm[]> {
  const charms: ScrapedCharm[] = []
  const seenStyleIds = new Set<string>()
  let authHeaders: Record<string, string> = {}

  const categories = ['charms', 'clips', 'bracelets', 'necklaces', 'pendants', 'earrings', 'rings']

  // Step 1: Capture auth headers by visiting a category page
  console.log('Capturing Pandora.net auth headers...')
  await page.setRequestInterception(true)

  const requestHandler = (request: any) => {
    const url = request.url()
    if (url.includes('product-search') || url.includes('/dol/')) {
      const headers = request.headers()
      if (headers['authorization']) {
        authHeaders = {
          authorization: headers['authorization'],
          'x-mobify-client-id': headers['x-mobify-client-id'] || '',
          cookie: headers['cookie'] || '',
        }
        console.log('Captured auth token')
      }
    }
    request.continue()
  }

  page.on('request', requestHandler)

  try {
    await page.goto('https://us.pandora.net/en/charms/', {
      waitUntil: 'networkidle2', // Allow 2 connections - networkidle0 may never trigger on heavy sites
      timeout: 45000,
    })
    // Wait for API calls to fire
    await new Promise((r) => setTimeout(r, 3000))
    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, 1000))
    await new Promise((r) => setTimeout(r, 2000))
  } catch (e: any) {
    console.log(`Navigation warning (continuing anyway): ${e.message}`)
  } finally {
    page.off('request', requestHandler)
    await page.setRequestInterception(false)
  }

  if (!authHeaders['authorization']) {
    console.log('Failed to capture auth, falling back to DOM scraping')
    return await scrapePandoraDom(page, categories)
  }

  // Step 2: Use API to fetch products
  for (const category of categories) {
    console.log(`Scraping category: ${category}`)
    let offset = 0
    const pageSize = 100
    let hasMore = true

    while (hasMore) {
      try {
        const pageUrl = encodeURIComponent(`https://us.pandora.net/en/${category}/`)
        const apiUrl =
          `https://us.pandora.net/mobify/proxy/dol/products/search?` +
          `categoryId=${category}&limit=${pageSize}&locale=en-US&offset=${offset}&source=PWASearchByBR&url=${pageUrl}`

        const response = await Promise.race([
          page.evaluate(
            async (url: string, headers: Record<string, string>) => {
              try {
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 15000)
                const res = await fetch(url, {
                  method: 'GET',
                  headers: { Accept: 'application/json', 'x-environment': 'production', ...headers },
                  signal: controller.signal,
                })
                clearTimeout(timeoutId)
                if (!res.ok) return { error: `HTTP ${res.status}` }
                return { data: await res.json() }
              } catch (e: any) {
                return { error: e.message }
              }
            },
            apiUrl,
            authHeaders
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Evaluate timeout')), 20000)),
        ]) as any

        // New API uses 'data' array instead of 'hits'
        const products = response.data?.data || response.data?.hits
        if (response.error || !products) {
          console.log(`API error or no products for ${category}: ${response.error || 'no data'}`)
          break
        }

        const total = response.data.total || 0
        console.log(`Got ${products.length} products (${offset + products.length}/${total})`)

        for (const product of products) {
          const styleId = (product.productId || product.id || '').toUpperCase()
          if (!styleId || !/^\d{6}[A-Z0-9]*$/i.test(styleId)) continue
          if (seenStyleIds.has(styleId)) continue
          seenStyleIds.add(styleId)

          // New API uses primaryImage.link
          let imageUrl: string | undefined
          if (product.primaryImage?.link) imageUrl = product.primaryImage.link
          else if (product.image?.disBaseLink) imageUrl = product.image.disBaseLink
          else if (product.image?.link) imageUrl = product.image.link

          charms.push({
            styleId,
            name: (product.productName || product.name || '').replace(/^Final Sale\s*-\s*/i, ''),
            brand: 'Pandora',
            originalPrice: product.price || product.salePrice,
            currency: 'USD',
            region: 'US',
            description: product.shortDescription,
            type: category === 'clips' ? 'clip' : category.replace(/s$/, ''),
            imageUrls: imageUrl ? [imageUrl] : undefined,
          })
        }

        offset += products.length
        hasMore = offset < total && products.length > 0
        await new Promise((r) => setTimeout(r, 500))
      } catch (e: any) {
        console.log(`Error fetching ${category}: ${e.message}`)
        break
      }
    }
  }

  return charms
}

async function scrapePandoraDom(page: any, categories: string[]): Promise<ScrapedCharm[]> {
  const charms: ScrapedCharm[] = []
  const seenStyleIds = new Set<string>()

  for (const category of categories) {
    try {
      await page.goto(`https://us.pandora.net/en/${category}/`, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      })

      // Scroll and load more
      for (let i = 0; i < 20; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await new Promise((r) => setTimeout(r, 1500))
        const loadMore = await page.$('button[class*="load-more"]')
        if (loadMore) {
          await loadMore.click()
          await new Promise((r) => setTimeout(r, 2000))
        }
      }

      const products = await page.evaluate(() => {
        const results: any[] = []
        document.querySelectorAll('a[href*=".html"]').forEach((link) => {
          const href = link.getAttribute('href') || ''
          const match = href.match(/\/(\d{6}[A-Z0-9]*)\.html/i)
          if (!match) return
          const tile = link.closest('[class*="product"], article, li') || link.parentElement
          const nameEl = tile?.querySelector('[class*="name"], h2, h3')
          const priceEl = tile?.querySelector('[class*="price"]')
          const img = tile?.querySelector('img')
          results.push({
            styleId: match[1].toUpperCase(),
            name: nameEl?.textContent?.trim() || '',
            price: priceEl?.textContent?.match(/\$([\d,]+)/)?.[1]?.replace(',', ''),
            imageUrl: img?.src,
          })
        })
        return results
      })

      for (const p of products) {
        if (!p.styleId || seenStyleIds.has(p.styleId)) continue
        seenStyleIds.add(p.styleId)
        charms.push({
          styleId: p.styleId,
          name: p.name,
          brand: 'Pandora',
          originalPrice: p.price ? parseFloat(p.price) : undefined,
          currency: 'USD',
          region: 'US',
          type: category.replace(/s$/, ''),
          imageUrls: p.imageUrl ? [p.imageUrl] : undefined,
        })
      }
    } catch (e: any) {
      console.log(`DOM scrape error for ${category}: ${e.message}`)
    }
  }

  return charms
}

async function scrapeFlipsnack(page: any): Promise<ScrapedCharm[]> {
  const charms: ScrapedCharm[] = []
  const seenStyleIds = new Set<string>()

  // Known Flipsnack catalog URLs
  const catalogUrls = [
    'https://www.flipsnack.com/pandoranorthamerica/ss26-ipc-us/full-view.html',
    'https://www.flipsnack.com/pandoranorthamerica/ss26-ipc-ca/full-view.html',
    'https://www.flipsnack.com/pandoranorthamerica/aw25-ipc-us/full-view.html',
    'https://www.flipsnack.com/pandoranorthamerica/aw25-ipc-ca/full-view.html',
  ]

  for (const catalogUrl of catalogUrls) {
    try {
      // Navigate and intercept data.json request
      let dataJsonUrl: string | null = null

      // Set up request interception
      await page.setRequestInterception(true)

      const requestHandler = (request: any) => {
        const reqUrl = request.url()
        if (reqUrl.includes('data.json') && reqUrl.includes('cloudfront.net')) {
          dataJsonUrl = reqUrl
        }
        request.continue()
      }

      page.on('request', requestHandler)

      try {
        await page.goto(catalogUrl, { waitUntil: 'networkidle0', timeout: 30000 })
        // Brief wait for data.json request to be captured
        await new Promise(r => setTimeout(r, 2000))
      } catch (e: any) {
        console.log(`Navigation warning for ${catalogUrl}: ${e.message}`)
      }

      page.off('request', requestHandler)
      await page.setRequestInterception(false)

      if (!dataJsonUrl) {
        console.log(`Could not find data.json for ${catalogUrl}`)
        continue
      }

      console.log(`Found data.json: ${dataJsonUrl.substring(0, 60)}...`)

      // Fetch the data.json directly
      const response = await fetch(dataJsonUrl)
      if (!response.ok) {
        console.log(`Failed to fetch data.json: ${response.status}`)
        continue
      }

      const catalogData = await response.json()

      // Extract charms from the catalog data
      const extractedCharms = extractCharmsFromFlipsnackData(catalogData, seenStyleIds)
      charms.push(...extractedCharms)

      console.log(`Extracted ${extractedCharms.length} charms from ${catalogUrl}`)
    } catch (e: any) {
      console.error(`Error processing ${catalogUrl}: ${e.message}`)
    }
  }

  return charms
}

function extractCharmsFromFlipsnackData(data: any, seenStyleIds: Set<string>): ScrapedCharm[] {
  const charms: ScrapedCharm[] = []
  const FLIPSNACK_IMAGE_BASE = 'https://d160aj0mj3npgx.cloudfront.net/A769E699E8C/library/external/'

  // Recursively find all layers with product data
  function findLayers(obj: any, layers: any[] = []): any[] {
    if (!obj || typeof obj !== 'object') return layers

    if (obj.attributes || obj.layerLabel) {
      layers.push(obj)
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        findLayers(item, layers)
      }
    } else {
      for (const value of Object.values(obj)) {
        findLayers(value, layers)
      }
    }

    return layers
  }

  const layers = findLayers(data)

  for (const layer of layers) {
    const attrs = layer.attributes
    if (!attrs) continue

    const styleId = attrs.code || layer.layerLabel
    if (!styleId) continue

    // Validate style ID format
    if (!/^\d{6}[A-Z0-9]*$/i.test(styleId)) continue

    const normalizedId = styleId.toUpperCase()
    if (seenStyleIds.has(normalizedId)) continue
    seenStyleIds.add(normalizedId)

    // Extract images from media array
    const images: string[] = []
    if (attrs.media && Array.isArray(attrs.media)) {
      for (const media of attrs.media) {
        if (media.hash && typeof media.hash === 'string' && media.hash.length === 32) {
          images.push(FLIPSNACK_IMAGE_BASE + media.hash)
        }
      }
    }

    charms.push({
      styleId: normalizedId,
      name: attrs.title || '',
      brand: 'Pandora',
      description: attrs.description?.slice(0, 500),
      originalPrice: attrs.price ? parseFloat(attrs.price) : undefined,
      currency: 'USD',
      region: 'US',
      imageUrls: images.length > 0 ? images : undefined,
    })
  }

  return charms
}

async function scrapeBoolchands(page: any): Promise<ScrapedCharm[]> {
  const charms: ScrapedCharm[] = []
  const seenStyleIds = new Set<string>()
  const sessionId = crypto.randomUUID()
  const userId = crypto.randomUUID()

  // Note: Boolchand's seems to have very limited inventory now, so we do a simple
  // search for all products and filter by Pandora brand

  console.log('Scraping Boolchands via direct API...')

  let skip = 0
  const pageSize = 100
  let hasMore = true

  while (hasMore) {
    try {
      const fields = 'brand_esi,calculated_price,categories_esai,id,images_ej,name,page_slug,price,sku,variants'
      const apiUrl = `https://www.boolchand.com/apis/ecommerce-service/public/discovery/v2/search?fields=${fields}&skip=${skip}&limit=${pageSize}&sort_by=relevance&include_count=true&locale=en-us`

      const body = {
        facets: [],
        user_id: userId,
        session_id: sessionId,
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'x-customer-group-id': '0',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        console.log(`Boolchands API error: ${response.status}`)
        break
      }

      const result = (await response.json()) as any

      if (!result.Data?.records) {
        console.log('Boolchands: no records in response')
        break
      }

      const records = result.Data.records
      const total = result.Data._meta_?.total_count || 0
      console.log(`Got ${records.length} products (${skip + records.length}/${total})`)

      for (const product of records) {
        // Check if Pandora brand
        const brand = product.brand_esi
        const isPandora =
          typeof brand === 'string' ? brand.toUpperCase() === 'PANDORA' : false
        if (!isPandora) continue

        // Extract style ID from SKU
        const sku = product.sku || ''
        const skuMatch = sku.match(/^(\d{5,7}[A-Z]{0,3}\d{0,2})/i)
        if (!skuMatch) continue

        const styleId = skuMatch[1].toUpperCase()
        if (styleId.length < 6) continue
        if (seenStyleIds.has(styleId)) continue
        seenStyleIds.add(styleId)

        // Parse price from variants
        let price: number | undefined
        if (product.variants) {
          try {
            const variants = JSON.parse(product.variants)
            if (variants[0]) price = variants[0].calculated_price || variants[0].price
          } catch {
            price = product.calculated_price || product.price
          }
        }

        // Parse images
        let imageUrl: string | undefined
        if (product.images_ej) {
          try {
            const images = JSON.parse(product.images_ej)
            if (images[0]) imageUrl = images[0].url_zoom || images[0].url_standard
          } catch {}
        }

        // Determine type from style ID prefix
        const prefix = styleId.slice(0, 2)
        let type = 'charm'
        if (['59', '58'].includes(prefix)) type = 'bracelet'
        else if (['29', '28', '26'].includes(prefix)) type = 'earring'
        else if (prefix === '56') type = 'ring'
        else if (['39', '38'].includes(prefix)) type = 'necklace'

        charms.push({
          styleId,
          name: product.name || '',
          brand: 'Pandora',
          originalPrice: price,
          currency: 'USD',
          region: 'Caribbean',
          type,
          imageUrls: imageUrl ? [imageUrl] : undefined,
        })
      }

      skip += pageSize
      hasMore = skip < total && records.length > 0
      await new Promise((r) => setTimeout(r, 300))
    } catch (e: any) {
      console.log(`Boolchands error: ${e.message}`)
      break
    }
  }

  console.log(`Boolchands: found ${charms.length} Pandora products`)
  return charms
}

async function scrapeAlberts(page: any): Promise<ScrapedCharm[]> {
  const charms: ScrapedCharm[] = []
  const seenStyleIds = new Set<string>()

  console.log("Scraping Albert's Jewelers sitemap...")

  // Fetch sitemap
  const sitemapResponse = await fetch('https://www.albertsjewelers.com/sitemap.xml', {
    headers: { 'User-Agent': 'Charmventory Bot/1.0' },
  })

  if (!sitemapResponse.ok) {
    console.log(`Sitemap fetch failed: ${sitemapResponse.status}`)
    return charms
  }

  const sitemapXml = await sitemapResponse.text()

  // Extract Pandora product URLs
  const urlRegex = /<loc>(https:\/\/www\.albertsjewelers\.com\/pandora\/[^<]+\/\d+\/en)<\/loc>/gi
  const matches = [...sitemapXml.matchAll(urlRegex)]

  console.log(`Found ${matches.length} Pandora URLs in sitemap`)

  // Due to 30s crawl delay, we'll only process first 50 and extract IDs from URLs
  const limit = Math.min(matches.length, 200)
  let processed = 0

  for (let i = 0; i < limit; i++) {
    const productUrl = matches[i][1]

    // Extract style ID from URL slug
    const slugMatch = productUrl.match(/\/pandora\/([^/]+)\/\d+\/en$/)
    if (!slugMatch) continue

    const slug = slugMatch[1]
    const styleIdMatch = slug.match(/(\d{5,7}[a-z]{0,3}\d{0,2})(?:-\d+)?$/i)
    if (!styleIdMatch) continue

    const styleId = styleIdMatch[1].toUpperCase()
    if (seenStyleIds.has(styleId)) continue
    seenStyleIds.add(styleId)

    // Extract name from slug
    const nameParts = slug.replace(/-\d+$/, '').split('-')
    const name = nameParts
      .slice(1, -1) // Remove "pandora" prefix and style ID suffix
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

    // Determine type from name or style ID
    const nameLower = name.toLowerCase()
    let type = 'charm'
    if (nameLower.includes('bracelet')) type = 'bracelet'
    else if (nameLower.includes('necklace') || nameLower.includes('pendant')) type = 'necklace'
    else if (nameLower.includes('ring')) type = 'ring'
    else if (nameLower.includes('earring')) type = 'earring'
    else if (nameLower.includes('clip')) type = 'clip'
    else {
      const prefix = styleId.slice(0, 2)
      if (['59', '58'].includes(prefix)) type = 'bracelet'
      else if (['29', '28', '26'].includes(prefix)) type = 'earring'
      else if (prefix === '56') type = 'ring'
      else if (['39', '38'].includes(prefix)) type = 'necklace'
    }

    charms.push({
      styleId,
      name: name || `Product ${styleId}`,
      brand: 'Pandora',
      currency: 'USD',
      region: 'US',
      type,
    })

    processed++
  }

  console.log(`Extracted ${processed} unique products from Albert's sitemap`)
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
