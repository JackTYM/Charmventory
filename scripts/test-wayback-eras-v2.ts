import 'dotenv/config'

/**
 * Test wayback eras with 30-second timeout each
 *
 * Usage: npx tsx scripts/test-wayback-eras-v2.ts [era-name]
 *
 * Available eras: original-v1, www-v1, demandware-v1, demandware-v2, pwa-v1
 */

const cdxApi = 'https://web.archive.org/cdx/search/cdx'
const waybackApi = 'https://web.archive.org'
const ERA_TIMEOUT_MS = 30_000

interface ParsedProduct {
  styleId: string
  name?: string
  price?: number
  currency?: string
  collection?: string
  imageUrl?: string
}

interface EraConfig {
  name: string
  urlPatterns: string[]
  sampleMonth: { from: string; to: string }
  extractStyleId: (url: string) => string | null
  parseProductPage: (html: string, url: string, timestamp: string) => ParsedProduct | null
  // For category listing pages that contain multiple products
  parseCategoryPage?: (html: string, url: string, timestamp: string) => ParsedProduct[]
}

const eras: EraConfig[] = [
  {
    name: 'original-v1',
    urlPatterns: ['www.pandora.net/us/Jewelry/All/', 'www.pandora.net/uk/Jewelry/All/'],
    sampleMonth: { from: '20100601', to: '20100630' },
    extractStyleId: (url) => {
      const match = url.match(/[?&]item=[^=]*=(\d{5,})/i) ||
                    url.match(/[?&]item==(\d{5,})/i)
      return match ? match[1].toUpperCase() : null
    },
    parseProductPage: (html, url, timestamp) => {
      // Extract style ID from designerid attribute
      const designerIdMatch = html.match(/designerid="([^"]+)"/i)
      if (!designerIdMatch) return null

      const styleId = designerIdMatch[1].toUpperCase()

      // Extract name from alt attribute
      const altMatch = html.match(/class="ItemImage"[^>]*alt="([^"]+)"/i) ||
                       html.match(/alt="([^"]+)"[^>]*class="ItemImage"/i)
      let name = altMatch?.[1]?.replace(/\s*\([^)]+\)\s*$/, '').trim()

      // Extract price
      let price: number | undefined
      let currency = 'USD'
      const priceMatch = html.match(/Retail price:[\s\S]*?<td>\s*([\d,.]+)\s*(?:&nbsp;|\s)*([A-Z]{3})/i)
      if (priceMatch) {
        price = parseFloat(priceMatch[1].replace(/,/g, ''))
        currency = priceMatch[2] || 'USD'
      }

      // Extract image
      const imageMatch = html.match(/class="ItemImage"[^>]*src="([^"]+)"/i)
      let imageUrl: string | undefined
      if (imageMatch) {
        let imgSrc = imageMatch[1]
        if (imgSrc.startsWith('/web/')) {
          imgSrc = `https://web.archive.org${imgSrc}`
        }
        imageUrl = imgSrc
      }

      return { styleId, name, price, currency, imageUrl }
    }
  },
  {
    name: 'www-v1',
    // German locale has meta tags; others need fallback parsing
    urlPatterns: ['www.pandora.net/de-de/explore/products/', 'www.pandora.net/en-us/explore/products/'],
    sampleMonth: { from: '20150601', to: '20150630' },
    extractStyleId: (url) => {
      // Last path segment after /products/category/ - 5-8 alphanumeric chars
      const match = url.match(/\/explore\/products\/[^/]+\/([a-z0-9]{5,8})(?:[?#]|$)/i)
      return match ? match[1].toUpperCase() : null
    },
    parseProductPage: (html, url, timestamp) => {
      // Strategy 1: German-style meta tags (de-de locale)
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

        return {
          styleId,
          name: nameMatch?.[1],
          price,
          currency,
          collection: collectionMatch?.[1],
          imageUrl: imageMatch?.[1]
        }
      }

      // Strategy 2: US/UK style - parse from title and og tags
      // Title format: "Product Name - STYLEID - Category | PANDORA"
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
      if (!titleMatch) return null

      const titleParts = titleMatch[1].split(' - ')
      if (titleParts.length < 2) return null

      // Extract style ID from title (usually second part)
      const styleIdFromTitle = titleParts.find(p => /^[0-9A-Z]{5,8}$/.test(p.trim()))
      if (!styleIdFromTitle) return null

      const styleId = styleIdFromTitle.trim().toUpperCase()

      // Name is first part
      const name = titleParts[0].trim()

      // Image from og:image
      const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)

      return {
        styleId,
        name,
        imageUrl: imageMatch?.[1]
        // Note: US/UK sites don't have price in HTML - loaded via JavaScript
      }
    }
  },
  // 2018-2020: Demandware category pages (parses listing pages with multiple products)
  {
    name: 'demandware-v1',
    urlPatterns: ['us.pandora.net/en/charms/'],
    sampleMonth: { from: '20190201', to: '20190228' },
    extractStyleId: () => null, // Not used for category pages
    parseProductPage: () => null, // Uses parseCategoryPage instead
    parseCategoryPage: (html: string, url: string, timestamp: string) => {
      const products: ParsedProduct[] = []
      const tileRegex = /<div[^>]*class="product-tile"[^>]*data-itemid="([^"]+)"[^>]*>([\s\S]*?)(?=<div[^>]*class="product-tile"|<\/ul>|$)/gi

      let match
      while ((match = tileRegex.exec(html)) !== null) {
        const styleId = match[1].toUpperCase()
        const tileHtml = match[2]

        if (styleId.startsWith('ENG') || styleId.startsWith('B8') || styleId.startsWith('EGC')) continue

        const nameMatch = tileHtml.match(/title="([^"]+)"/i)
        const name = nameMatch?.[1]?.replace(/\s*-\s*PANDORA.*$/i, '').trim()

        const priceMatch = tileHtml.match(/class="price-sales[^"]*"[^>]*>\s*\$?([\d,.]+)/i)
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : undefined

        if (styleId && name) {
          products.push({ styleId, name, price, currency: 'USD' })
        }
      }
      return products
    }
  },
  {
    name: 'demandware-v2',
    urlPatterns: ['us.pandora.net/en/'],
    sampleMonth: { from: '20210601', to: '20210630' },
    extractStyleId: (url) => {
      const match = url.match(/\/(\d{6}[A-Z0-9]*)\.html/i)
      return match ? match[1].toUpperCase() : null
    },
    parseProductPage: (html, url, timestamp) => {
      // Style ID from URL or Tealium data
      const urlStyleId = url.match(/\/(\d{6}[A-Z0-9]*)\.html/i)
      const tealiumStyleId = html.match(/"product_sku"\s*:\s*\["([A-Z0-9]+)"\]/i) ||
                             html.match(/"product_id"\s*:\s*\["([A-Z0-9]+)"\]/i)
      const styleIdMatch = tealiumStyleId || urlStyleId
      if (!styleIdMatch) return null

      const styleId = styleIdMatch[1].toUpperCase()

      // Name from title tag (cleanest source)
      const titleMatch = html.match(/<title>([^<|]+)/i)
      let name = titleMatch?.[1]?.trim()
      // Remove "| Pandora US" suffix if present
      if (name) {
        name = name.replace(/\s*\|\s*.*$/, '').trim()
      }

      // Price from Tealium or price-sales class
      const tealiumPrice = html.match(/"product_unit_price"\s*:\s*\["([\d.]+)"\]/i)
      const classPrice = html.match(/class="price-sales[^"]*"[^>]*>\s*\$?([\d,.]+)/i)
      const priceMatch = tealiumPrice || classPrice
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : undefined

      // Collection from Tealium
      const collectionMatch = html.match(/"product_collection"\s*:\s*\["([^"]+)"\]/i)

      // Image URL
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
        imageUrl
      }
    }
  },
  {
    name: 'pwa-v1',
    urlPatterns: ['us.pandora.net/en/'],
    sampleMonth: { from: '20240101', to: '20240131' },
    extractStyleId: (url) => {
      const match = url.match(/\/(\d{6}[A-Z0-9]*)\.html/i)
      return match ? match[1].toUpperCase() : null
    },
    parseProductPage: (html, url, timestamp) => {
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
              imageUrl: Array.isArray(data.image) ? data.image[0] : data.image
            }
          }
        } catch {}
      }

      const styleIdMatch = html.match(/\/(\d{6}[A-Z0-9]*)\.html/i)
      if (!styleIdMatch) return null

      return { styleId: styleIdMatch[1].toUpperCase() }
    }
  }
]

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function testCategoryEra(era: EraConfig, startTime: number) {
  if (!era.parseCategoryPage) return

  const parsedProducts: ParsedProduct[] = []
  let pagesFetched = 0

  // Phase 1: Query CDX API for category pages
  const categoryPages: Array<{ url: string; timestamp: string }> = []

  for (const pattern of era.urlPatterns) {
    if (Date.now() - startTime > ERA_TIMEOUT_MS) break

    const cdxUrl = `${cdxApi}?url=${encodeURIComponent(pattern)}` +
      `&matchType=prefix&output=json&from=${era.sampleMonth.from}&to=${era.sampleMonth.to}` +
      `&filter=statuscode:200&filter=mimetype:text/html&collapse=timestamp:6&limit=10`

    console.log(`\nQuerying CDX: ${pattern}`)

    try {
      await delay(500)
      const response = await fetch(cdxUrl)
      if (!response.ok) {
        console.log(`  CDX error: ${response.status}`)
        continue
      }

      const data = await response.json() as string[][]
      if (!Array.isArray(data) || data.length < 2) {
        console.log('  No results')
        continue
      }

      console.log(`  Found ${data.length - 1} snapshots`)

      // Take just the first few for testing
      for (let i = 1; i < Math.min(data.length, 4); i++) {
        const [urlkey, timestamp, original] = data[i]
        // Skip filtered/paginated URLs
        if (original.includes('?') && !original.includes('?cgid=')) continue
        if (original.includes('&')) continue
        categoryPages.push({ url: original, timestamp })
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message}`)
    }
  }

  console.log(`\nCategory pages to fetch: ${categoryPages.length}`)

  // Phase 2: Fetch and parse category pages
  console.log(`\n--- Fetching and Parsing Category Pages ---\n`)

  for (const page of categoryPages) {
    if (Date.now() - startTime > ERA_TIMEOUT_MS) {
      console.log(`\n[TIMEOUT] 30 seconds reached`)
      break
    }

    const archiveUrl = `${waybackApi}/web/${page.timestamp}/${page.url}`
    console.log(`\nFetching: ${page.url.substring(0, 50)}...`)

    try {
      await delay(500)
      const response = await fetch(archiveUrl, {
        headers: { 'User-Agent': 'Charmventory Test Bot' },
        signal: AbortSignal.timeout(15000)
      })

      if (!response.ok) {
        console.log(`  HTTP ${response.status}`)
        continue
      }

      pagesFetched++
      const html = await response.text()
      const products = era.parseCategoryPage(html, page.url, page.timestamp)

      console.log(`  Parsed ${products.length} products`)
      for (const p of products.slice(0, 5)) {
        console.log(`    ${p.styleId.padEnd(12)} ${(p.name || '').substring(0, 30).padEnd(30)} ${p.price ? `$${p.price}` : ''}`)
      }
      if (products.length > 5) {
        console.log(`    ... and ${products.length - 5} more`)
      }

      // Add to total (deduped)
      for (const p of products) {
        if (!parsedProducts.some(x => x.styleId === p.styleId)) {
          parsedProducts.push(p)
        }
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message}`)
    }
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n${'─'.repeat(70)}`)
  console.log(`SUMMARY: ${era.name}`)
  console.log(`${'─'.repeat(70)}`)
  console.log(`  Time:           ${elapsed}s`)
  console.log(`  Pages fetched:  ${pagesFetched}`)
  console.log(`  Unique products: ${parsedProducts.length}`)
  console.log(`  With price:     ${parsedProducts.filter(p => p.price).length}`)

  if (parsedProducts.length > 0) {
    console.log(`\nSample products:`)
    for (const p of parsedProducts.slice(0, 8)) {
      console.log(`  ${p.styleId.padEnd(12)} ${(p.name || '(no name)').substring(0, 30).padEnd(30)} ${p.price ? `$${p.price} ${p.currency || ''}` : ''}`)
    }
  }
  console.log('─'.repeat(70))
}

async function testEra(era: EraConfig) {
  const startTime = Date.now()

  console.log(`\n${'='.repeat(70)}`)
  console.log(`ERA: ${era.name}`)
  console.log(`Sample period: ${era.sampleMonth.from} - ${era.sampleMonth.to}`)
  console.log(`Timeout: ${ERA_TIMEOUT_MS / 1000}s`)
  console.log(`Mode: ${era.parseCategoryPage ? 'Category pages' : 'Product pages'}`)
  console.log('='.repeat(70))

  // Category page mode: fetch listing pages and extract multiple products
  if (era.parseCategoryPage) {
    await testCategoryEra(era, startTime)
    return
  }

  const productUrls: Array<{ url: string; styleId: string; timestamp: string }> = []
  let urlsFetched = 0
  let parseSuccess = 0
  let parseFailed = 0
  const parsedProducts: ParsedProduct[] = []

  // Phase 1: Query CDX API
  for (const pattern of era.urlPatterns) {
    if (Date.now() - startTime > ERA_TIMEOUT_MS) break

    const cdxUrl = `${cdxApi}?url=${encodeURIComponent(pattern)}` +
      `&matchType=prefix&output=json&from=${era.sampleMonth.from}&to=${era.sampleMonth.to}` +
      `&filter=statuscode:200&filter=mimetype:text/html&collapse=urlkey&limit=500`

    console.log(`\nQuerying CDX: ${pattern}`)

    try {
      await delay(500)
      const response = await fetch(cdxUrl)
      if (!response.ok) {
        console.log(`  CDX error: ${response.status}`)
        continue
      }

      const data = await response.json() as string[][]
      if (!Array.isArray(data) || data.length < 2) {
        console.log('  No results')
        continue
      }

      console.log(`  Found ${data.length - 1} URLs`)

      let matched = 0
      for (let i = 1; i < data.length; i++) {
        const [urlkey, timestamp, original] = data[i]
        const styleId = era.extractStyleId(original)
        if (styleId && !productUrls.some(p => p.styleId === styleId)) {
          productUrls.push({ url: original, styleId, timestamp })
          matched++
        }
      }
      console.log(`  Extracted ${matched} unique products`)
    } catch (e: any) {
      console.log(`  Error: ${e.message}`)
    }
  }

  console.log(`\nTotal unique products in CDX: ${productUrls.length}`)

  if (productUrls.length === 0) {
    console.log('  No products found for this era/month')
    return
  }

  // Phase 2: Fetch and parse product pages
  console.log(`\n--- Fetching and Parsing (until 30s timeout) ---\n`)

  for (const product of productUrls) {
    if (Date.now() - startTime > ERA_TIMEOUT_MS) {
      console.log(`\n[TIMEOUT] 30 seconds reached`)
      break
    }

    const archiveUrl = `${waybackApi}/web/${product.timestamp}/${product.url}`
    process.stdout.write(`  ${product.styleId}: `)

    try {
      await delay(500) // Rate limit

      const response = await fetch(archiveUrl, {
        headers: { 'User-Agent': 'Charmventory Test Bot' },
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) {
        console.log(`HTTP ${response.status}`)
        parseFailed++
        continue
      }

      urlsFetched++
      const html = await response.text()

      // Use era's parser
      const parsed = era.parseProductPage(html, product.url, product.timestamp)

      if (parsed && parsed.name) {
        parseSuccess++
        parsedProducts.push(parsed)
        console.log(`"${parsed.name?.substring(0, 40)}" ${parsed.price ? `$${parsed.price}` : ''}`)
      } else if (parsed) {
        parseSuccess++
        parsedProducts.push(parsed)
        console.log(`(no name) styleId=${parsed.styleId}`)
      } else {
        parseFailed++
        console.log(`PARSE FAILED`)
      }
    } catch (e: any) {
      parseFailed++
      console.log(`ERROR: ${e.message.substring(0, 40)}`)
    }
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n${'─'.repeat(70)}`)
  console.log(`SUMMARY: ${era.name}`)
  console.log(`${'─'.repeat(70)}`)
  console.log(`  Time:           ${elapsed}s`)
  console.log(`  CDX products:   ${productUrls.length}`)
  console.log(`  Pages fetched:  ${urlsFetched}`)
  console.log(`  Parsed OK:      ${parseSuccess}`)
  console.log(`  Parse failed:   ${parseFailed}`)
  console.log(`  Parse rate:     ${urlsFetched > 0 ? ((parseSuccess / urlsFetched) * 100).toFixed(0) : 0}%`)

  // Show sample parsed products
  if (parsedProducts.length > 0) {
    console.log(`\nSample parsed products:`)
    for (const p of parsedProducts.slice(0, 5)) {
      console.log(`  ${p.styleId.padEnd(12)} ${(p.name || '(no name)').substring(0, 35).padEnd(35)} ${p.price ? `$${p.price} ${p.currency || ''}` : ''}`)
    }
  }

  console.log('─'.repeat(70))
}

async function main() {
  const eraArg = process.argv[2]

  console.log('╔══════════════════════════════════════════════════════════════════════╗')
  console.log('║           Wayback Scraper Era Testing (30s per era)                  ║')
  console.log('╚══════════════════════════════════════════════════════════════════════╝')

  if (eraArg) {
    // Run specific era
    const era = eras.find(e => e.name === eraArg)
    if (!era) {
      console.error(`\nUnknown era: ${eraArg}`)
      console.error(`Available: ${eras.map(e => e.name).join(', ')}`)
      process.exit(1)
    }
    await testEra(era)
  } else {
    // Show available eras
    console.log('\nAvailable eras:')
    for (const era of eras) {
      console.log(`  - ${era.name.padEnd(15)} (sample: ${era.sampleMonth.from}-${era.sampleMonth.to})`)
    }
    console.log('\nRunning all eras...')

    for (const era of eras) {
      await testEra(era)
      await delay(2000)
    }
  }

  console.log('\n\n✓ Testing complete!')
  process.exit(0)
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
