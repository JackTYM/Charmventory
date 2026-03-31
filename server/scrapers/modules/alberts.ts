import { BaseScraper } from '../base'
import type { ScraperModule } from '../types'

/**
 * Albert's Jewelers Scraper
 *
 * Scrapes Pandora products from albertsjewelers.com.
 * Albert's is an authorized Pandora retailer in Indiana/Illinois with ~2,000 Pandora products.
 *
 * Strategy:
 * 1. Fetch sitemap.xml to get all Pandora product URLs
 * 2. Extract style ID from URL slug (e.g., /pandora-elegant-sparkle-ring-180986cz-52/)
 * 3. Fetch each product page for name, description, and image
 *
 * Note: 30-second crawl-delay per robots.txt - this scraper will be slow
 */
class AlbertsScraper extends BaseScraper {
  name = 'alberts'
  description = "Scrapes Pandora products from Albert's Jewelers"

  private readonly baseUrl = 'https://www.albertsjewelers.com'
  private readonly sitemapUrl = 'https://www.albertsjewelers.com/sitemap.xml'
  private readonly userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  // Crawl delay from robots.txt
  private readonly crawlDelay = 30000 // 30 seconds

  private seenStyleIds = new Set<string>()

  protected async scrape(): Promise<void> {
    this.log("Starting Albert's Jewelers scrape...")
    this.log('Note: 30-second crawl delay per robots.txt - this will take a while')
    this.seenStyleIds.clear()

    // Fetch sitemap
    const sitemapResponse = await this.fetchWithUserAgent(this.sitemapUrl)
    if (!sitemapResponse.ok) {
      throw new Error(`Failed to fetch sitemap: ${sitemapResponse.status}`)
    }

    const sitemapXml = await sitemapResponse.text()

    // Extract Pandora product URLs
    const urlRegex = /<loc>(https:\/\/www\.albertsjewelers\.com\/pandora\/[^<]+\/\d+\/en)<\/loc>/gi
    const matches = [...sitemapXml.matchAll(urlRegex)]

    this.log(`Found ${matches.length} Pandora URLs in sitemap`)

    let processed = 0
    for (const match of matches) {
      const productUrl = match[1]

      // Extract style ID from URL first to check for duplicates
      const styleId = this.extractStyleIdFromUrl(productUrl)
      if (!styleId) continue

      // Skip if we've already processed this style ID
      if (this.seenStyleIds.has(styleId)) continue
      this.seenStyleIds.add(styleId)

      try {
        const product = await this.scrapeProduct(productUrl, styleId)
        if (product) {
          processed++
        }
      } catch (e: any) {
        this.logError(`Error scraping ${styleId}: ${e.message}`)
      }

      // Progress update every 25 products
      if (processed > 0 && processed % 25 === 0) {
        this.log(`Processed ${processed} products...`)
      }

      // Respect 30-second crawl delay
      await this.delay(this.crawlDelay)
    }

    this.log(`Scrape complete. Found ${this.charmsFound} unique Pandora products`)
  }

  private async fetchWithUserAgent(url: string): Promise<Response> {
    return this.fetchWithRateLimit(url, {
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
  }

  private extractStyleIdFromUrl(url: string): string | null {
    // URL format: /pandora/{product-slug}/{id}/en
    // Product slug often contains style ID like: pandora-elegant-sparkle-ring-180986cz-52
    const slugMatch = url.match(/\/pandora\/([^/]+)\/\d+\/en$/)
    if (!slugMatch) return null

    const slug = slugMatch[1]

    // Extract Pandora style ID from slug (6-7 digits + optional suffix)
    // Examples: 180986cz-52, 188421c02-56, 792307c01
    const styleIdMatch = slug.match(/(\d{5,7}[a-z]{0,3}\d{0,2})(?:-\d+)?$/i)
    if (styleIdMatch) {
      // Remove size suffix if present, uppercase
      return styleIdMatch[1].toUpperCase()
    }

    return null
  }

  private async scrapeProduct(
    url: string,
    styleId: string
  ): Promise<boolean> {
    const response = await this.fetchWithUserAgent(url)
    if (!response.ok) return false

    const html = await response.text()

    // Extract name from title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
    let name = titleMatch?.[1]?.trim() || `Product ${styleId}`

    // Clean name - remove style ID suffix if present
    name = name.replace(/\s*\d{5,7}[A-Z]{0,3}\d{0,2}(-\d+)?$/i, '').trim()

    // Extract description from meta
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
    const description = descMatch?.[1]?.slice(0, 500)

    // Extract image from og:image
    const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
    const imageUrl = imageMatch?.[1]

    // Determine product type from name or style ID
    const type = this.determineType(name, styleId)

    // Extract collection from name
    const collection = this.extractCollection(name)

    // Save charm
    await this.saveCharm({
      styleId,
      name,
      brand: 'Pandora',
      collection,
      type,
      currency: 'USD',
      region: 'US',
      description,
      imageUrls: imageUrl ? [imageUrl] : undefined,
    })

    // Save sighting
    await this.saveSighting({
      styleId,
      catalogName: "Albert's Jewelers",
      year: new Date().getFullYear(),
      season: 'Current',
      region: 'US',
      extractedName: name,
      extractedCurrency: 'USD',
      extractedDescription: description,
      imageUrl,
      sourceUrl: url,
    })

    return true
  }

  private determineType(name: string, styleId: string): string {
    const nameLower = name.toLowerCase()

    if (nameLower.includes('bracelet')) return 'bracelet'
    if (nameLower.includes('necklace') || nameLower.includes('pendant')) return 'necklace'
    if (nameLower.includes('ring')) return 'ring'
    if (nameLower.includes('earring')) return 'earring'
    if (nameLower.includes('clip')) return 'clip'
    if (nameLower.includes('safety chain')) return 'safety_chain'
    if (nameLower.includes('spacer')) return 'spacer'

    // Fallback: determine from style ID prefix
    const prefix = styleId.slice(0, 2)
    if (['59', '58'].includes(prefix)) return 'bracelet'
    if (['29', '28', '26'].includes(prefix)) return 'earring'
    if (prefix === '56') return 'ring'
    if (['39', '38'].includes(prefix)) return 'necklace'
    if (['75', '79', '78'].includes(prefix)) return 'charm'

    return 'charm'
  }

  private extractCollection(name: string): string | undefined {
    const nameLower = name.toLowerCase()

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
      { pattern: /\bessence\b/i, name: 'Essence' },
    ]

    for (const { pattern, name: collName } of collections) {
      if (pattern.test(nameLower)) {
        return collName
      }
    }

    return undefined
  }
}

export const albertsModule: ScraperModule = {
  name: 'alberts',
  description: "Scrapes Pandora products from Albert's Jewelers",
  defaultConfig: {
    enabled: true,
    cronSchedule: '0 0 1 * *', // Monthly (due to slow crawl delay)
    rateLimit: 0.033, // ~1 request per 30 seconds
  },
  create: () => new AlbertsScraper(),
}
