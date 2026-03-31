import { BaseScraper } from '../base'
import type { ScraperModule, ScrapedCharm } from '../types'

/**
 * Site Version Parser Interface
 */
interface SiteVersionParser {
  name: string
  startDate: string
  endDate: string
  urlPatterns: string[]
  // For single product pages (most eras)
  parseProductPage?(html: string, url: string, timestamp: string): ParsedProduct | null
  // For category listing pages that contain multiple products (demandware-v1)
  parseCategoryPage?(html: string, url: string, timestamp: string): ParsedProduct[]
}

interface ParsedProduct {
  styleId: string
  name?: string
  price?: number
  currency?: string
  description?: string
  collection?: string
  materials?: string[]
  imageUrl?: string
}

/**
 * Wayback Machine Scraper
 *
 * Scrapes historical Pandora website snapshots from the Internet Archive.
 */
class WaybackScraper extends BaseScraper {
  name = 'wayback'
  description = 'Scrapes historical Pandora data from Internet Archive'

  private readonly waybackApi = 'https://web.archive.org'
  private readonly cdxApi = 'https://web.archive.org/cdx/search/cdx'

  /**
   * Extract best image URL from HTML using multiple strategies
   */
  private extractImageUrl(html: string, styleId: string, timestamp: string): string | undefined {
    // Strategy 1: JSON "images" object (estore era)
    // Format: "images": {"large": ["url1", "url2"], "small": [...], "zoom": [...]}
    const imagesJsonMatch = html.match(/"images"\s*:\s*\{[^}]*"(?:large|zoom)"\s*:\s*\[([\s\S]*?)\]/i)
    if (imagesJsonMatch) {
      const urlsMatch = imagesJsonMatch[1].match(/"(https?:\/\/[^"]+)"/i)
      if (urlsMatch) {
        return this.processImageUrl(urlsMatch[1], timestamp)
      }
    }

    // Strategy 2: itemprop="image" with src attribute
    const itemPropImgMatch = html.match(/<img[^>]*itemprop="image"[^>]*src="([^"]+)"/i)
    if (itemPropImgMatch) {
      return this.processImageUrl(itemPropImgMatch[1], timestamp)
    }

    // Strategy 3: data-lgimg attribute (contains hires URL)
    const dataLgimgMatch = html.match(/data-lgimg=["'][^"']*["']?(?:hires|url)["']?\s*:\s*["']([^"']+)["']/i)
    if (dataLgimgMatch) {
      return this.processImageUrl(dataLgimgMatch[1], timestamp)
    }

    // Strategy 4: Main product image by class
    const mainImageMatch = html.match(/class="[^"]*(?:main-image|primary-image|product-image|pdp-image)[^"]*"[^>]*(?:src|href)="([^"]+)"/i) ||
                           html.match(/class="[^"]*(?:main-image|primary-image|product-image|pdp-image)[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/i)
    if (mainImageMatch) {
      return this.processImageUrl(mainImageMatch[1], timestamp)
    }

    // Strategy 5: JSON structured data
    const jsonImageMatch = html.match(/"image"\s*:\s*"([^"]+)"/i) ||
                           html.match(/"primaryImageUrl"\s*:\s*"([^"]+)"/i)
    if (jsonImageMatch) {
      return this.processImageUrl(jsonImageMatch[1], timestamp)
    }

    // Strategy 6: Any image URL containing the style ID
    const styleIdPattern = new RegExp(`src="([^"]*${styleId}[^"]*\\.(?:jpg|png|jpeg|webp)[^"]*)"`, 'i')
    const styleIdImgMatch = html.match(styleIdPattern)
    if (styleIdImgMatch) {
      return this.processImageUrl(styleIdImgMatch[1], timestamp)
    }

    // Strategy 7: Product thumbnails
    const thumbnailMatch = html.match(/class="[^"]*productthumbnail[^"]*"[^>]*src="([^"]+)"/i)
    if (thumbnailMatch) {
      // Try to get larger version by modifying size params
      let url = thumbnailMatch[1]
      url = url.replace(/sw=\d+/, 'sw=400').replace(/sh=\d+/, 'sh=400')
      return this.processImageUrl(url, timestamp)
    }

    return undefined
  }

  /**
   * Extract price and currency from HTML based on region
   */
  private extractPrice(html: string, url: string): { price?: number; currency: string } {
    // Detect region/currency from URL
    const urlLower = url.toLowerCase()
    let detectedCurrency = 'USD'

    if (urlLower.includes('/uk-ua') || urlLower.includes('-ua/') || urlLower.includes('/ua/')) {
      detectedCurrency = 'UAH'
    } else if (urlLower.includes('/uk/') || urlLower.includes('/en-gb') || urlLower.includes('-uk.')) {
      detectedCurrency = 'GBP'
    } else if (urlLower.includes('/de/') || urlLower.includes('/de-de') || urlLower.includes('-de.')) {
      detectedCurrency = 'EUR'
    } else if (urlLower.includes('/au/') || urlLower.includes('/en-au') || urlLower.includes('-au.')) {
      detectedCurrency = 'AUD'
    } else if (urlLower.includes('/ca/') || urlLower.includes('/en-ca') || urlLower.includes('-ca.')) {
      detectedCurrency = 'CAD'
    }

    // Currency-specific price patterns
    const currencyPatterns: Record<string, { regex: RegExp; parser: (m: string) => number }> = {
      'USD': {
        regex: /\$\s*([\d,]+(?:\.\d{2})?)/,
        parser: (m) => parseFloat(m.replace(/,/g, ''))
      },
      'GBP': {
        regex: /£\s*([\d,]+(?:\.\d{2})?)/,
        parser: (m) => parseFloat(m.replace(/,/g, ''))
      },
      'EUR': {
        regex: /€\s*([\d\s.,]+)/,
        parser: (m) => parseFloat(m.replace(/\s/g, '').replace(',', '.'))
      },
      'UAH': {
        regex: /([\d\s]+(?:,\d{2})?)\s*(?:UAH|грн)/i,
        parser: (m) => parseFloat(m.replace(/\s/g, '').replace(',', '.'))
      },
      'AUD': {
        regex: /\$\s*([\d,]+(?:\.\d{2})?)/,
        parser: (m) => parseFloat(m.replace(/,/g, ''))
      },
      'CAD': {
        regex: /\$\s*([\d,]+(?:\.\d{2})?)/,
        parser: (m) => parseFloat(m.replace(/,/g, ''))
      },
    }

    // Try to match price for detected currency
    const pattern = currencyPatterns[detectedCurrency]
    if (pattern) {
      const match = html.match(pattern.regex)
      if (match) {
        const price = pattern.parser(match[1])
        // Sanity check: Pandora items typically cost $20-$500 USD equivalent
        // UAH would be ~800-20000, GBP ~15-400, EUR ~20-450
        const maxPrices: Record<string, number> = {
          'USD': 2000, 'GBP': 1500, 'EUR': 2000, 'UAH': 50000, 'AUD': 3000, 'CAD': 3000
        }
        if (price > 0 && price < (maxPrices[detectedCurrency] || 5000)) {
          return { price, currency: detectedCurrency }
        }
      }
    }

    // Fallback: try USD pattern if nothing else matched
    if (detectedCurrency !== 'USD') {
      const usdMatch = html.match(/\$\s*([\d,]+(?:\.\d{2})?)/i)
      if (usdMatch) {
        const price = parseFloat(usdMatch[1].replace(/,/g, ''))
        if (price > 0 && price < 2000) {
          return { price, currency: 'USD' }
        }
      }
    }

    return { currency: detectedCurrency }
  }

  /**
   * Process image URL - convert wayback URLs and verify accessibility
   */
  private processImageUrl(url: string, timestamp: string): string {
    // If already a wayback URL, return as-is but use im_ for images
    if (url.includes('web.archive.org')) {
      // Ensure it uses im_ for image serving
      return url.replace('/web/', '/web/').replace(/\/web\/(\d+)\//, '/web/$1im_/')
    }

    // For non-wayback URLs, we'll store the original URL
    // The frontend can try wayback first, then fall back to original
    // Wrap in wayback archive format
    return `${this.waybackApi}/web/${timestamp}im_/${url}`
  }

  // Site version parsers
  private readonly siteVersions: SiteVersionParser[] = [
    // 2008-2011: Original www.pandora.net site
    // URL format: www.pandora.net/us/Jewelry/All/?item=ProductName=XXXXX or ?item==XXXXX
    {
      name: 'original-v1',
      startDate: '20080101',
      endDate: '20111231',
      urlPatterns: [
        // Product pages are under Jewelry/All/ with ?item= param
        'www.pandora.net/us/Jewelry/All/',
        'www.pandora.net/uk/Jewelry/All/',
        'www.pandora.net/ca/Jewelry/All/',
        'www.pandora.net/au/Jewelry/All/',
        'www.pandora.net/de/Jewelry/All/',
        'www.pandora.net/fr/Jewelry/All/',
        'www.pandora.net/it/Jewelry/All/',
        'www.pandora.net/es/Jewelry/All/',
        'www.pandora.net/nl/Jewelry/All/',
      ],
      parseProductPage: (html: string, url: string, timestamp: string): ParsedProduct | null => {
        // 2008-2011 era: Product data is in HTML attributes
        // - Style ID: designerid="15119GSA-5" attribute on ItemImage
        // - Name: alt="Ring 14K Raised Green Sapphire (15119GSA-5)" attribute
        // - Price: "855.00 USD" in ItemInfo section
        // - Image: src attribute on ItemImage

        // Extract style ID from designerid attribute (the REAL Pandora style ID)
        const designerIdMatch = html.match(/designerid="([^"]+)"/i)
        if (!designerIdMatch) return null

        const styleId = designerIdMatch[1].toUpperCase()

        // Extract name from alt attribute on ItemImage
        // Format: "Ring 14K Raised Green Sapphire (15119GSA-5)"
        const altMatch = html.match(/class="ItemImage"[^>]*alt="([^"]+)"/i) ||
                         html.match(/alt="([^"]+)"[^>]*class="ItemImage"/i)

        let name = ''
        if (altMatch) {
          // Remove the style ID suffix like "(15119GSA-5)" from the name
          name = altMatch[1]
            .replace(/\s*\([^)]+\)\s*$/, '')
            .trim()
        }

        if (!name || name.length < 3) {
          name = `Product ${styleId}`
        }

        // Extract price from ItemInfo section
        // Format: <th>Retail price:</th><td>135.00&nbsp;AUD</td>
        let price: number | undefined
        let currency = 'USD'

        // Price is in a table with HTML tags between label and value
        const priceMatch = html.match(/Retail price:[\s\S]*?<td>\s*([\d,.]+)\s*(?:&nbsp;|\s)*([A-Z]{3})/i) ||
                           html.match(/Retail price:\s*([\d,.]+)\s*(?:&nbsp;)?([A-Z]{3})/i) ||
                           html.match(/([\d,.]+)\s*(?:&nbsp;)?USD/i)
        if (priceMatch) {
          price = parseFloat(priceMatch[1].replace(/,/g, ''))
          currency = priceMatch[2] || 'USD'
        }

        // Extract image URL
        const imageMatch = html.match(/class="ItemImage"[^>]*src="([^"]+)"/i) ||
                           html.match(/src="([^"]+)"[^>]*class="ItemImage"/i)
        let imageUrl: string | undefined
        if (imageMatch) {
          // Convert wayback URL to proper format
          let imgSrc = imageMatch[1]
          if (imgSrc.startsWith('/web/')) {
            imgSrc = `https://web.archive.org${imgSrc}`
          }
          imageUrl = imgSrc
        }

        return {
          styleId,
          name,
          price,
          currency,
          imageUrl,
        }
      },
    },

    // 2012-2016: www.pandora.net with /explore/products/ URLs
    // URL format: www.pandora.net/{locale}/explore/products/{category}/{styleId}
    // German (de-de) has meta tags; US/UK parse from title
    {
      name: 'www-v1',
      startDate: '20120101',
      endDate: '20161231',
      urlPatterns: [
        // German site has full meta tags with price - prioritize
        'www.pandora.net/de-de/explore/products/charms/',
        'www.pandora.net/de-de/explore/products/rings/',
        'www.pandora.net/de-de/explore/products/bracelets/',
        'www.pandora.net/de-de/explore/products/earrings/',
        'www.pandora.net/de-de/explore/products/necklaces/',
        // US/UK have name/image but no price
        'www.pandora.net/en-us/explore/products/charms/',
        'www.pandora.net/en-us/explore/products/rings/',
        'www.pandora.net/en-gb/explore/products/charms/',
        'www.pandora.net/en-gb/explore/products/rings/',
      ],
      parseProductPage: (html: string, url: string, timestamp: string): ParsedProduct | null => {
        // Strategy 1: German-style meta tags (de-de, some other locales)
        const idMatch = html.match(/<meta\s+name="id"\s+content="([^"]+)"/i)
        if (idMatch) {
          const styleId = idMatch[1].toUpperCase()
          const nameMatch = html.match(/<meta\s+name="name"\s+content="([^"]+)"/i)
          const priceMatch = html.match(/<meta\s+name="price"\s+content="([\d.,]+)\s*([A-Z]{3})"/i)
          const collectionMatch = html.match(/<meta\s+name="collection"\s+content="([^"]+)"/i)
          const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)

          let price: number | undefined
          let currency = 'EUR'
          if (priceMatch) {
            price = parseFloat(priceMatch[1].replace(',', '.'))
            currency = priceMatch[2]
          }

          let imageUrl = imageMatch?.[1]
          if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = `https://web.archive.org${imageUrl}`
          }

          return {
            styleId,
            name: nameMatch?.[1] || `Product ${styleId}`,
            price,
            currency,
            collection: collectionMatch?.[1],
            imageUrl,
          }
        }

        // Strategy 2: US/UK style - parse from title and og tags
        // Title format: "Product Name - STYLEID - Category | PANDORA"
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
        if (!titleMatch) return null

        const titleParts = titleMatch[1].split(' - ')
        if (titleParts.length < 2) return null

        // Extract style ID from title (5-8 digit alphanumeric)
        const styleIdPart = titleParts.find(p => /^[0-9A-Z]{5,8}$/i.test(p.trim()))
        if (!styleIdPart) return null

        const styleId = styleIdPart.trim().toUpperCase()
        const name = titleParts[0].trim()

        const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
        let imageUrl = imageMatch?.[1]
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `https://web.archive.org${imageUrl}`
        }

        return {
          styleId,
          name,
          imageUrl,
          // Note: US/UK sites don't have price in HTML - loaded via JavaScript
        }
      },
    },

    // 2018-2020: Demandware category pages (no individual product pages archived)
    // This era parses category listing pages which contain product tiles with ID, name, price, and images
    {
      name: 'demandware-v1',
      startDate: '20180301',
      endDate: '20201231',
      urlPatterns: [
        // Category listing pages that contain product tiles
        'us.pandora.net/en/charms/',
        'us.pandora.net/en/bracelets/',
        'us.pandora.net/en/rings/',
        'us.pandora.net/en/earrings/',
        'us.pandora.net/en/necklaces/',
        'us.pandora.net/en/new/',
        'uk.pandora.net/en/charms/',
        'uk.pandora.net/en/bracelets/',
        'uk.pandora.net/en/rings/',
      ],
      parseCategoryPage: (html: string, url: string, timestamp: string): ParsedProduct[] => {
        const products: ParsedProduct[] = []

        // Match product tiles: <div class="product-tile" ... data-itemid="797805" ...>
        // Each tile contains: styleId in data-itemid, name in title attr, price in price-sales span
        const tileRegex = /<div[^>]*class="product-tile"[^>]*data-itemid="([^"]+)"[^>]*>([\s\S]*?)(?=<div[^>]*class="product-tile"|<\/ul>|$)/gi

        let match
        while ((match = tileRegex.exec(html)) !== null) {
          const styleId = match[1].toUpperCase()
          const tileHtml = match[2]

          // Skip gift cards, bundles, and other non-product items
          if (styleId.startsWith('ENG') || styleId.startsWith('B8') || styleId.startsWith('EGC')) {
            continue
          }

          // Extract name from title attribute on link
          const nameMatch = tileHtml.match(/title="([^"]+)"/i)
          const name = nameMatch?.[1]?.replace(/\s*-\s*PANDORA.*$/i, '').trim()

          // Extract price from price-sales span
          const priceMatch = tileHtml.match(/class="price-sales[^"]*"[^>]*>\s*\$?([\d,.]+)/i)
          const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : undefined

          // Extract image URL
          const imgMatch = tileHtml.match(/src="([^"]*\/productimages\/main\/[^"]+\.jpg)"/i) ||
                           tileHtml.match(/src="([^"]*demandware[^"]+\.jpg)"/i)
          let imageUrl: string | undefined
          if (imgMatch) {
            // Convert to proper wayback URL if needed
            let imgSrc = imgMatch[1]
            if (!imgSrc.includes('web.archive.org')) {
              imgSrc = `https://web.archive.org/web/${timestamp}im_/${imgSrc}`
            }
            imageUrl = imgSrc
          }

          if (styleId && name) {
            products.push({
              styleId,
              name,
              price,
              currency: url.includes('uk.pandora') ? 'GBP' : 'USD',
              imageUrl,
            })
          }
        }

        return products
      },
    },

    // 2021-2022: Demandware with Tealium tracking
    {
      name: 'demandware-v2',
      startDate: '20210101',
      endDate: '20221231',
      urlPatterns: [
        'us.pandora.net/en/',
        'uk.pandora.net/en/',
        'de.pandora.net/de/',
        'fr.pandora.net/fr/',
        'au.pandora.net/en/',
        'ca.pandora.net/en/',
      ],
      parseProductPage: (html: string, url: string, timestamp: string): ParsedProduct | null => {
        // Style ID from URL or Tealium tracking data
        const urlStyleId = url.match(/\/(\d{6}[A-Z0-9]*)\.html/i)
        const tealiumStyleId = html.match(/"product_sku"\s*:\s*\["([A-Z0-9]+)"\]/i) ||
                               html.match(/"product_id"\s*:\s*\["([A-Z0-9]+)"\]/i)
        const styleIdMatch = tealiumStyleId || urlStyleId
        if (!styleIdMatch) return null

        const styleId = styleIdMatch[1].toUpperCase()

        // Name from title tag (cleanest source)
        const titleMatch = html.match(/<title>([^<|]+)/i)
        let name = titleMatch?.[1]?.trim()
        // Remove "| Pandora US" suffix
        if (name) {
          name = name.replace(/\s*\|.*$/, '').trim()
        }

        // Price from Tealium or price-sales class
        const tealiumPrice = html.match(/"product_unit_price"\s*:\s*\["([\d.]+)"\]/i)
        const classPrice = html.match(/class="price-sales[^"]*"[^>]*>\s*\$?([\d,.]+)/i)
        const priceMatch = tealiumPrice || classPrice
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : undefined

        // Collection from Tealium
        const collectionMatch = html.match(/"product_collection"\s*:\s*\["([^"]+)"\]/i)

        // Image URL from product images path
        const imageMatch = html.match(/productimages\/main\/([A-Z0-9]+_RGB\.JPG)/i)
        let imageUrl: string | undefined
        if (imageMatch) {
          imageUrl = `https://web.archive.org/web/${timestamp}im_/https://us.pandora.net/dw/image/v2/AAVX_PRD/on/demandware.static/-/Sites-pandora-master-catalog/default/productimages/main/${imageMatch[1]}?sw=600&sh=600`
        }

        return {
          styleId,
          name,
          price,
          currency: 'USD',
          collection: collectionMatch?.[1],
          imageUrl,
        }
      },
    },

    // 2023-Present: PWA/React design
    {
      name: 'pwa-v1',
      startDate: '20230101',
      endDate: '20991231',
      urlPatterns: [
        'us.pandora.net/en/',
        'uk.pandora.net/en/',
      ],
      parseProductPage: (html: string, url: string, timestamp: string): ParsedProduct | null => {
        // Try JSON-LD first
        const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i)
        if (jsonLdMatch) {
          try {
            const data = JSON.parse(jsonLdMatch[1])
            if (data['@type'] === 'Product' && data.sku) {
              return {
                styleId: data.sku.toUpperCase(),
                name: data.name,
                price: data.offers?.price ? parseFloat(data.offers.price) : undefined,
                currency: data.offers?.priceCurrency || 'USD',
                description: data.description?.slice(0, 500),
                imageUrl: Array.isArray(data.image) ? data.image[0] : data.image,
              }
            }
          } catch {}
        }

        const styleIdMatch = html.match(/\/(\d{6}[A-Z0-9]*)\.html/i) ||
                             html.match(/"sku"\s*:\s*"(\d{6}[A-Z0-9]*)"/i)
        if (!styleIdMatch) return null

        return {
          styleId: styleIdMatch[1].toUpperCase(),
        }
      },
    },
  ]

  protected async scrape(): Promise<void> {
    this.log('Starting Wayback Machine scrape...')

    for (const version of this.siteVersions) {
      try {
        await this.scrapeVersion(version)
      } catch (e: any) {
        this.logError(`Failed to scrape ${version.name}: ${e.message}`)
      }
    }

    this.log(`Scrape complete. Found ${this.charmsFound} charms, ${this.sightingsAdded} sightings`)
  }

  private async scrapeVersion(version: SiteVersionParser): Promise<void> {
    this.log(`Scraping ${version.name} (${version.startDate}-${version.endDate})...`)

    // Category page parsers extract multiple products from listing pages
    if (version.parseCategoryPage) {
      await this.scrapeCategoryVersion(version)
      return
    }

    // Product page parsers extract one product per page
    // Query CDX API for product URLs - collect multiple snapshots per product
    // Map: styleId -> array of {timestamp, url} sorted by timestamp (earliest first for www-v1)
    const productSnapshots: Map<string, Array<{ timestamp: string; url: string }>> = new Map()

    for (const pattern of version.urlPatterns) {
      try {
        // Query for HTML pages - use collapse=timestamp:6 to get ~1 snapshot per month
        // This ensures we check multiple time periods to find snapshots with complete data
        const cdxUrl = `${this.cdxApi}?url=${encodeURIComponent(pattern)}` +
          `&matchType=prefix&output=json&from=${version.startDate}&to=${version.endDate}` +
          `&filter=statuscode:200&filter=mimetype:text/html&collapse=timestamp:6`

        this.log(`CDX query: ${cdxUrl.substring(0, 100)}...`)

        const response = await this.fetchWithRateLimit(cdxUrl)
        if (!response.ok) {
          this.logError(`CDX query failed: ${response.status}`)
          continue
        }

        const data = await response.json()
        if (!Array.isArray(data) || data.length < 2) continue

        // Skip header row
        for (let i = 1; i < data.length; i++) {
          const [urlkey, timestamp, original] = data[i]

          // Extract style ID from URL (6 digits + optional suffix)
          // Try multiple URL patterns:
          // - Modern: /XXXXXX.html
          // - 2008-2011: ?item=Name=XXXXX or ?item==XXXXX
          // - 2012-2016: /explore/products/{category}/{styleId} where styleId is alphanumeric
          const htmlMatch = original.match(/\/(\d{6}[A-Z0-9]*)\.html/i)
          const itemMatch = original.match(/[?&]item=[^=]*=(\d{5,})/i) ||
                           original.match(/[?&]item==(\d{5,})/i)
          // 2012-2016 explore format: last path segment is the product ID (alphanumeric, 5+ chars)
          const exploreMatch = original.match(/\/explore\/products\/[^/]+\/([a-z0-9]{5,})(?:[?#]|$)/i)

          const match = htmlMatch || itemMatch || exploreMatch
          if (!match) continue

          const styleId = match[1].toUpperCase()

          // Collect all snapshots for each styleId
          if (!productSnapshots.has(styleId)) {
            productSnapshots.set(styleId, [])
          }
          productSnapshots.get(styleId)!.push({ timestamp, url: original })
        }
      } catch (e: any) {
        this.logError(`CDX query error: ${e.message}`)
      }
    }

    // Sort snapshots: for www-v1, earlier snapshots (pre-June 2015) have better data
    // For other versions, just use chronological order
    for (const [styleId, snapshots] of productSnapshots) {
      if (version.name === 'www-v1') {
        // Sort earliest first - pre-June 2015 US/UK snapshots have prices
        snapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      } else {
        // For other versions, newest first (most likely to have complete data)
        snapshots.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      }
    }

    this.log(`Found ${productSnapshots.size} unique products with ${Array.from(productSnapshots.values()).reduce((sum, arr) => sum + arr.length, 0)} total snapshots`)

    let savedCount = 0
    for (const [styleId, snapshots] of productSnapshots) {
      try {
        // Try multiple snapshots until we find one with complete data (has price)
        let bestProduct: ParsedProduct | null = null
        let bestTimestamp = ''
        let bestUrl = ''

        // Try up to 5 snapshots per product to find one with price
        const maxAttempts = Math.min(5, snapshots.length)
        for (let i = 0; i < maxAttempts; i++) {
          const { timestamp, url } = snapshots[i]
          const product = await this.scrapeArchivedPage(timestamp, url, version)

          if (product) {
            // If we found a product with price, use it immediately
            if (product.price !== undefined) {
              bestProduct = product
              bestTimestamp = timestamp
              bestUrl = url
              break
            }
            // Otherwise keep the first successful parse as fallback
            if (!bestProduct) {
              bestProduct = product
              bestTimestamp = timestamp
              bestUrl = url
            }
          }
        }

        if (bestProduct) {
          this.charmsFound++
          savedCount++

          const year = parseInt(bestTimestamp.slice(0, 4))
          const month = parseInt(bestTimestamp.slice(4, 6))
          const region = this.getRegionFromUrl(bestUrl)

          // Save to charm database
          await this.saveCharm({
            styleId: bestProduct.styleId,
            name: bestProduct.name,
            brand: 'Pandora',
            originalPrice: bestProduct.price,
            currency: bestProduct.currency || 'USD',
            region,
            description: bestProduct.description,
            collection: bestProduct.collection,
            materials: bestProduct.materials,
            imageUrls: bestProduct.imageUrl ? [bestProduct.imageUrl] : undefined,
          })

          await this.saveSighting({
            styleId: bestProduct.styleId,
            catalogName: `Pandora.net Archive (${version.name})`,
            year,
            season: `${this.getSeason(month)} ${year}`,
            region,
            extractedName: bestProduct.name,
            extractedPrice: bestProduct.price,
            extractedCurrency: bestProduct.currency || 'USD',
            extractedDescription: bestProduct.description,
            imageUrl: bestProduct.imageUrl,
            sourceUrl: `${this.waybackApi}/web/${bestTimestamp}/${bestUrl}`,
          })
        }
      } catch (e: any) {
        // Silently skip failed pages
      }
    }

    this.log(`Scraped ${savedCount} products from ${version.name}`)
  }

  /**
   * Scrape category listing pages that contain multiple products per page
   */
  private async scrapeCategoryVersion(version: SiteVersionParser): Promise<void> {
    if (!version.parseCategoryPage) return

    // Collect unique category page snapshots
    const categoryPages: Array<{ timestamp: string; url: string }> = []
    const seenUrls = new Set<string>()

    for (const pattern of version.urlPatterns) {
      try {
        // Query for category pages - get snapshots across the date range
        const cdxUrl = `${this.cdxApi}?url=${encodeURIComponent(pattern)}` +
          `&matchType=prefix&output=json&from=${version.startDate}&to=${version.endDate}` +
          `&filter=statuscode:200&filter=mimetype:text/html&collapse=timestamp:6&limit=100`

        this.log(`CDX query (category): ${pattern}`)

        const response = await this.fetchWithRateLimit(cdxUrl)
        if (!response.ok) {
          this.logError(`CDX query failed: ${response.status}`)
          continue
        }

        const data = await response.json()
        if (!Array.isArray(data) || data.length < 2) continue

        // Skip header row, collect category pages
        for (let i = 1; i < data.length; i++) {
          const [urlkey, timestamp, original] = data[i]

          // Only keep base category URLs (not sub-filters or pagination)
          if (original.includes('?') && !original.includes('?cgid=')) continue
          if (original.includes('&')) continue

          // Dedupe by URL (ignore timestamp for deduping)
          const urlKey = original.replace(/\?.*$/, '')
          if (seenUrls.has(urlKey)) continue
          seenUrls.add(urlKey)

          categoryPages.push({ timestamp, url: original })
        }
      } catch (e: any) {
        this.logError(`CDX query error: ${e.message}`)
      }
    }

    this.log(`Found ${categoryPages.length} category pages to scrape`)

    // Track products we've already saved to avoid duplicates across pages
    const savedStyleIds = new Set<string>()
    let savedCount = 0

    for (const { timestamp, url } of categoryPages) {
      try {
        const archiveUrl = `${this.waybackApi}/web/${timestamp}/${url}`
        const response = await this.fetchWithRateLimit(archiveUrl)
        if (!response.ok) continue

        const html = await response.text()
        const products = version.parseCategoryPage(html, url, timestamp)

        for (const product of products) {
          // Skip if we've already saved this product
          if (savedStyleIds.has(product.styleId)) continue
          savedStyleIds.add(product.styleId)

          this.charmsFound++
          savedCount++

          const year = parseInt(timestamp.slice(0, 4))
          const month = parseInt(timestamp.slice(4, 6))
          const region = this.getRegionFromUrl(url)

          await this.saveCharm({
            styleId: product.styleId,
            name: product.name,
            brand: 'Pandora',
            originalPrice: product.price,
            currency: product.currency || 'USD',
            region,
            description: product.description,
            collection: product.collection,
            materials: product.materials,
            imageUrls: product.imageUrl ? [product.imageUrl] : undefined,
          })

          await this.saveSighting({
            styleId: product.styleId,
            catalogName: `Pandora.net Archive (${version.name})`,
            year,
            season: `${this.getSeason(month)} ${year}`,
            region,
            extractedName: product.name,
            extractedPrice: product.price,
            extractedCurrency: product.currency || 'USD',
            extractedDescription: product.description,
            imageUrl: product.imageUrl,
            sourceUrl: archiveUrl,
          })
        }

        this.log(`Parsed ${products.length} products from ${url.substring(0, 60)}...`)
      } catch (e: any) {
        this.logError(`Failed to scrape category page: ${e.message}`)
      }
    }

    this.log(`Scraped ${savedCount} unique products from ${version.name}`)
  }

  private async scrapeArchivedPage(
    timestamp: string,
    url: string,
    version: SiteVersionParser
  ): Promise<ParsedProduct | null> {
    const archiveUrl = `${this.waybackApi}/web/${timestamp}/${url}`

    const response = await this.fetchWithRateLimit(archiveUrl)
    if (!response.ok) return null

    const html = await response.text()

    // Parse product data
    if (!version.parseProductPage) return null
    const product = version.parseProductPage(html, url, timestamp)
    if (!product) return null

    // Extract image if parser didn't find one
    if (!product.imageUrl) {
      product.imageUrl = this.extractImageUrl(html, product.styleId, timestamp)
    }

    // Extract price with proper currency detection if not already set
    if (!product.price) {
      const priceData = this.extractPrice(html, url)
      product.price = priceData.price
      product.currency = priceData.currency
    }

    return product
  }

  private getRegionFromUrl(url: string): string {
    const urlLower = url.toLowerCase()
    // US
    if (urlLower.includes('-us.') || urlLower.includes('/en-us') || urlLower.includes('/us/') || urlLower.includes('/us-')) return 'US'
    // UK (but not Ukraine uk-ua)
    if ((urlLower.includes('-uk.') || urlLower.includes('/en-gb') || urlLower.includes('/uk/')) && !urlLower.includes('uk-ua')) return 'UK'
    // Ukraine
    if (urlLower.includes('/uk-ua') || urlLower.includes('-ua/') || urlLower.includes('/ua/')) return 'UA'
    // Australia
    if (urlLower.includes('-au.') || urlLower.includes('/en-au') || urlLower.includes('/au/')) return 'AU'
    // Canada
    if (urlLower.includes('-ca.') || urlLower.includes('/en-ca') || urlLower.includes('/fr-ca') || urlLower.includes('/ca/')) return 'CA'
    // Germany
    if (urlLower.includes('-de.') || urlLower.includes('/de-de') || urlLower.includes('/de/') || urlLower.includes('/de-at') || urlLower.includes('/de-ch')) return 'DE'
    // France
    if (urlLower.includes('-fr.') || urlLower.includes('/fr-fr') || urlLower.includes('/fr/') || urlLower.includes('/fr-be') || urlLower.includes('/fr-ch')) return 'FR'
    // Italy
    if (urlLower.includes('-it.') || urlLower.includes('/it-it') || urlLower.includes('/it/')) return 'IT'
    // Spain
    if (urlLower.includes('-es.') || urlLower.includes('/es-es') || urlLower.includes('/es/')) return 'ES'
    // Netherlands
    if (urlLower.includes('-nl.') || urlLower.includes('/nl-nl') || urlLower.includes('/nl/') || urlLower.includes('/nl-be')) return 'NL'
    // Poland
    if (urlLower.includes('-pl.') || urlLower.includes('/pl-pl') || urlLower.includes('/pl/')) return 'PL'
    // New Zealand
    if (urlLower.includes('-nz.') || urlLower.includes('/en-nz') || urlLower.includes('/nz/')) return 'NZ'
    // Hong Kong
    if (urlLower.includes('-hk.') || urlLower.includes('/en-hk') || urlLower.includes('/hk/')) return 'HK'
    // Singapore
    if (urlLower.includes('-sg.') || urlLower.includes('/en-sg') || urlLower.includes('/sg/')) return 'SG'
    return 'US'
  }

  private getSeason(month: number): string {
    if (month >= 3 && month <= 5) return 'Spring'
    if (month >= 6 && month <= 8) return 'Summer'
    if (month >= 9 && month <= 11) return 'Autumn'
    return 'Winter'
  }
}

export const waybackModule: ScraperModule = {
  name: 'wayback',
  description: 'Scrapes historical Pandora data from Internet Archive',
  defaultConfig: {
    enabled: true,
    cronSchedule: '0 0 1 * *', // Monthly
    rateLimit: 0.5,
  },
  create: () => new WaybackScraper(),
}
