import 'dotenv/config'

const waybackApi = 'https://web.archive.org'
const cdxApi = 'https://web.archive.org/cdx/search/cdx'

interface ParsedProduct {
  styleId: string
  name?: string
  price?: number
  currency?: string
  collection?: string
  imageUrl?: string
}

function parseWwwV1(html: string): ParsedProduct | null {
  // Extract from meta tags:
  // <meta name="id" content="791031"/>
  // <meta name="name" content="Kleid, Charm mit Anhänger"/>
  // <meta name="price" content="35,00 EUR"/>
  // <meta name="collection" content="Moments"/>

  const idMatch = html.match(/<meta\s+name="id"\s+content="([^"]+)"/i)
  if (!idMatch) return null

  const styleId = idMatch[1].toUpperCase()

  const nameMatch = html.match(/<meta\s+name="name"\s+content="([^"]+)"/i)
  const name = nameMatch ? decodeHtmlEntities(nameMatch[1]) : `Product ${styleId}`

  const priceMatch = html.match(/<meta\s+name="price"\s+content="([\d.,]+)\s*([A-Z]{3})"/i)
  let price: number | undefined
  let currency = 'USD'
  if (priceMatch) {
    // Handle European format (35,00) vs US format (35.00)
    price = parseFloat(priceMatch[1].replace(',', '.'))
    currency = priceMatch[2]
  }

  const collectionMatch = html.match(/<meta\s+name="collection"\s+content="([^"]+)"/i)
  const collection = collectionMatch ? collectionMatch[1] : undefined

  // Try to get image from og:image or product image
  const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                     html.match(/class="product-image"[^>]*src="([^"]+)"/i)
  let imageUrl: string | undefined
  if (imageMatch) {
    let imgSrc = imageMatch[1]
    if (imgSrc.startsWith('/web/')) {
      imgSrc = `https://web.archive.org${imgSrc}`
    }
    imageUrl = imgSrc
  }

  return { styleId, name, price, currency, collection, imageUrl }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&szlig;/g, 'ß')
}

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  console.log('Testing 2012-2016 era parser (www-v1):\n')

  // First, query CDX to find some actual product URLs
  console.log('Querying CDX for sample product URLs...\n')

  const urlPatterns = [
    'www.pandora.net/en-gb/explore/products/bracelets/',
    'www.pandora.net/de-de/explore/products/charms/',
    'www.pandora.net/en-us/explore/products/charms/',
  ]

  const testUrls: Array<{ timestamp: string; url: string }> = []

  for (const pattern of urlPatterns) {
    console.log(`  Querying ${pattern}...`)
    const cdxUrl = `${cdxApi}?url=${encodeURIComponent(pattern)}` +
      `&matchType=prefix&output=json&from=20120101&to=20161231` +
      `&filter=statuscode:200&filter=mimetype:text/html&collapse=urlkey&limit=5`

    try {
      await delay(1000)
      const response = await fetch(cdxUrl)
      if (!response.ok) {
        console.log(`    Error: ${response.status}`)
        continue
      }

      const data = await response.json()
      if (!Array.isArray(data) || data.length < 2) {
        console.log(`    No results`)
        continue
      }

      console.log(`    Found ${data.length - 1} URLs`)

      // Take first few results
      for (let i = 1; i < Math.min(data.length, 4); i++) {
        const [urlkey, timestamp, original] = data[i]
        testUrls.push({ timestamp, url: original })
      }
    } catch (e: any) {
      console.log(`    Error: ${e.message}`)
    }
  }

  if (testUrls.length === 0) {
    console.log('\nNo test URLs found. Trying with known working URL...')
    // Fallback to a known URL from previous testing
    testUrls.push({
      timestamp: '20140915',
      url: 'http://www.pandora.net/de-de/explore/products/charms/791031'
    })
  }

  console.log(`\nTesting ${testUrls.length} URLs:\n`)

  for (const test of testUrls) {
    console.log(`Fetching: ${test.url}`)
    console.log(`  Timestamp: ${test.timestamp}`)

    try {
      const archiveUrl = `${waybackApi}/web/${test.timestamp}/${test.url}`
      const response = await fetch(archiveUrl, {
        headers: { 'User-Agent': 'Charmventory Bot' },
        signal: AbortSignal.timeout(15000)
      })

      if (!response.ok) {
        console.log(`  HTTP Error: ${response.status}`)
        continue
      }

      const html = await response.text()

      // Debug: show what meta tags we find
      const metaTags = html.match(/<meta\s+name="[^"]+"\s+content="[^"]+"/gi)
      if (metaTags) {
        console.log(`  Found ${metaTags.length} meta tags with name attribute`)
        const relevantMeta = metaTags.filter(m =>
          m.includes('name="id"') ||
          m.includes('name="name"') ||
          m.includes('name="price"') ||
          m.includes('name="collection"')
        )
        if (relevantMeta.length > 0) {
          console.log(`  Relevant meta tags:`)
          for (const m of relevantMeta) {
            console.log(`    ${m}`)
          }
        }
      }

      const product = parseWwwV1(html)

      if (!product) {
        console.log('  Could not parse product (no id meta tag found)')
        // Show first 500 chars of HTML for debugging
        console.log(`  HTML preview: ${html.substring(0, 500).replace(/\s+/g, ' ')}...`)
        continue
      }

      console.log(`  Style ID: ${product.styleId}`)
      console.log(`  Name: ${product.name}`)
      console.log(`  Price: ${product.price} ${product.currency}`)
      console.log(`  Collection: ${product.collection || 'N/A'}`)
      console.log(`  Image: ${product.imageUrl?.substring(0, 60) || 'N/A'}...`)
      console.log()

      await delay(1000)
    } catch (e: any) {
      console.log(`  Error: ${e.message}`)
    }
  }

  console.log('Done!')
  process.exit(0)
}

main()
