import { BaseScraper } from '../base'
import type { ScraperModule, ScrapedCatalog, CharmSighting } from '../types'
import { db } from '../../db'
import { catalogs, catalogRevisions } from '../../db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * Flipsnack Scraper
 *
 * Scrapes Pandora digital catalogs from Flipsnack.
 * Extracts charm sightings (style ID, name, price, images) from each page.
 */
class FlipsnackScraper extends BaseScraper {
  name = 'flipsnack'
  description = 'Scrapes Pandora catalogs from Flipsnack, extracting charm data'

  // Known catalog URLs (published + unlisted)
  private readonly knownCatalogs = [
    // Published catalogs page
    { url: 'https://www.flipsnack.com/pandoranorthamerica/', type: 'index' },

    // Unlisted catalogs - US
    { url: 'https://www.flipsnack.com/pandoranorthamerica/2024-product-catalog-us.html', region: 'US', year: 2024, season: 'Year-Round' },
    { url: 'https://www.flipsnack.com/pandoranorthamerica/autumn-winter-2024-product-catalog-us.html', region: 'US', year: 2024, season: 'Autumn' },
    { url: 'https://www.flipsnack.com/pandoranorthamerica/diamonds-catalog-2025-us.html', region: 'US', year: 2025, season: 'Diamonds' },
    { url: 'https://www.flipsnack.com/pandoranorthamerica/q425_g_eoss_flipsnack_us/full-view.html', region: 'US', year: 2024, season: 'Q4 EOSS' },

    // Unlisted catalogs - CA
    { url: 'https://www.flipsnack.com/pandoranorthamerica/q425_g_eoss_flipsnack_ca/full-view.html', region: 'CA', year: 2024, season: 'Q4 EOSS' },

    // Add more known URLs here as discovered
  ]

  // Patterns to parse catalog URLs
  private readonly urlPatterns = [
    // 2024-product-catalog-us -> Year-Round 2024 US
    { pattern: /(\d{4})-product-catalog-(\w+)/i, parse: (m: RegExpMatchArray) => ({ year: parseInt(m[1]), season: 'Year-Round', region: m[2].toUpperCase() }) },
    // autumn-winter-2024-product-catalog-us -> Autumn 2024 US
    { pattern: /(spring|summer|autumn|fall|winter)[-_]?(winter|summer)?[-_]?(\d{4})[-_]?product[-_]?catalog[-_]?(\w+)/i, parse: (m: RegExpMatchArray) => ({ year: parseInt(m[3]), season: m[1].charAt(0).toUpperCase() + m[1].slice(1), region: m[4].toUpperCase() }) },
    // ipc-aw25-ca -> Autumn 2025 CA
    { pattern: /ipc[-_]?(ss|aw|fw|sp|su|ho)(\d{2})[-_]?(\w+)/i, parse: (m: RegExpMatchArray) => {
      const seasonMap: Record<string, string> = { ss: 'Spring', aw: 'Autumn', fw: 'Autumn', sp: 'Spring', su: 'Summer', ho: 'Holiday' }
      return { year: 2000 + parseInt(m[2]), season: seasonMap[m[1].toLowerCase()] || m[1], region: m[3].toUpperCase() }
    }},
    // diamonds-catalog-2025-us -> Diamonds 2025 US
    { pattern: /(\w+)[-_]catalog[-_](\d{4})[-_](\w+)/i, parse: (m: RegExpMatchArray) => ({ year: parseInt(m[2]), season: m[1].charAt(0).toUpperCase() + m[1].slice(1), region: m[3].toUpperCase() }) },
    // q425_g_eoss_flipsnack_us -> Q4 2024 US (EOSS = End of Season Sale)
    { pattern: /q(\d)(\d{2}).*?(\w{2})(?:\/|\.)/i, parse: (m: RegExpMatchArray) => ({ year: 2000 + parseInt(m[2]), season: `Q${m[1]}`, region: m[3].toUpperCase() }) },
  ]

  protected async scrape(): Promise<void> {
    this.log('Starting Flipsnack scrape...')

    // Launch browser for loading Flipsnack pages
    await this.launchBrowser()

    const processedUrls = new Set<string>()

    // First, scrape the main index page to find all published catalogs
    try {
      const indexUrls = await this.scrapeIndexPage()
      for (const catalogUrl of indexUrls) {
        if (!processedUrls.has(catalogUrl)) {
          processedUrls.add(catalogUrl)
          await this.processCatalog(catalogUrl)
        }
      }
    } catch (e: any) {
      this.logError(`Failed to scrape index page: ${e.message}`)
    }

    // Then process known unlisted catalogs
    for (const catalog of this.knownCatalogs) {
      if (catalog.type === 'index') continue
      if (processedUrls.has(catalog.url)) continue

      processedUrls.add(catalog.url)
      await this.processCatalog(catalog.url, catalog)
    }

    this.log(`Scrape complete. Catalogs: ${this.catalogsFound}, Sightings: ${this.sightingsAdded}`)
  }

  private async scrapeIndexPage(): Promise<string[]> {
    const url = 'https://www.flipsnack.com/pandoranorthamerica/'
    this.log(`Fetching index page: ${url}`)

    // Must use browser - page loads catalogs dynamically via JS
    if (!this.browserPage) {
      await this.launchBrowser()
    }

    await this.browserPage!.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    // Wait for publications to load
    await this.delay(2000)

    // Click "Load More" button repeatedly to load all catalogs
    for (let i = 0; i < 10; i++) {
      try {
        const loadMoreBtn = await this.browserPage!.$('button:has-text("Load More"), .load-more, [class*="load-more"]')
        if (loadMoreBtn) {
          await loadMoreBtn.click()
          await this.delay(1500)
        } else {
          break
        }
      } catch {
        break
      }
    }

    // Extract catalog links from rendered page
    const catalogUrls = await this.browserPage!.evaluate(() => {
      const urls: string[] = []
      // Look for links to flipsnack catalogs
      document.querySelectorAll('a[href*="/pandoranorthamerica/"]').forEach(link => {
        const href = link.getAttribute('href')
        if (href && (href.endsWith('.html') || href.includes('/full-view'))) {
          const fullUrl = href.startsWith('http') ? href : `https://www.flipsnack.com${href}`
          urls.push(fullUrl)
        }
      })
      return urls
    })

    this.log(`Found ${catalogUrls.length} catalogs on index page`)
    return [...new Set(catalogUrls)]
  }

  private async processCatalog(url: string, knownMeta?: { region?: string; year?: number; season?: string }): Promise<void> {
    this.log(`Processing catalog: ${url}`)

    // Parse metadata from URL if not provided
    let meta = knownMeta || this.parseUrlMetadata(url)
    if (!meta.region) meta.region = 'US' // Default to US
    if (!meta.year) meta.year = new Date().getFullYear()
    if (!meta.season) meta.season = 'Unknown'

    const catalogName = `${meta.season} ${meta.year} ${meta.region}`

    try {
      // Convert URL to full-view URL if needed
      let fullViewUrl = url
      if (!url.includes('full-view.html')) {
        // Extract catalog slug and convert to full-view
        const slugMatch = url.match(/\/pandoranorthamerica\/([^\/]+?)(?:\.html)?$/)
        if (slugMatch) {
          fullViewUrl = `https://www.flipsnack.com/pandoranorthamerica/${slugMatch[1]}/full-view.html`
        }
      }

      this.log(`Loading full-view URL: ${fullViewUrl}`)

      // Use browser to load the page and intercept the data.json request
      const dataJsonUrl = await this.interceptDataJson(fullViewUrl)

      if (!dataJsonUrl) {
        this.logError(`Could not find data.json URL for ${url}`)
        return
      }

      this.log(`Found data.json URL: ${dataJsonUrl.substring(0, 80)}...`)

      // Fetch the data.json
      const dataResponse = await this.fetchWithRateLimit(dataJsonUrl)
      if (!dataResponse.ok) {
        this.logError(`Failed to fetch data.json: ${dataResponse.status}`)
        return
      }

      const catalogData = await dataResponse.json()
      this.catalogsFound++

      // Extract charm data from the JSON
      await this.extractCharmsFromDataJson(catalogData, {
        ...meta,
        catalogName,
        sourceUrl: url,
      })
    } catch (e: any) {
      this.logError(`Error processing catalog ${url}: ${e.message}`)
    }
  }

  // Store page image URLs captured during interception
  private pageImageUrls: Map<number, string> = new Map()

  private async interceptDataJson(url: string): Promise<string | null> {
    if (!this.browserPage) {
      await this.launchBrowser()
    }

    let dataJsonUrl: string | null = null
    this.pageImageUrls.clear()

    // Set up request interception to capture the data.json URL and page images
    await this.browserPage!.setRequestInterception(true)

    const requestHandler = (request: any) => {
      const reqUrl = request.url()
      if (reqUrl.includes('data.json') && reqUrl.includes('cloudfront.net')) {
        dataJsonUrl = reqUrl
      }
      // Capture page images - they usually have patterns like /pages/ or page numbers
      if (reqUrl.includes('cloudfront.net') && (reqUrl.includes('/pages/') || reqUrl.match(/\/\d+\.(jpg|png|webp)/i))) {
        // Try to extract page number from URL
        const pageMatch = reqUrl.match(/\/pages?\/(\d+)|\/(\d+)\.(jpg|png|webp)/i)
        if (pageMatch) {
          const pageNum = parseInt(pageMatch[1] || pageMatch[2])
          if (!isNaN(pageNum)) {
            this.pageImageUrls.set(pageNum, reqUrl)
          }
        }
      }
      request.continue()
    }

    this.browserPage!.on('request', requestHandler)

    try {
      await this.browserPage!.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
      // Brief wait for data.json request to be captured
      await this.delay(1000)
    } catch (e: any) {
      this.log(`Navigation warning: ${e.message}`)
    }

    // Clean up
    this.browserPage!.off('request', requestHandler)
    await this.browserPage!.setRequestInterception(false)

    return dataJsonUrl
  }

  private async extractCharmsFromDataJson(
    data: any,
    meta: { region?: string; year?: number; season?: string; catalogName: string; sourceUrl: string }
  ): Promise<void> {
    // Flipsnack data.json can have different structures
    // Try to find all elements/layers with product data

    const allLayers = this.findAllLayers(data)
    const seenStyleIds = new Set<string>()

    for (const layer of allLayers) {
      // Check if this layer has product attributes
      const attrs = layer.attributes
      if (!attrs) continue

      const styleId = attrs.code || layer.layerLabel
      if (!styleId) continue

      // Validate style ID format (6 digits + optional suffix)
      if (!/^\d{6}[A-Z0-9]*$/i.test(styleId)) continue

      // Skip duplicates within this catalog
      if (seenStyleIds.has(styleId.toUpperCase())) continue
      seenStyleIds.add(styleId.toUpperCase())

      this.charmsFound++
      const pageIndex = layer.pageIndex || 0

      // Extract product images from media array
      // Flipsnack stores images as hashes that need to be combined with cloudfront base URL
      const images: string[] = []
      const FLIPSNACK_IMAGE_BASE = 'https://d160aj0mj3npgx.cloudfront.net/A769E699E8C/library/external/'

      // Check media array for image hashes
      if (attrs.media && Array.isArray(attrs.media)) {
        for (const media of attrs.media) {
          if (media.hash && typeof media.hash === 'string' && media.hash.length === 32) {
            // Construct the full cloudfront URL from the hash
            const imgUrl = FLIPSNACK_IMAGE_BASE + media.hash
            images.push(imgUrl)
          }
          // Also check for direct URLs just in case
          const url = media.url || media.src || media.imageUrl
          if (url && typeof url === 'string' && url.startsWith('http')) {
            images.push(url)
          }
        }
      }


      // Also search the entire layer for media arrays we might have missed
      const findMediaHashes = (obj: any): void => {
        if (!obj || typeof obj !== 'object') return
        if (Array.isArray(obj)) {
          for (const item of obj) {
            findMediaHashes(item)
          }
          return
        }
        // Check if this object has a hash and looks like a media object
        if (obj.hash && typeof obj.hash === 'string' && obj.hash.length === 32) {
          images.push(FLIPSNACK_IMAGE_BASE + obj.hash)
        }
        for (const value of Object.values(obj)) {
          if (typeof value === 'object') {
            findMediaHashes(value)
          }
        }
      }
      findMediaHashes(layer)

      // Deduplicate
      const validImages = [...new Set(images)]

      // Save as charm
      await this.saveCharm({
        styleId: styleId.toUpperCase(),
        name: attrs.title || '',
        brand: 'Pandora',
        description: attrs.description,
        originalPrice: attrs.price ? parseFloat(attrs.price) : undefined,
        currency: 'USD',
        region: meta.region,
        imageUrls: validImages.length > 0 ? validImages : undefined,
      })

      // Save sighting (without images since Flipsnack doesn't provide reliable product image URLs)
      await this.saveSighting({
        styleId: styleId.toUpperCase(),
        catalogName: meta.catalogName,
        year: meta.year,
        season: meta.season,
        region: meta.region,
        pageNumber: pageIndex + 1,
        extractedName: attrs.title,
        extractedPrice: attrs.price ? parseFloat(attrs.price) : undefined,
        extractedCurrency: 'USD',
        extractedDescription: attrs.description?.slice(0, 500),
        imageUrl: validImages[0], // Only save if we have a valid image
        sourceUrl: `${meta.sourceUrl}#page=${pageIndex + 1}`,
      })
    }

    this.log(`Extracted ${seenStyleIds.size} unique charms from catalog`)
  }

  private findAllLayers(data: any, layers: any[] = []): any[] {
    if (!data || typeof data !== 'object') return layers

    // If this object has attributes and looks like a layer, add it
    if (data.attributes || data.layerLabel) {
      layers.push(data)
    }

    // Recursively search arrays and objects
    if (Array.isArray(data)) {
      for (const item of data) {
        this.findAllLayers(item, layers)
      }
    } else {
      for (const value of Object.values(data)) {
        this.findAllLayers(value, layers)
      }
    }

    return layers
  }

  private parseUrlMetadata(url: string): { region?: string; year?: number; season?: string } {
    for (const { pattern, parse } of this.urlPatterns) {
      const match = url.match(pattern)
      if (match) {
        return parse(match)
      }
    }
    return {}
  }

}

// Module export
export const flipsnackModule: ScraperModule = {
  name: 'flipsnack',
  description: 'Scrapes Pandora catalogs from Flipsnack, extracting charm data',
  defaultConfig: {
    enabled: true,
    cronSchedule: '0 0 * * 0', // Weekly on Sunday
    rateLimit: 0.5, // 1 request per 2 seconds
  },
  create: () => new FlipsnackScraper(),
}
