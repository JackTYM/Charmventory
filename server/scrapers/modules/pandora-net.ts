import { BaseScraper } from '../base'
import type { ScraperModule, ScrapedCharm } from '../types'

/**
 * Pandora.net API Scraper
 *
 * Strategy:
 * 1. Use Puppeteer to bypass Cloudflare and capture auth headers
 * 2. Use captured auth to make direct API calls with proper pagination
 * 3. Fetch ALL products across all categories
 */
class PandoraNetScraper extends BaseScraper {
  name = 'pandora-net'
  description = 'Scrapes all products from official Pandora API'

  private readonly baseUrl = 'https://us.pandora.net'

  // Categories to scrape - these are the cgid values used in the API
  private readonly categories = [
    { id: 'charms', name: 'Charms' },
    { id: 'clips', name: 'Clips' },
    { id: 'bracelets', name: 'Bracelets' },
    { id: 'necklaces', name: 'Necklaces' },
    { id: 'pendants', name: 'Pendants' },
    { id: 'earrings', name: 'Earrings' },
    { id: 'rings', name: 'Rings' },
    { id: 'watches', name: 'Watches' },
  ]

  // Captured auth headers
  private authHeaders: Record<string, string> = {}

  protected async scrape(): Promise<void> {
    this.log('Starting Pandora.net API scrape...')

    await this.launchBrowser()

    // Step 1: Capture auth headers by visiting a category page
    await this.captureAuthHeaders()

    if (!this.authHeaders['authorization']) {
      this.logError('Failed to capture auth headers, falling back to DOM scraping')
      await this.fallbackDomScrape()
      return
    }

    // Step 2: Use API to fetch all products with pagination
    for (const category of this.categories) {
      try {
        await this.scrapeCategory(category.id, category.name)
      } catch (e: any) {
        this.logError(`Failed to scrape ${category.name}: ${e.message}`)
      }
    }

    this.log(`Scrape complete. Found ${this.charmsFound} products`)
  }

  private async captureAuthHeaders(): Promise<void> {
    this.log('Capturing auth headers...')

    if (!this.browserPage) {
      await this.launchBrowser()
    }

    // Intercept requests to capture auth headers
    await this.browserPage!.setRequestInterception(true)

    const requestHandler = (request: any) => {
      const url = request.url()

      // Capture headers from product-search API calls
      if (url.includes('product-search') || url.includes('/dol/')) {
        const headers = request.headers()
        if (headers['authorization']) {
          this.authHeaders = {
            'authorization': headers['authorization'],
            'x-mobify-client-id': headers['x-mobify-client-id'] || '',
            'cookie': headers['cookie'] || '',
            'user-agent': headers['user-agent'] || 'Mozilla/5.0',
          }
          this.log(`Captured auth token: ${this.authHeaders['authorization'].substring(0, 50)}...`)
        }
      }
      request.continue()
    }

    this.browserPage!.on('request', requestHandler)

    try {
      // Navigate to a category page to trigger API calls
      await this.browserPage!.goto(`${this.baseUrl}/en/charms/`, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      })

      // Wait for API calls to complete
      await this.delay(5000)

      // Scroll to trigger more API calls if needed
      await this.browserPage!.evaluate(() => window.scrollTo(0, 1000))
      await this.delay(2000)

    } finally {
      this.browserPage!.off('request', requestHandler)
      await this.browserPage!.setRequestInterception(false)
    }
  }

  private async scrapeCategory(categoryId: string, categoryName: string): Promise<void> {
    this.log(`Scraping category: ${categoryName}`)

    const pageSize = 100
    let offset = 0
    let total = 0
    let hasMore = true

    while (hasMore) {
      try {
        // Use the correct API format: limit (not count), locale, source params
        const apiUrl = `${this.baseUrl}/mobify/proxy/dol/product-search?` +
          `limit=${pageSize}&locale=en-US&offset=${offset}&refine=cgid%3D${categoryId}&source=PWA`

        this.log(`Fetching ${apiUrl.substring(0, 80)}... (offset=${offset})`)

        const response = await this.browserPage!.evaluate(async (url: string, headers: Record<string, string>) => {
          try {
            const res = await fetch(url, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                ...headers,
              },
              credentials: 'include',
            })
            if (!res.ok) {
              return { error: `HTTP ${res.status}`, status: res.status }
            }
            const data = await res.json()
            return { data }
          } catch (e: any) {
            return { error: e.message }
          }
        }, apiUrl, this.authHeaders)

        if (response.error) {
          this.logError(`API error: ${response.error}`)
          // If auth failed, try refreshing
          if (response.status === 401) {
            this.log('Auth expired, refreshing...')
            await this.captureAuthHeaders()
            continue
          }
          break
        }

        const data = response.data
        if (!data.hits || !Array.isArray(data.hits)) {
          this.log('No hits in response, done with category')
          break
        }

        total = data.total || data.hits.length
        this.log(`Got ${data.hits.length} products (${offset + data.hits.length}/${total})`)

        // Process products
        for (const product of data.hits) {
          await this.processProduct(product, categoryId, categoryName)
        }

        offset += data.hits.length
        hasMore = offset < total && data.hits.length > 0

        // Rate limit between pages
        await this.delay(1000)

      } catch (e: any) {
        this.logError(`Error fetching page at offset ${offset}: ${e.message}`)
        break
      }
    }

    this.log(`Finished ${categoryName}: ${offset} products`)
  }

  private async fallbackDomScrape(): Promise<void> {
    this.log('Using fallback DOM scraping...')

    for (const category of this.categories) {
      try {
        await this.scrapeCategoryFromDom(category.id, category.name)
      } catch (e: any) {
        this.logError(`DOM scrape failed for ${category.name}: ${e.message}`)
      }
    }
  }

  private async scrapeCategoryFromDom(categoryId: string, categoryName: string): Promise<void> {
    this.log(`DOM scraping: ${categoryName}`)

    if (!this.browserPage) {
      await this.launchBrowser()
    }

    await this.browserPage!.goto(`${this.baseUrl}/en/${categoryId}/`, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    })

    // Scroll and click "Load More" repeatedly
    let lastCount = 0
    for (let i = 0; i < 50; i++) {
      // Scroll to bottom
      await this.browserPage!.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await this.delay(1500)

      // Try to click load more
      try {
        const loadMoreBtn = await this.browserPage!.$('button[class*="load-more"], [data-testid="load-more"]')
        if (loadMoreBtn) {
          await loadMoreBtn.click()
          await this.delay(2000)
        }
      } catch { /* no button */ }

      // Check if we got more products
      const currentCount = await this.browserPage!.evaluate(() => {
        return document.querySelectorAll('a[href*=".html"]').length
      })

      if (currentCount === lastCount) {
        break // No more products loading
      }
      lastCount = currentCount
    }

    // Extract products from DOM
    const products = await this.browserPage!.evaluate(() => {
      const results: any[] = []
      const seen = new Set<string>()

      document.querySelectorAll('a[href*=".html"]').forEach(link => {
        const href = link.getAttribute('href') || ''
        const match = href.match(/\/(\d{6}[A-Z0-9]*)\.html/i)
        if (!match) return

        const productId = match[1].toUpperCase()
        if (seen.has(productId)) return
        seen.add(productId)

        // Find parent tile
        const tile = link.closest('[class*="product"], article, li') || link.parentElement

        // Extract name
        let name = ''
        const nameEl = tile?.querySelector('[class*="name"], h2, h3, h4')
        if (nameEl?.textContent && !nameEl.textContent.match(/^\$/)) {
          name = nameEl.textContent.trim()
        }

        // Extract price
        let price: number | undefined
        const priceEl = tile?.querySelector('[class*="price"]')
        if (priceEl?.textContent) {
          const m = priceEl.textContent.match(/\$([\d,]+(?:\.\d{2})?)/)
          if (m) price = parseFloat(m[1].replace(',', ''))
        }

        // Extract image
        let imageUrl: string | undefined
        const img = tile?.querySelector('img')
        if (img) {
          imageUrl = img.src || img.getAttribute('data-src') || undefined
        }

        // Build product URL
        let productUrl = href
        if (!productUrl.startsWith('http')) {
          productUrl = 'https://us.pandora.net' + productUrl
        }

        results.push({ productId, name, price, imageUrl, productUrl })
      })

      return results
    })

    this.log(`Found ${products.length} products in DOM`)

    for (const product of products) {
      await this.processProduct({
        productId: product.productId,
        productName: product.name,
        price: product.price,
        image: product.imageUrl,
        productUrl: product.productUrl,
      }, categoryId, categoryName)
    }
  }

  private async processProduct(product: any, categoryId: string, categoryName: string): Promise<void> {
    const styleId = (product.productId || product.id || '').toUpperCase()
    if (!styleId || !/^\d{6}[A-Z0-9]*$/i.test(styleId)) return

    this.charmsFound++

    // Extract image URL
    let imageUrl: string | undefined
    if (product.image) {
      if (typeof product.image === 'string') {
        imageUrl = product.image
      } else if (product.image.disBaseLink || product.image.link) {
        imageUrl = product.image.disBaseLink || product.image.link
      }
    }
    if (product.c_images && Array.isArray(product.c_images) && product.c_images.length > 0) {
      imageUrl = product.c_images[0].disBaseLink || product.c_images[0].link || imageUrl
    }

    // Clean up product name
    let name = (product.productName || product.name || '').trim()
    name = name.replace(/^Final Sale\s*-\s*/i, '')

    // Build charm data
    const charm: ScrapedCharm = {
      styleId,
      name,
      brand: 'Pandora',
      collection: this.extractCollection(product),
      originalPrice: product.price || product.prices?.sale || product.prices?.list,
      currency: 'USD',
      region: 'US',
      description: product.shortDescription || product.longDescription,
      materials: this.extractMaterials(product),
      colors: this.extractColors(product),
      type: this.mapCategory(categoryName),
      imageUrls: imageUrl ? [imageUrl] : undefined,
      isRetired: product.orderable === false,
    }

    await this.saveCharm(charm)

    // Build product URL - simple format works for all products
    const productUrl = `${this.baseUrl}/en/${styleId}.html`

    await this.saveSighting({
      styleId: charm.styleId,
      catalogName: 'Pandora.net US',
      year: new Date().getFullYear(),
      season: 'Current',
      region: 'US',
      extractedName: charm.name,
      extractedPrice: charm.originalPrice,
      extractedCurrency: 'USD',
      extractedDescription: charm.description,
      imageUrl: imageUrl,
      sourceUrl: productUrl,
    })
  }

  private extractMaterials(product: any): string[] {
    const materials: string[] = []
    if (product.c_material) {
      if (Array.isArray(product.c_material)) materials.push(...product.c_material)
      else materials.push(product.c_material)
    }
    if (product.c_metalType) materials.push(product.c_metalType)
    return [...new Set(materials)]
  }

  private extractColors(product: any): string[] {
    const colors: string[] = []
    if (product.c_color) {
      if (Array.isArray(product.c_color)) colors.push(...product.c_color)
      else colors.push(product.c_color)
    }
    return [...new Set(colors)]
  }

  private extractCollection(product: any): string | undefined {
    // Check common collection field names in Pandora API
    const collection = product.c_collection ||
      product.collectionName ||
      product.c_brand_collection ||
      product.primaryCategoryId ||
      product.c_productLine

    if (collection && typeof collection === 'string') {
      return collection
    }

    // Try to extract from product name (Disney, Marvel, etc.)
    const name = product.productName || product.name || ''
    const collectionPatterns = [
      { pattern: /\bDisney\b/i, name: 'Disney' },
      { pattern: /\bMarvel\b/i, name: 'Marvel' },
      { pattern: /\bHarry Potter\b/i, name: 'Harry Potter' },
      { pattern: /\bGame of Thrones\b/i, name: 'Game of Thrones' },
      { pattern: /\bStar Wars\b/i, name: 'Star Wars' },
      { pattern: /\bPeanuts\b/i, name: 'Peanuts' },
      { pattern: /\bBridgerton\b/i, name: 'Bridgerton' },
      { pattern: /\bLooney Tunes\b/i, name: 'Looney Tunes' },
      { pattern: /\bSesame Street\b/i, name: 'Sesame Street' },
      { pattern: /\bME\b/, name: 'Pandora ME' },
      { pattern: /\bMoments\b/i, name: 'Moments' },
      { pattern: /\bSignature\b/i, name: 'Signature' },
      { pattern: /\bTimeless\b/i, name: 'Timeless' },
    ]

    for (const { pattern, name: collName } of collectionPatterns) {
      if (pattern.test(name)) {
        return collName
      }
    }

    return undefined
  }

  private mapCategory(categoryName: string): string {
    const map: Record<string, string> = {
      'Charms': 'charm',
      'Clips': 'clip',
      'Bracelets': 'bracelet',
      'Necklaces': 'necklace',
      'Pendants': 'pendant',
      'Earrings': 'earring',
      'Rings': 'ring',
      'Watches': 'other',
    }
    return map[categoryName] || 'other'
  }
}

export const pandoraNetModule: ScraperModule = {
  name: 'pandora-net',
  description: 'Scrapes all products from official Pandora API',
  defaultConfig: {
    enabled: true,
    cronSchedule: '0 0 * * 1',
    rateLimit: 0.5,
  },
  create: () => new PandoraNetScraper(),
}
