import { BaseScraper } from '../base'
import type { ScraperModule, ScrapedCharm } from '../types'

/**
 * The Art of Pandora Scraper
 *
 * Scrapes charm information from TheArtOfPandora blog reviews.
 * Extracts:
 * - Product images (RGB product photos, not blog banners)
 * - Style IDs from image filenames or Pandora shop links
 * - Names from image alt text or page title
 * - Prices in multiple currencies
 */
class ArtOfPandoraScraper extends BaseScraper {
  name = 'art-of-pandora'
  description = 'Scrapes charm info from TheArtOfPandora blog reviews'

  private readonly baseUrl = 'https://theartofpandora.com'

  // Valid Pandora style ID prefixes
  private readonly validPrefixes = ['79', '78', '76', '75', '59', '58', '56', '55', '39', '38', '19', '18', '29']

  protected async scrape(): Promise<void> {
    this.log('Starting Art of Pandora scrape...')

    // Scrape review pages - these have actual product data
    const reviewPages = [
      '/category/reviews/',
      '/tag/charm-review/',
      '/tag/review/',
    ]

    const processedUrls = new Set<string>()

    for (const page of reviewPages) {
      try {
        await this.scrapeReviewIndex(`${this.baseUrl}${page}`, processedUrls)
      } catch (e: any) {
        this.logError(`Failed to scrape ${page}: ${e.message}`)
      }
    }

    this.log(`Scrape complete. Found ${this.charmsFound} charms, added ${this.charmsAdded}`)
  }

  private async scrapeReviewIndex(baseUrl: string, processedUrls: Set<string>): Promise<void> {
    this.log(`Scraping review index: ${baseUrl}`)

    // Follow pagination - scrape all pages
    let currentPage = 1
    const maxPages = 50 // Safety limit

    while (currentPage <= maxPages) {
      const url = currentPage === 1 ? baseUrl : `${baseUrl}page/${currentPage}/`

      const response = await this.fetchWithRateLimit(url)
      if (!response.ok) {
        if (currentPage > 1) break // End of pagination
        return
      }

      const html = await response.text()

      // Check if we hit a 404-style page (no articles)
      if (!html.includes('article') && currentPage > 1) break

      // Find review article links
      const linkRegex = /href="(https?:\/\/(?:www\.)?theartofpandora\.com\/[a-z0-9-]+\/)"/gi
      const links: string[] = []
      let match

      while ((match = linkRegex.exec(html)) !== null) {
        const articleUrl = match[1]

        // Only process review-like URLs
        if (processedUrls.has(articleUrl)) continue
        if (articleUrl.includes('/tag/') || articleUrl.includes('/category/')) continue
        if (articleUrl.includes('/page/') || articleUrl.includes('/feed/')) continue
        if (articleUrl.includes('/wp-') || articleUrl.includes('/author/')) continue

        // Prefer URLs that look like product reviews
        if (articleUrl.includes('review') ||
            articleUrl.includes('charm') ||
            articleUrl.includes('pandora-') ||
            articleUrl.includes('disney-') ||
            articleUrl.includes('dangle') ||
            articleUrl.includes('clip') ||
            articleUrl.includes('murano')) {
          links.push(articleUrl)
          processedUrls.add(articleUrl)
        }
      }

      if (currentPage === 1 || links.length > 0) {
        this.log(`Page ${currentPage}: found ${links.length} review links`)
      }

      // Process each review page
      for (const link of links) {
        try {
          await this.scrapeReviewPage(link)
        } catch (e: any) {
          this.logError(`Failed to scrape ${link}: ${e.message}`)
        }
      }

      // Check for next page link
      if (!html.includes(`/page/${currentPage + 1}/`)) break

      currentPage++
    }
  }

  private async scrapeReviewPage(url: string): Promise<void> {
    const response = await this.fetchWithRateLimit(url)
    if (!response.ok) return

    const html = await response.text()

    // Find official product images with style ID in filename
    // Only match images with _RGB pattern (official Pandora product shots)
    // e.g., 794498C01_RGB-1024x1024.jpg or 794498C01_RGB.jpg
    const productImageRegex = /src="([^"]+\/(\d{6}[A-Z0-9]*)_RGB[^"]*\.(?:jpg|jpeg|png|webp))"/gi
    const foundProducts = new Map<string, { imageUrl: string; name?: string }>()

    let imgMatch
    while ((imgMatch = productImageRegex.exec(html)) !== null) {
      const imageUrl = imgMatch[1]
      const styleId = imgMatch[2].toUpperCase()

      // Validate style ID prefix
      const prefix = styleId.slice(0, 2)
      if (!this.validPrefixes.includes(prefix)) continue

      if (!foundProducts.has(styleId)) {
        foundProducts.set(styleId, { imageUrl })
      }
    }

    if (foundProducts.size === 0) return

    // Extract prices from the page (look for currency symbols with amounts)
    const prices: { currency: string; amount: number }[] = []

    // US price: $95 or $95.00
    const usPriceMatch = html.match(/🇺🇸\s*\$(\d+(?:\.\d{2})?)/i) ||
                         html.match(/US[:\s]*\$(\d+(?:\.\d{2})?)/i)
    if (usPriceMatch) prices.push({ currency: 'USD', amount: parseFloat(usPriceMatch[1]) })

    // UK price: £69
    const ukPriceMatch = html.match(/🇬🇧\s*£(\d+(?:\.\d{2})?)/i) ||
                         html.match(/UK[:\s]*£(\d+(?:\.\d{2})?)/i)
    if (ukPriceMatch) prices.push({ currency: 'GBP', amount: parseFloat(ukPriceMatch[1]) })

    // EU price: €79
    const euPriceMatch = html.match(/🇩🇪\s*€(\d+(?:\.\d{2})?)/i) ||
                         html.match(/(?:DE|EU)[:\s]*€(\d+(?:\.\d{2})?)/i)
    if (euPriceMatch) prices.push({ currency: 'EUR', amount: parseFloat(euPriceMatch[1]) })

    // CA price: $138
    const caPriceMatch = html.match(/🇨🇦\s*\$(\d+(?:\.\d{2})?)/i) ||
                         html.match(/CA[:\s]*\$(\d+(?:\.\d{2})?)/i)
    if (caPriceMatch) prices.push({ currency: 'CAD', amount: parseFloat(caPriceMatch[1]) })

    // Get page title for potential product name
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    let pageTitle = (h1Match?.[1] || titleMatch?.[1] || '')
      .replace(/\s*[-|].*Art of Pandora.*$/i, '')
      .replace(/^Review:\s*/i, '')
      .replace(/\s+Review$/i, '')
      .trim()

    // Process each found product
    for (const [styleId, data] of foundProducts) {
      this.charmsFound++

      // Try to find a specific name for this product from image alt text
      const altMatch = html.match(new RegExp(`alt="([^"]*${styleId}[^"]*)"`, 'i')) ||
                       html.match(new RegExp(`alt="([^"]*)"[^>]*${styleId}`, 'i'))
      let name = altMatch?.[1]?.trim()

      // Clean up the name
      if (name) {
        name = name
          .replace(/[-_]\s*\d+x\d+/i, '') // Remove dimensions
          .replace(/_RGB.*$/i, '')
          .replace(new RegExp(styleId, 'gi'), '')
          .replace(/^\s*[-_]\s*/, '')
          .replace(/\s*[-_]\s*$/, '')
          .trim()
      }

      // Fall back to page title if no specific name found
      if (!name || name.length < 3) {
        name = pageTitle
      }

      // Determine primary price (prefer USD)
      const primaryPrice = prices.find(p => p.currency === 'USD') || prices[0]

      const charm: ScrapedCharm = {
        styleId,
        name: name || `Charm ${styleId}`,
        brand: 'Pandora',
        originalPrice: primaryPrice?.amount,
        currency: primaryPrice?.currency || 'USD',
        imageUrls: data.imageUrl ? [data.imageUrl] : undefined,
      }

      await this.saveCharm(charm)

      // Save sighting with source URL
      await this.saveSighting({
        styleId,
        catalogName: 'TheArtOfPandora',
        year: new Date().getFullYear(),
        season: 'Review',
        region: 'US',
        extractedName: name,
        extractedPrice: primaryPrice?.amount,
        extractedCurrency: primaryPrice?.currency || 'USD',
        imageUrl: data.imageUrl || undefined,
        sourceUrl: url,
      })
    }
  }
}

// Module export
export const artOfPandoraModule: ScraperModule = {
  name: 'art-of-pandora',
  description: 'Scrapes charm info from TheArtOfPandora blog reviews',
  defaultConfig: {
    enabled: true,
    cronSchedule: '0 0 * * 3', // Weekly on Wednesday
    rateLimit: 0.3, // 1 request per ~3 seconds
  },
  create: () => new ArtOfPandoraScraper(),
}
