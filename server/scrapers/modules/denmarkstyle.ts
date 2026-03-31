import { BaseScraper } from '../base'
import type { ScraperModule, ScrapedCharm } from '../types'

/**
 * DenmarkStyle Scraper
 *
 * Scrapes product data from denmarkstyle.net by incrementing product IDs.
 * This is an authorized Pandora reseller with a simple URL structure.
 */
class DenmarkStyleScraper extends BaseScraper {
  name = 'denmarkstyle'
  description = 'Scrapes products from DenmarkStyle.net (authorized reseller)'

  private readonly baseUrl = 'https://www.denmarkstyle.net'
  private readonly maxConsecutive404s = 500 // Stop after 500 consecutive 404s (no max ID limit)

  protected async scrape(): Promise<void> {
    this.log('Starting DenmarkStyle scrape...')

    let consecutive404s = 0
    let lastValidId = 0

    // Keep incrementing until we hit 500 consecutive 404s
    for (let pid = 1; ; pid++) {
      try {
        const found = await this.scrapeProduct(pid)

        if (found) {
          consecutive404s = 0
          lastValidId = pid

          // Log progress every 100 products
          if (this.charmsFound % 100 === 0) {
            this.log(`Progress: ${this.charmsFound} products found (ID ${pid})`)
          }
        } else {
          consecutive404s++

          // Stop if we've hit too many consecutive 404s (likely past the end)
          if (consecutive404s >= this.maxConsecutive404s) {
            this.log(`Stopping: ${consecutive404s} consecutive 404s after ID ${lastValidId}`)
            break
          }
        }
      } catch (e: any) {
        this.logError(`Error on product ${pid}: ${e.message}`)
        consecutive404s++
      }
    }

    this.log(`Scrape complete. Found ${this.charmsFound} products, saved ${this.sightingsAdded} sightings`)
  }

  private async scrapeProduct(pid: number): Promise<boolean> {
    const url = `${this.baseUrl}/product.php?pid=${pid}`

    const response = await this.fetchWithRateLimit(url)

    // Check for 404 or redirect to homepage
    if (!response.ok || response.url === this.baseUrl || response.url.includes('index')) {
      return false
    }

    const html = await response.text()

    // Check if it's actually a product page (not a "product not found" page)
    if (html.includes('Product not found') ||
        html.includes('Page not found') ||
        html.includes('No product') ||
        !html.includes('product')) {
      return false
    }

    // Extract product data
    const product = this.parseProductPage(html, url, pid)

    if (product && product.styleId) {
      this.charmsFound++

      // Save charm data
      await this.saveCharm(product)

      // Save sighting
      await this.saveSighting({
        styleId: product.styleId,
        catalogName: 'DenmarkStyle.net',
        year: new Date().getFullYear(),
        season: 'Current',
        region: 'US', // They're a US retailer
        extractedName: product.name,
        extractedPrice: product.originalPrice,
        extractedCurrency: 'USD',
        extractedDescription: product.description,
        imageUrl: product.imageUrls?.[0],
        sourceUrl: url,
      })

      return true
    }

    return false
  }

  private parseProductPage(html: string, url: string, pid: number): ScrapedCharm | null {
    // First, try to extract the style ID from the title or h1 (most reliable)
    // Format: "Product Name - XXXXXX" or "Product Name (XXXXXX)"
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<h2[^>]*class="[^"]*product[^"]*"[^>]*>([^<]+)<\/h2>/i)

    let styleId: string | null = null
    const titleText = (titleMatch?.[1] || '') + ' ' + (h1Match?.[1] || '')

    // Look for style ID in title/heading first (most accurate)
    // Pandora style IDs: 6-7 digits optionally followed by letter+digits (e.g., 750359D, 792812C01)
    const titleStyleMatch = titleText.match(/[-\s(](\d{6,7}[A-Z]?\d{0,2})[\s),-]?/i)
    if (titleStyleMatch) {
      styleId = titleStyleMatch[1].toUpperCase()
    }

    // Fallback: look for style ID patterns, but only in the first half of the page
    // (to avoid matching related products at the bottom)
    if (!styleId) {
      const topHalf = html.slice(0, html.length / 2)
      const styleIdPatterns = [
        /(?:style|item|sku|product)[\s#:]*(\d{6,7}[A-Z]?\d{0,2})/i,
        /\b(75\d{4}[A-Z]{0,2}\d{0,2})\b/i,  // 14K Gold: 75XXXX
        /\b(79\d{4}[A-Z]?\d{0,2})\b/i,       // Charms: 79XXXX
        /\b(59\d{4}[A-Z]{0,2})\b/i,          // Bracelets: 59XXXX
        /\b(58\d{4}[A-Z]?\d{0,2})\b/i,       // Earrings: 58XXXX
        /\b(56\d{4}[A-Z]?\d{0,2})\b/i,       // Rings: 56XXXX
        /\b(39\d{4}[A-Z]?\d{0,2})\b/i,       // Necklaces: 39XXXX
      ]

      for (const pattern of styleIdPatterns) {
        const match = topHalf.match(pattern)
        if (match) {
          styleId = match[1].toUpperCase()
          break
        }
      }
    }

    if (!styleId) return null

    // Extract product name from title/h1
    let name = ''
    if (h1Match) {
      name = h1Match[1].trim()
        .replace(/\s*[-|]\s*DenmarkStyle.*$/i, '')
        .replace(/\s*[-|]\s*Pandora.*$/i, '')
        .replace(/\s*[-–]\s*\d{6,7}[A-Z]?\d{0,2}\s*$/i, '') // Remove trailing style ID
        .trim()
    }
    if (!name && titleMatch) {
      name = titleMatch[1].trim()
        .replace(/\s*[-|]\s*DenmarkStyle.*$/i, '')
        .replace(/\s*[-|]\s*Pandora.*$/i, '')
        .replace(/\s*[-–]\s*\d{6,7}[A-Z]?\d{0,2}\s*$/i, '')
        .trim()
    }
    if (!name) name = `Product ${styleId}`

    // Extract price - DenmarkStyle shows "Price: $XX"
    // IMPORTANT: Only look in the main product area, NOT in "You may also enjoy" sections
    let price: number | undefined

    // Find the main product section (before related products)
    const relatedIndex = html.search(/you may also enjoy|related products|similar items/i)
    const mainContent = relatedIndex > 0 ? html.slice(0, relatedIndex) : html.slice(0, html.length / 2)

    // Look for "Price:" label in main content
    const priceLabelMatch = mainContent.match(/Price:\s*\$?(\d+(?:\.\d{2})?)/i)
    if (priceLabelMatch) {
      price = parseFloat(priceLabelMatch[1])
    }

    // Fallback: look for itemprop price in main content (content attribute)
    if (!price) {
      const itemPropMatch = mainContent.match(/itemprop="price"[^>]*content="(\d+(?:\.\d{2})?)"/i)
      if (itemPropMatch) {
        price = parseFloat(itemPropMatch[1])
      }
    }

    // Fallback: look for itemprop price as element content (e.g., <span itemprop="price">120</span>)
    if (!price) {
      const itemPropContentMatch = mainContent.match(/itemprop="price"[^>]*>(\d+(?:\.\d{2})?)</i)
      if (itemPropContentMatch) {
        price = parseFloat(itemPropContentMatch[1])
      }
    }

    // Fallback: look for price class in main content
    if (!price) {
      const priceClassMatch = mainContent.match(/class="[^"]*price[^"]*"[^>]*>\s*\$?(\d+(?:\.\d{2})?)/i)
      if (priceClassMatch) {
        price = parseFloat(priceClassMatch[1])
      }
    }

    // Extract description
    const descPatterns = [
      /class="product[_-]?description"[^>]*>([\s\S]*?)<\/(?:div|p)/i,
      /itemprop="description"[^>]*>([\s\S]*?)<\/(?:div|p|span)/i,
      /<meta\s+name="description"\s+content="([^"]+)"/i,
    ]

    let description: string | undefined
    for (const pattern of descPatterns) {
      const match = html.match(pattern)
      if (match) {
        description = match[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 500)
        break
      }
    }

    // Extract images
    const images: string[] = []
    const imgPatterns = [
      /src="([^"]+(?:product|pandora)[^"]*\.(?:jpg|jpeg|png|webp))"/gi,
      /data-src="([^"]+\.(?:jpg|jpeg|png|webp))"/gi,
      /itemprop="image"[^>]*(?:src|content)="([^"]+)"/gi,
    ]

    for (const pattern of imgPatterns) {
      let match
      while ((match = pattern.exec(html)) !== null) {
        let imgUrl = match[1]
        if (!imgUrl.startsWith('http')) {
          imgUrl = new URL(imgUrl, this.baseUrl).href
        }
        if (!images.includes(imgUrl)) {
          images.push(imgUrl)
        }
      }
    }

    // Determine type from style ID prefix
    // Pandora prefixes: 79/78/76/19/18 = charms, 59/58 = bracelets, 29/28/26 = earrings, 56 = rings, 39/38 = necklaces
    let type = 'charm'
    const prefix = styleId.slice(0, 2)
    if (['59', '58'].includes(prefix)) type = 'bracelet'
    else if (['29', '28', '26'].includes(prefix)) type = 'earring'
    else if (prefix === '56') type = 'ring'
    else if (['39', '38'].includes(prefix)) type = 'necklace'
    else if (['79', '78', '76', '19', '18', '75'].includes(prefix)) type = 'charm'

    // Extract collection from product name
    const collection = this.extractCollection(name)

    return {
      styleId,
      name,
      brand: 'Pandora',
      collection,
      originalPrice: price, // DenmarkStyle's current price
      currency: 'USD',
      region: 'US',
      description,
      type,
      imageUrls: images.length > 0 ? images.slice(0, 5) : undefined,
    }
  }
  private extractCollection(name: string): string | undefined {
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
      { pattern: /\bThe Little Mermaid\b/i, name: 'Disney' },
      { pattern: /\bCinderella\b/i, name: 'Disney' },
      { pattern: /\bFrozen\b/i, name: 'Disney' },
      { pattern: /\bMickey\b/i, name: 'Disney' },
      { pattern: /\bMinnie\b/i, name: 'Disney' },
      { pattern: /\bWinnie the Pooh\b/i, name: 'Disney' },
      { pattern: /\bSpider-?Man\b/i, name: 'Marvel' },
      { pattern: /\bAvengers\b/i, name: 'Marvel' },
      { pattern: /\bIron Man\b/i, name: 'Marvel' },
      { pattern: /\bME\b/, name: 'Pandora ME' },
      { pattern: /\bMoments\b/i, name: 'Moments' },
      { pattern: /\bSignature\b/i, name: 'Signature' },
      { pattern: /\bTimeless\b/i, name: 'Timeless' },
      { pattern: /\bReflexions\b/i, name: 'Reflexions' },
    ]

    for (const { pattern, name: collName } of collectionPatterns) {
      if (pattern.test(name)) {
        return collName
      }
    }

    return undefined
  }
}

// Module export
export const denmarkStyleModule: ScraperModule = {
  name: 'denmarkstyle',
  description: 'Scrapes products from DenmarkStyle.net (authorized reseller)',
  defaultConfig: {
    enabled: true,
    cronSchedule: '0 0 * * 2', // Weekly on Tuesday
    rateLimit: 2, // 2 requests per second (be respectful)
  },
  create: () => new DenmarkStyleScraper(),
}
