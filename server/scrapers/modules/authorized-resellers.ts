import { BaseScraper } from '../base'
import type { ScraperModule, ScrapedCharm } from '../types'

/**
 * Authorized Resellers Scraper
 *
 * Scrapes product data from Pandora's authorized online retailers.
 * Source: https://help.pandora.net/s/authorized-pandora-online-retailers
 */
class AuthorizedResellersScraper extends BaseScraper {
  name = 'authorized-resellers'
  description = 'Scrapes products from authorized Pandora resellers'

  // Known authorized resellers with their scraping configs
  private readonly resellers: ResellerConfig[] = [
    {
      name: 'Jared',
      baseUrl: 'https://www.jared.com',
      searchUrl: 'https://www.jared.com/search?q=pandora&start=',
      region: 'US',
      enabled: true,
    },
    {
      name: 'Kay Jewelers',
      baseUrl: 'https://www.kay.com',
      searchUrl: 'https://www.kay.com/search?q=pandora&start=',
      region: 'US',
      enabled: true,
    },
    {
      name: 'Zales',
      baseUrl: 'https://www.zales.com',
      searchUrl: 'https://www.zales.com/search?q=pandora&start=',
      region: 'US',
      enabled: true,
    },
    {
      name: 'Peoples Jewellers',
      baseUrl: 'https://www.peoplesjewellers.com',
      searchUrl: 'https://www.peoplesjewellers.com/search?q=pandora&start=',
      region: 'CA',
      enabled: true,
    },
    {
      name: 'Ernest Jones',
      baseUrl: 'https://www.ernestjones.co.uk',
      searchUrl: 'https://www.ernestjones.co.uk/search?q=pandora&start=',
      region: 'UK',
      enabled: true,
    },
    {
      name: 'H.Samuel',
      baseUrl: 'https://www.hsamuel.co.uk',
      searchUrl: 'https://www.hsamuel.co.uk/search?q=pandora&start=',
      region: 'UK',
      enabled: true,
    },
  ]

  protected async scrape(): Promise<void> {
    this.log('Starting authorized resellers scrape...')

    for (const reseller of this.resellers) {
      if (!reseller.enabled) continue

      try {
        await this.scrapeReseller(reseller)
      } catch (e: any) {
        this.logError(`Failed to scrape ${reseller.name}: ${e.message}`)
      }
    }

    this.log(`Scrape complete. Found ${this.charmsFound} products, saved ${this.sightingsAdded} sightings`)
  }

  private async scrapeReseller(reseller: ResellerConfig): Promise<void> {
    this.log(`Scraping ${reseller.name}...`)

    let page = 0
    let hasMore = true
    let totalFound = 0
    const pageSize = 48 // Most sites use 48 items per page

    while (hasMore && page < 50) { // Max 50 pages per reseller
      const url = `${reseller.searchUrl}${page * pageSize}`

      try {
        const response = await this.fetchWithRateLimit(url)

        if (!response.ok) {
          this.log(`${reseller.name} page ${page} returned ${response.status}`)
          hasMore = false
          continue
        }

        const html = await response.text()
        const products = this.extractProducts(html, reseller)

        if (products.length === 0) {
          hasMore = false
          continue
        }

        totalFound += products.length

        for (const product of products) {
          if (product.styleId) {
            this.charmsFound++
            await this.saveCharm(product)
            await this.saveSighting({
              styleId: product.styleId,
              catalogName: reseller.name,
              year: new Date().getFullYear(),
              season: 'Current',
              region: reseller.region,
              extractedName: product.name,
              extractedPrice: product.originalPrice,
              extractedCurrency: product.currency,
              imageUrl: product.imageUrls?.[0],
              sourceUrl: product.sourceUrl || reseller.baseUrl,
            })
          }
        }

        page++

        // Check if we got a full page (might have more)
        if (products.length < pageSize) {
          hasMore = false
        }
      } catch (e: any) {
        this.logError(`Error on ${reseller.name} page ${page}: ${e.message}`)
        hasMore = false
      }
    }

    this.log(`${reseller.name}: Found ${totalFound} products`)
  }

  private extractProducts(html: string, reseller: ResellerConfig): ScrapedCharm[] {
    const products: ScrapedCharm[] = []
    const seenIds = new Set<string>()

    // Try JSON-LD structured data first
    const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)
    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1])
        const items = Array.isArray(data) ? data : [data]

        for (const item of items) {
          if (item['@type'] === 'Product' && item.name?.toLowerCase().includes('pandora')) {
            const styleId = this.extractStyleId(item.sku || item.productID || item.name || '')
            if (styleId && !seenIds.has(styleId)) {
              seenIds.add(styleId)
              products.push({
                styleId,
                name: item.name,
                brand: 'Pandora',
                originalPrice: item.offers?.price ? parseFloat(item.offers.price) : undefined,
                currency: item.offers?.priceCurrency || (reseller.region === 'UK' ? 'GBP' : 'USD'),
                region: reseller.region,
                description: item.description,
                imageUrls: item.image ? (Array.isArray(item.image) ? item.image : [item.image]) : undefined,
                sourceUrl: item.url,
              })
            }
          }
        }
      } catch {
        // JSON parse failed, continue
      }
    }

    // Also try HTML patterns for product grids
    const productPatterns = [
      // Generic product card patterns
      /data-product-id="([^"]+)"[^>]*>[\s\S]*?<(?:h\d|span|a)[^>]*class="[^"]*(?:product-name|title)[^"]*"[^>]*>([^<]+)/gi,
      /class="[^"]*product[^"]*"[^>]*data-sku="([^"]+)"[\s\S]*?<[^>]*>([^<]+pandora[^<]+)/gi,
    ]

    for (const pattern of productPatterns) {
      let match
      while ((match = pattern.exec(html)) !== null) {
        const potentialId = match[1]
        const name = match[2]

        const styleId = this.extractStyleId(potentialId) || this.extractStyleId(name)
        if (styleId && !seenIds.has(styleId)) {
          seenIds.add(styleId)
          products.push({
            styleId,
            name: name.trim(),
            brand: 'Pandora',
            region: reseller.region,
            currency: reseller.region === 'UK' ? 'GBP' : 'USD',
          })
        }
      }
    }

    // Look for Pandora style IDs anywhere in the HTML
    const styleIdPattern = /\b(79\d{4}(?:[A-Z]\d{2})?|59\d{4}(?:[A-Z]{2})?|58\d{4}|56\d{4}|39\d{4})\b/gi
    let idMatch
    while ((idMatch = styleIdPattern.exec(html)) !== null) {
      const styleId = idMatch[1].toUpperCase()
      if (!seenIds.has(styleId)) {
        seenIds.add(styleId)

        // Try to find name near this ID
        const context = html.slice(Math.max(0, idMatch.index - 200), idMatch.index + 200)
        const nameMatch = context.match(/(?:Pandora\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:Charm|Clip|Bead|Ring|Bracelet|Earring)/i)

        products.push({
          styleId,
          name: nameMatch ? nameMatch[0].trim() : `Pandora ${styleId}`,
          brand: 'Pandora',
          region: reseller.region,
          currency: reseller.region === 'UK' ? 'GBP' : 'USD',
        })
      }
    }

    return products
  }

  private extractStyleId(text: string): string | null {
    const patterns = [
      /\b(79\d{4}(?:[A-Z]\d{2})?)\b/i,
      /\b(59\d{4}(?:[A-Z]{2})?)\b/i,
      /\b(58\d{4})\b/i,
      /\b(56\d{4})\b/i,
      /\b(39\d{4})\b/i,
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) return match[1].toUpperCase()
    }
    return null
  }
}

interface ResellerConfig {
  name: string
  baseUrl: string
  searchUrl: string
  region: string
  enabled: boolean
}

// Module export
export const authorizedResellersModule: ScraperModule = {
  name: 'authorized-resellers',
  description: 'Scrapes products from authorized Pandora resellers (Jared, Kay, Zales, etc.)',
  defaultConfig: {
    enabled: false, // Disabled by default - enable manually
    cronSchedule: '0 0 * * 3', // Weekly on Wednesday
    rateLimit: 0.3, // 1 request per 3 seconds
  },
  create: () => new AuthorizedResellersScraper(),
}
