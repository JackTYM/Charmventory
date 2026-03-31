import 'dotenv/config'

// Test each wayback era by checking a sample month

const cdxApi = 'https://web.archive.org/cdx/search/cdx'
const waybackApi = 'https://web.archive.org'

interface EraConfig {
  name: string
  urlPatterns: string[]
  sampleMonth: { from: string; to: string }
  extractStyleId: (url: string) => string | null
}

const eras: EraConfig[] = [
  {
    name: 'estore-v1 (2012-2015)',
    urlPatterns: ['estore-us.pandora.net/en-us/'],
    sampleMonth: { from: '20140601', to: '20140630' },
    extractStyleId: (url) => {
      const match = url.match(/\/(\d{6}[A-Z0-9]*)\.html/i)
      return match ? match[1].toUpperCase() : null
    }
  },
  {
    name: 'demandware-v1 (2016-2019)',
    urlPatterns: ['us.pandora.net/en/'],
    sampleMonth: { from: '20170601', to: '20170630' },
    extractStyleId: (url) => {
      const match = url.match(/\/(\d{6}[A-Z0-9]*)\.html/i)
      return match ? match[1].toUpperCase() : null
    }
  },
  {
    name: 'demandware-v2 (2020-2022)',
    urlPatterns: ['us.pandora.net/en/'],
    sampleMonth: { from: '20210601', to: '20210630' },
    extractStyleId: (url) => {
      const match = url.match(/\/(\d{6}[A-Z0-9]*)\.html/i)
      return match ? match[1].toUpperCase() : null
    }
  },
  {
    name: 'pwa-v1 (2023+)',
    urlPatterns: ['us.pandora.net/en/'],
    sampleMonth: { from: '20240101', to: '20240131' },
    extractStyleId: (url) => {
      const match = url.match(/\/(\d{6}[A-Z0-9]*)\.html/i)
      return match ? match[1].toUpperCase() : null
    }
  }
]

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function testEra(era: EraConfig) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Testing: ${era.name}`)
  console.log(`Sample period: ${era.sampleMonth.from} - ${era.sampleMonth.to}`)
  console.log('='.repeat(60))

  const productUrls: Array<{ url: string; styleId: string; timestamp: string }> = []

  for (const pattern of era.urlPatterns) {
    const cdxUrl = `${cdxApi}?url=${encodeURIComponent(pattern)}` +
      `&matchType=prefix&output=json&from=${era.sampleMonth.from}&to=${era.sampleMonth.to}` +
      `&filter=statuscode:200&filter=mimetype:text/html&collapse=urlkey&limit=500`

    console.log(`\nQuerying CDX for: ${pattern}`)

    try {
      await delay(1000)
      const response = await fetch(cdxUrl)
      if (!response.ok) {
        console.log(`  CDX error: ${response.status}`)
        continue
      }

      const data = await response.json()
      if (!Array.isArray(data) || data.length < 2) {
        console.log('  No results from CDX')
        continue
      }

      console.log(`  CDX returned ${data.length - 1} URLs`)

      // Extract product URLs
      for (let i = 1; i < data.length; i++) {
        const [urlkey, timestamp, original] = data[i]
        const styleId = era.extractStyleId(original)
        if (styleId && !productUrls.some(p => p.styleId === styleId)) {
          productUrls.push({ url: original, styleId, timestamp })
        }
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message}`)
    }
  }

  console.log(`\nFound ${productUrls.length} unique product URLs`)

  if (productUrls.length === 0) {
    console.log('  No products found for this era/month')
    return
  }

  // Show sample URLs
  console.log('\nSample product URLs:')
  for (const p of productUrls.slice(0, 5)) {
    console.log(`  ${p.styleId}: ${p.url.substring(0, 80)}...`)
  }

  // Test fetching one product page
  const testProduct = productUrls[0]
  console.log(`\nTesting fetch of ${testProduct.styleId}...`)

  try {
    const archiveUrl = `${waybackApi}/web/${testProduct.timestamp}/${testProduct.url}`
    const response = await fetch(archiveUrl, {
      headers: { 'User-Agent': 'Charmventory Bot' },
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      console.log(`  Fetch failed: ${response.status}`)
      return
    }

    const html = await response.text()
    console.log(`  Fetched ${html.length} bytes`)

    // Try to extract product info
    const namePatterns = [
      /"name"\s*:\s*"([^"]+)"/i,
      /"productName"\s*:\s*"([^"]+)"/i,
      /itemprop="name"[^>]*>([^<]+)/i,
      /<h1[^>]*class="[^"]*product[^"]*name[^"]*"[^>]*>([^<]+)/i,
      /<title>([^<|]+?)(?:\s*[-|]|<)/i,
    ]

    let name = null
    for (const pattern of namePatterns) {
      const match = html.match(pattern)
      if (match) {
        name = match[1].trim()
        console.log(`  Found name: "${name}" (pattern: ${pattern.source.substring(0, 30)}...)`)
        break
      }
    }

    if (!name) {
      console.log('  Could not extract name from page')
    }

    // Check for price
    const priceMatch = html.match(/\$\s*([\d,]+(?:\.\d{2})?)/i) ||
                       html.match(/"price"\s*:\s*([\d.]+)/i)
    if (priceMatch) {
      console.log(`  Found price: $${priceMatch[1]}`)
    }

  } catch (e: any) {
    console.log(`  Fetch error: ${e.message}`)
  }
}

async function main() {
  console.log('Wayback Era Testing')
  console.log('Testing each era with a sample month\n')

  for (const era of eras) {
    await testEra(era)
    await delay(2000)
  }

  console.log('\n\nDone!')
  process.exit(0)
}

main()
