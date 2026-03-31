import { BaseScraper } from '../base'
import type { ScraperModule } from '../types'

interface ParsedProduct {
  styleId: string
  name: string
  price?: number
  currency: string
  imageUrl?: string
  sourceUrl: string
  timestamp: string
}

/**
 * Ben Bridge Archive Scraper
 *
 * Scrapes historical Pandora products from Ben Bridge via archive.org.
 * Ben Bridge no longer sells Pandora, but archive.org has snapshots from 2018-2023
 * with sitemaps listing 700-900+ Pandora products.
 *
 * Strategy:
 * 1. Fetch archived sitemaps to get Pandora product URLs
 * 2. Parse each archived product page for style ID, name, price, image
 */
class BenBridgeArchiveScraper extends BaseScraper {
  name = 'benbridge-archive'
  description = 'Scrapes historical Pandora data from Ben Bridge via Archive.org'

  private readonly waybackApi = 'https://web.archive.org'

  // Known archived sitemaps with Pandora products
  private readonly archivedSitemaps = [
    { timestamp: '20211113224137', url: 'https://www.benbridge.com/sitemap_0.xml' },
    { timestamp: '20200516230146', url: 'https://www.benbridge.com/sitemap_0.xml' },
    { timestamp: '20200426191143', url: 'https://www.benbridge.com/sitemap_0.xml' },
  ]

  private seenStyleIds = new Set<string>()

  protected async scrape(): Promise<void> {
    this.log('Starting Ben Bridge archive scrape...')
    this.seenStyleIds.clear()

    for (const sitemap of this.archivedSitemaps) {
      try {
        await this.scrapeSitemap(sitemap.timestamp, sitemap.url)
      } catch (e: any) {
        this.logError(`Failed to scrape sitemap ${sitemap.timestamp}: ${e.message}`)
      }
    }

    this.log(`Scrape complete. Found ${this.charmsFound} unique Pandora products`)
  }

  private async scrapeSitemap(timestamp: string, sitemapUrl: string): Promise<void> {
    const archiveUrl = `${this.waybackApi}/web/${timestamp}/${sitemapUrl}`
    this.log(`Fetching sitemap: ${archiveUrl}`)

    const response = await this.fetchWithRateLimit(archiveUrl)
    if (!response.ok) {
      this.logError(`Failed to fetch sitemap: ${response.status}`)
      return
    }

    const xml = await response.text()

    // Extract Pandora product URLs from sitemap
    const urlRegex = /<loc>(https?:\/\/www\.benbridge\.com\/jewelry\/pandora[^<]+)<\/loc>/gi
    const matches = [...xml.matchAll(urlRegex)]

    this.log(`Found ${matches.length} Pandora URLs in sitemap`)

    let processed = 0
    for (const match of matches) {
      const productUrl = match[1]

      try {
        const product = await this.scrapeProduct(timestamp, productUrl)
        if (product && !this.seenStyleIds.has(product.styleId)) {
          this.seenStyleIds.add(product.styleId)
          await this.saveProduct(product)
          processed++
        }
      } catch (e: any) {
        // Silently skip failed pages
      }

      // Progress update every 50 products
      if (processed > 0 && processed % 50 === 0) {
        this.log(`Processed ${processed} products...`)
      }
    }

    this.log(`Scraped ${processed} unique products from ${timestamp} sitemap`)
  }

  private async scrapeProduct(timestamp: string, productUrl: string): Promise<ParsedProduct | null> {
    const archiveUrl = `${this.waybackApi}/web/${timestamp}/${productUrl}`

    const response = await this.fetchWithRateLimit(archiveUrl)
    if (!response.ok) return null

    const html = await response.text()

    // Extract style ID from title: "Pandora Heart Clip 14K - 750243 | Ben Bridge Jeweler"
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
    if (!titleMatch) return null

    const titleParts = titleMatch[1].split(' - ')
    if (titleParts.length < 2) return null

    // Style ID is the last part before "| Ben Bridge"
    const styleIdPart = titleParts[titleParts.length - 1].split('|')[0].trim()
    // Pandora style IDs: 6-7 digits optionally followed by letters
    const styleIdMatch = styleIdPart.match(/^(\d{5,7}[A-Z]{0,3}\d{0,2})$/i)
    if (!styleIdMatch) return null

    const styleId = styleIdMatch[1].toUpperCase()
    const name = titleParts[0].trim()

    // Extract price from meta or itemprop
    let price: number | undefined
    const priceMatch = html.match(/itemprop="price"\s+content="([\d.]+)"/i) ||
                       html.match(/'price':\s*'([\d.]+)'/i)
    if (priceMatch) {
      price = parseFloat(priceMatch[1])
    }

    // Extract image URL
    let imageUrl: string | undefined
    const imageMatch = html.match(/class="[^"]*primary-image[^"]*"[^>]*src="([^"]+)"/i) ||
                       html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                       html.match(/data-lgimg[^>]*hires[^>]*:\s*["']([^"']+)["']/i)
    if (imageMatch) {
      imageUrl = this.processImageUrl(imageMatch[1], timestamp)
    }

    return {
      styleId,
      name,
      price,
      currency: 'USD',
      imageUrl,
      sourceUrl: archiveUrl,
      timestamp,
    }
  }

  private processImageUrl(url: string, timestamp: string): string {
    // If already a wayback URL, return as-is
    if (url.includes('web.archive.org')) {
      return url
    }

    // Clean URL (remove wayback prefix if double-wrapped)
    let cleanUrl = url
    if (cleanUrl.startsWith('/web/')) {
      cleanUrl = `https://web.archive.org${cleanUrl}`
    } else if (!cleanUrl.startsWith('http')) {
      cleanUrl = `https://www.benbridge.com${cleanUrl}`
    }

    // Wrap non-wayback URLs
    if (!cleanUrl.includes('web.archive.org')) {
      return `${this.waybackApi}/web/${timestamp}im_/${cleanUrl}`
    }

    return cleanUrl
  }

  private async saveProduct(product: ParsedProduct): Promise<void> {
    const year = parseInt(product.timestamp.slice(0, 4))
    const month = parseInt(product.timestamp.slice(4, 6))

    // Determine product type from name or style ID
    const type = this.determineType(product.name, product.styleId)

    // Extract collection from name
    const collection = this.extractCollection(product.name)

    // Clean name (remove "Pandora" prefix if present)
    const cleanName = product.name
      .replace(/^Pandora\s+/i, '')
      .trim()

    await this.saveCharm({
      styleId: product.styleId,
      name: cleanName,
      brand: 'Pandora',
      collection,
      type,
      originalPrice: product.price,
      currency: product.currency,
      region: 'US',
      imageUrls: product.imageUrl ? [product.imageUrl] : undefined,
    })

    await this.saveSighting({
      styleId: product.styleId,
      catalogName: 'Ben Bridge Archive',
      year,
      season: `${this.getSeason(month)} ${year}`,
      region: 'US',
      extractedName: cleanName,
      extractedPrice: product.price,
      extractedCurrency: product.currency,
      imageUrl: product.imageUrl,
      sourceUrl: product.sourceUrl,
    })
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

  private getSeason(month: number): string {
    if (month >= 3 && month <= 5) return 'Spring'
    if (month >= 6 && month <= 8) return 'Summer'
    if (month >= 9 && month <= 11) return 'Autumn'
    return 'Winter'
  }
}

export const benbridgeArchiveModule: ScraperModule = {
  name: 'benbridge-archive',
  description: 'Scrapes historical Pandora data from Ben Bridge via Archive.org',
  defaultConfig: {
    enabled: true,
    cronSchedule: '0 0 1 * *', // Monthly (archive data is static)
    rateLimit: 0.5, // Be gentle with archive.org
  },
  create: () => new BenBridgeArchiveScraper(),
}
