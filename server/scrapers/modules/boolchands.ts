import { BaseScraper } from '../base'
import type { ScraperModule } from '../types'
import { randomUUID } from 'crypto'

interface BoolchandsProduct {
  id: string
  name: string
  sku: string
  brand_esi?: string[]  // Brand is in brand_esi array
  page_slug: string
  calculated_price?: number
  price?: number
  images_ej?: string  // JSON string of images array
  categories_esai?: string[]
  variants?: string  // JSON string of variants array
}

interface BoolchandsVariant {
  sku: string
  calculated_price: number
  price: number
}

interface BoolchandsImage {
  url_zoom: string
  url_standard: string
}

interface BoolchandsSearchResponse {
  Status: string
  Data: {
    records: BoolchandsProduct[]
    _meta_: {
      total_count: number
    }
  }
}

/**
 * Boolchand's Scraper
 *
 * Scrapes Pandora products from boolchand.com using their Experro discovery API.
 * Boolchand's is a Caribbean retailer (islands like Aruba, Curacao) selling Pandora.
 */
class BoolchandsScraper extends BaseScraper {
  name = 'boolchands'
  description = "Scrapes Pandora products from Boolchand's (Caribbean retailer)"

  private readonly baseUrl = 'https://www.boolchand.com'
  private readonly apiUrl =
    'https://www.boolchand.com/apis/ecommerce-service/public/discovery/v2/search'
  private readonly pageSize = 50

  // Pandora category IDs discovered from research
  private readonly pandoraCategories = [
    { id: 'CA-fc16c3cd-3745-441d-b941-38aca376fb08-597', name: 'CHARMS' },
    { id: 'CA-fc16c3cd-3745-441d-b941-38aca376fb08-596', name: 'BRACELETS' },
    { id: 'CA-fc16c3cd-3745-441d-b941-38aca376fb08-598', name: 'EARRINGS' },
    { id: 'CA-fc16c3cd-3745-441d-b941-38aca376fb08-599', name: 'NECKLACES' },
    { id: 'CA-fc16c3cd-3745-441d-b941-38aca376fb08-600', name: 'RINGS' },
  ]

  private seenStyleIds = new Set<string>()
  private sessionId = randomUUID()
  private userId = randomUUID()

  protected async scrape(): Promise<void> {
    this.log("Starting Boolchand's scrape (browser mode)...")
    this.seenStyleIds.clear()
    this.sessionId = randomUUID()
    this.userId = randomUUID()

    // Launch browser to bypass Cloudflare
    await this.launchBrowser()

    // Navigate to Pandora page first to establish session
    this.log('Establishing session via browser...')
    await this.browserPage!.goto(`${this.baseUrl}/pandora/`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    })
    await this.delay(3000) // Wait for Cloudflare challenge

    for (const category of this.pandoraCategories) {
      await this.scrapeCategory(category)
    }

    this.log(`Scrape complete. Found ${this.charmsFound} unique Pandora products`)
  }

  private async scrapeCategory(category: {
    id: string
    name: string
  }): Promise<void> {
    this.log(`Scraping category: ${category.name}`)

    let skip = 0
    let hasMore = true
    let categoryCount = 0
    let totalInCategory = 0

    while (hasMore) {
      try {
        const result = await this.fetchPage(category, skip)

        const records = result.Data?.records || []
        if (records.length === 0) {
          hasMore = false
          break
        }

        if (totalInCategory === 0) {
          totalInCategory = result.Data?._meta_?.total_count || 0
          this.log(`Category ${category.name} has ${totalInCategory} products`)
        }

        for (const product of records) {
          const added = await this.processProduct(product, category.name)
          if (added) categoryCount++
        }

        skip += this.pageSize
        if (totalInCategory > 0 && skip >= totalInCategory) {
          hasMore = false
        }
      } catch (e: any) {
        this.logError(`Error on ${category.name} skip=${skip}: ${e.message}`)
        skip += this.pageSize
        if (skip > 5000) {
          break
        }
      }
    }

    this.log(`Category ${category.name}: ${categoryCount} unique products`)
  }

  private async fetchPage(
    category: { id: string; name: string },
    skip: number
  ): Promise<BoolchandsSearchResponse> {
    // Request all needed fields - API uses _esi/_ej suffixes for indexed fields
    const fields = [
      'brand_esi',
      'calculated_price',
      'categories_esai',
      'id',
      'images_ej',
      'name',
      'page_slug',
      'price',
      'sku',
      'variants',
    ].join(',')

    const url = `${this.apiUrl}?fields=${fields}&skip=${skip}&limit=${this.pageSize}&sort_by=relevance&include_count=true&locale=en-us`

    const body = {
      facets: [],
      categories: category.name,
      category_id: category.id,
      user_id: this.userId,
      session_id: this.sessionId,
    }

    // Rate limit
    if (this.config.rateLimit) {
      await this.delay(1000 / this.config.rateLimit)
    }

    // Use browser's fetch to bypass Cloudflare
    const result = await this.browserPage!.evaluate(async (fetchUrl: string, fetchBody: object) => {
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-customer-group-id': '0',
        },
        body: JSON.stringify(fetchBody),
      })

      if (!response.ok) {
        return { error: response.status, statusText: response.statusText }
      }

      return await response.json()
    }, url, body)

    // Handle error response
    if (result && 'error' in result) {
      throw new Error(`HTTP ${result.error}: ${result.statusText}`)
    }

    return result as BoolchandsSearchResponse
  }

  private async processProduct(
    product: BoolchandsProduct,
    categoryName: string
  ): Promise<boolean> {
    // Only process Pandora products - brand_esi is a string like "PANDORA"
    const brandField = (product as any).brand_esi || (product as any).brand
    let isPandora = false
    if (Array.isArray(brandField)) {
      isPandora = brandField.some(b => b?.toLowerCase() === 'pandora')
    } else if (typeof brandField === 'string') {
      isPandora = brandField.toLowerCase() === 'pandora'
    }
    if (!isPandora) {
      return false
    }

    // Extract style ID from SKU
    const styleId = this.extractStyleId(product.sku, product.name)

    if (!styleId) {
      return false
    }

    // Skip if we've already processed this style ID
    if (this.seenStyleIds.has(styleId)) {
      return false
    }
    this.seenStyleIds.add(styleId)

    // Parse price from variants JSON string
    let price: number | undefined
    if (product.variants) {
      try {
        const variants: BoolchandsVariant[] = JSON.parse(product.variants)
        if (variants.length > 0) {
          price = variants[0].calculated_price || variants[0].price
        }
      } catch {
        // Fallback to product-level price
        price = product.calculated_price || product.price
      }
    }

    // Parse images from images_ej JSON string
    let imageUrl: string | undefined
    if (product.images_ej) {
      try {
        const images: BoolchandsImage[] = JSON.parse(product.images_ej)
        if (images.length > 0) {
          imageUrl = images[0].url_zoom || images[0].url_standard
        }
      } catch {
        // No image available
      }
    }

    // Clean product name
    const name = this.cleanProductName(product.name || product.sku)

    // Determine product type from category
    const type = this.determineType(categoryName, styleId)

    // Extract collection from name
    const collection = this.extractCollection(name)

    // Save charm
    await this.saveCharm({
      styleId,
      name,
      brand: 'Pandora',
      collection,
      type,
      originalPrice: price,
      currency: 'USD', // Boolchand's uses USD
      region: 'Caribbean',
      imageUrls: imageUrl ? [imageUrl] : undefined,
    })

    // Save sighting
    await this.saveSighting({
      styleId,
      catalogName: "Boolchand's",
      year: new Date().getFullYear(),
      season: 'Current',
      region: 'Caribbean',
      extractedName: name,
      extractedPrice: price,
      extractedCurrency: 'USD',
      imageUrl,
      sourceUrl: `${this.baseUrl}/pandora/${product.page_slug}`,
    })

    return true
  }

  private extractStyleId(sku: string, name: string): string | null {
    // Try SKU first
    if (sku) {
      // Pandora style IDs: typically 6-7 digits with optional letter suffix
      const skuMatch = sku.match(/^(\d{5,7}[A-Z]{0,3}\d{0,2})$/i)
      if (skuMatch) {
        return skuMatch[1].toUpperCase()
      }
    }

    // Fallback: extract from name
    const nameMatch = name.match(/(\d{6,7}[A-Z]{0,3}\d{0,2})/i)
    if (nameMatch) {
      return nameMatch[1].toUpperCase()
    }

    return null
  }

  private cleanProductName(name: string): string {
    return name
      .replace(/\s*[-|]\s*Boolchand.*$/i, '')
      .replace(/\s*[-|]\s*Pandora.*$/i, '')
      .replace(/\s*[-–]\s*\d{6,7}[A-Z]?\d{0,2}\s*$/i, '')
      .trim()
  }

  private determineType(categoryName: string, styleId: string): string {
    const cat = categoryName.toLowerCase()
    if (cat.includes('bracelet')) return 'bracelet'
    if (cat.includes('necklace') || cat.includes('pendant')) return 'necklace'
    if (cat.includes('ring')) return 'ring'
    if (cat.includes('earring')) return 'earring'
    if (cat.includes('charm')) return 'charm'

    // Fallback: determine from style ID prefix
    const prefix = styleId.slice(0, 2)
    if (['59', '58'].includes(prefix)) return 'bracelet'
    if (['29', '28', '26'].includes(prefix)) return 'earring'
    if (prefix === '56') return 'ring'
    if (['39', '38'].includes(prefix)) return 'necklace'

    return 'charm'
  }

  private extractCollection(name: string): string | undefined {
    const collections: Array<{ pattern: RegExp; name: string }> = [
      { pattern: /\bdisney\b/i, name: 'Disney' },
      { pattern: /\bmarvel\b/i, name: 'Marvel' },
      { pattern: /\bharry potter\b/i, name: 'Harry Potter' },
      { pattern: /\bstar wars\b/i, name: 'Star Wars' },
      { pattern: /\bgame of thrones\b/i, name: 'Game of Thrones' },
      { pattern: /\bpeanuts\b/i, name: 'Peanuts' },
      { pattern: /\bpandora me\b/i, name: 'Pandora ME' },
      { pattern: /\bmoments\b/i, name: 'Moments' },
      { pattern: /\bsignature\b/i, name: 'Signature' },
      { pattern: /\btimeless\b/i, name: 'Timeless' },
      { pattern: /\breflexions\b/i, name: 'Reflexions' },
    ]

    for (const { pattern, name: collName } of collections) {
      if (pattern.test(name)) {
        return collName
      }
    }

    return undefined
  }
}

export const boolchandsModule: ScraperModule = {
  name: 'boolchands',
  description: "Scrapes Pandora products from Boolchand's (Caribbean retailer)",
  defaultConfig: {
    enabled: true,
    cronSchedule: '0 0 * * 5', // Weekly on Friday
    rateLimit: 1, // 1 request per second
  },
  create: () => new BoolchandsScraper(),
}
