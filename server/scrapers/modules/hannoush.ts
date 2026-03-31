import { BaseScraper } from '../base'
import type { ScraperModule } from '../types'

interface ShopifyProduct {
  id: number
  title: string
  handle: string
  body_html: string
  vendor: string
  product_type: string
  created_at: string
  updated_at: string
  tags: string[]
  variants: Array<{
    id: number
    sku: string
    price: string
    compare_at_price: string | null
    available: boolean
  }>
  images: Array<{
    id: number
    src: string
    width: number
    height: number
  }>
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[]
}

/**
 * Hannoush Jewelers Scraper
 *
 * Scrapes Pandora products from hannoush.com using Shopify's JSON API.
 * Hannoush is an authorized Pandora retailer with ~2,340 Pandora products.
 */
class HannoushScraper extends BaseScraper {
  name = 'hannoush'
  description = 'Scrapes Pandora products from Hannoush.com (Shopify)'

  private readonly baseUrl = 'https://www.hannoush.com'
  private readonly pageSize = 50 // Smaller page size for reliability

  protected async scrape(): Promise<void> {
    this.log('Starting Hannoush scrape...')

    // Note: Shopify collection API caps at ~180 products through JSON endpoint
    // This is a known Shopify limitation for storefront API
    let page = 1
    let hasMore = true

    while (hasMore) {
      try {
        const products = await this.fetchPage(page)

        if (products.length === 0) {
          hasMore = false
          break
        }

        this.log(`Page ${page}: ${products.length} products`)

        for (const product of products) {
          await this.processProduct(product)
        }

        // Shopify returns fewer than limit when on last page
        if (products.length < this.pageSize) {
          hasMore = false
        } else {
          page++
        }
      } catch (e: any) {
        this.logError(`Error on page ${page}: ${e.message}`)
        page++
        if (page > 20) {
          this.log('Reached page limit, stopping')
          break
        }
      }
    }

    this.log(`Scrape complete. Found ${this.charmsFound} Pandora products`)
  }

  private async fetchPage(page: number): Promise<ShopifyProduct[]> {
    // Use collection endpoint - limited to ~180 products but reliable
    const url = `${this.baseUrl}/collections/pandora/products.json?limit=${this.pageSize}&page=${page}`

    const response = await this.fetchWithRateLimit(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = (await response.json()) as ShopifyProductsResponse
    return data.products || []
  }

  private async processProduct(product: ShopifyProduct): Promise<void> {
    // Verify it's a Pandora product
    if (product.vendor?.toLowerCase() !== 'pandora') {
      return
    }

    // Extract style ID from SKU (first variant's SKU is usually the style ID)
    const sku = product.variants[0]?.sku || ''
    const styleId = this.extractStyleId(sku, product.title)

    if (!styleId) {
      return
    }

    // Get price from first available variant
    const variant = product.variants.find((v) => v.available) || product.variants[0]
    const price = variant ? parseFloat(variant.price) : undefined

    // Get primary image
    const imageUrl = product.images[0]?.src

    // Clean product name
    const name = this.cleanProductName(product.title)

    // Extract collection from tags or title
    const collection = this.extractCollection(product.tags, product.title)

    // Determine product type
    const type = this.determineType(product.product_type, product.tags, styleId)

    // Clean description
    const description = product.body_html
      ? product.body_html
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 500)
      : undefined

    // Save charm
    await this.saveCharm({
      styleId,
      name,
      brand: 'Pandora',
      collection,
      type,
      originalPrice: price,
      currency: 'USD',
      region: 'US',
      description,
      imageUrls: imageUrl ? [imageUrl] : undefined,
    })

    // Save sighting
    await this.saveSighting({
      styleId,
      catalogName: 'Hannoush.com',
      year: new Date().getFullYear(),
      season: 'Current',
      region: 'US',
      extractedName: name,
      extractedPrice: price,
      extractedCurrency: 'USD',
      extractedDescription: description,
      imageUrl,
      sourceUrl: `${this.baseUrl}/products/${product.handle}`,
    })
  }

  private extractStyleId(sku: string, title: string): string | null {
    // Try SKU first (most reliable)
    if (sku) {
      // Pandora style IDs: 6-7 digits optionally followed by letter+digits
      // SKU may have size suffix like "150184CZ-56" - remove it
      const cleanSku = sku.split('-')[0]
      const skuMatch = cleanSku.match(/^(\d{5,7}[A-Z]{0,3}\d{0,2})$/i)
      if (skuMatch) {
        return skuMatch[1].toUpperCase()
      }
    }

    // Fallback: extract from title
    const titlePatterns = [
      /[-\s(](\d{6,7}[A-Z]?\d{0,2})[\s),-]?/i,
      /\b(79\d{4}[A-Z]?\d{0,2})\b/i, // Charms
      /\b(59\d{4}[A-Z]{0,2}\d{0,2})\b/i, // Bracelets
      /\b(56\d{4}[A-Z]?\d{0,2})\b/i, // Rings
      /\b(29\d{4}[A-Z]?\d{0,2})\b/i, // Earrings
      /\b(39\d{4}[A-Z]?\d{0,2})\b/i, // Necklaces
    ]

    for (const pattern of titlePatterns) {
      const match = title.match(pattern)
      if (match) {
        return match[1].toUpperCase()
      }
    }

    return null
  }

  private cleanProductName(title: string): string {
    return title
      .replace(/\s*[-|]\s*Hannoush.*$/i, '')
      .replace(/\s*[-|]\s*Pandora.*$/i, '')
      .replace(/\s*[-–]\s*\d{6,7}[A-Z]?\d{0,2}\s*$/i, '')
      .trim()
  }

  private extractCollection(tags: string[], title: string): string | undefined {
    const allText = [...tags, title].join(' ').toLowerCase()

    const collections: Array<{ pattern: RegExp; name: string }> = [
      { pattern: /\bdisney\b/i, name: 'Disney' },
      { pattern: /\bmarvel\b/i, name: 'Marvel' },
      { pattern: /\bharry potter\b/i, name: 'Harry Potter' },
      { pattern: /\bstar wars\b/i, name: 'Star Wars' },
      { pattern: /\bgame of thrones\b/i, name: 'Game of Thrones' },
      { pattern: /\bpeanuts\b/i, name: 'Peanuts' },
      { pattern: /\bbridgerton\b/i, name: 'Bridgerton' },
      { pattern: /\bpandora me\b/i, name: 'Pandora ME' },
      { pattern: /\bmoments\b/i, name: 'Moments' },
      { pattern: /\bsignature\b/i, name: 'Signature' },
      { pattern: /\btimeless\b/i, name: 'Timeless' },
      { pattern: /\breflexions\b/i, name: 'Reflexions' },
      { pattern: /\bessence\b/i, name: 'Essence' },
    ]

    for (const { pattern, name } of collections) {
      if (pattern.test(allText)) {
        return name
      }
    }

    return undefined
  }

  private determineType(
    productType: string,
    tags: string[],
    styleId: string
  ): string {
    const allText = [productType, ...tags].join(' ').toLowerCase()

    // Check product type and tags
    if (allText.includes('bracelet')) return 'bracelet'
    if (allText.includes('necklace') || allText.includes('pendant'))
      return 'necklace'
    if (allText.includes('ring')) return 'ring'
    if (allText.includes('earring')) return 'earring'
    if (allText.includes('clip')) return 'clip'
    if (allText.includes('safety chain')) return 'safety_chain'
    if (allText.includes('murano')) return 'murano'

    // Fallback: determine from style ID prefix
    const prefix = styleId.slice(0, 2)
    if (['59', '58'].includes(prefix)) return 'bracelet'
    if (['29', '28', '26'].includes(prefix)) return 'earring'
    if (prefix === '56') return 'ring'
    if (['39', '38'].includes(prefix)) return 'necklace'

    return 'charm'
  }
}

export const hannoushModule: ScraperModule = {
  name: 'hannoush',
  description: 'Scrapes Pandora products from Hannoush.com (Shopify)',
  defaultConfig: {
    enabled: true,
    cronSchedule: '0 0 * * 3', // Weekly on Wednesday
    rateLimit: 1, // 1 request per second (respectful for Shopify)
  },
  create: () => new HannoushScraper(),
}
