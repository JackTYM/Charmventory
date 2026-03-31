import 'dotenv/config'
import { db } from '../server/db'
import { charmSightings, charmDatabase, charmImages } from '../server/db/schema'
import { eq, like } from 'drizzle-orm'

const waybackApi = 'https://web.archive.org'
const cdxApi = 'https://web.archive.org/cdx/search/cdx'

interface ParsedProduct {
  styleId: string
  name?: string
  price?: number
  currency?: string
  imageUrl?: string
}

function parseOriginalV1(html: string): ParsedProduct | null {
  // Extract style ID from designerid attribute (the REAL Pandora style ID)
  const designerIdMatch = html.match(/designerid="([^"]+)"/i)
  if (!designerIdMatch) return null

  const styleId = designerIdMatch[1].toUpperCase()

  // Extract name from alt attribute on ItemImage
  const altMatch = html.match(/class="ItemImage"[^>]*alt="([^"]+)"/i) ||
                   html.match(/alt="([^"]+)"[^>]*class="ItemImage"/i)

  let name = ''
  if (altMatch) {
    // Remove the style ID suffix like "(15119GSA-5)"
    name = altMatch[1]
      .replace(/\s*\([^)]+\)\s*$/, '')
      .trim()
  }

  if (!name || name.length < 3) {
    name = `Product ${styleId}`
  }

  // Extract price
  let price: number | undefined
  let currency = 'USD'

  const priceMatch = html.match(/Retail price:\s*([\d,.]+)\s*(?:&nbsp;)?([A-Z]{3})/i) ||
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
    let imgSrc = imageMatch[1]
    if (imgSrc.startsWith('/web/')) {
      imgSrc = `https://web.archive.org${imgSrc}`
    }
    imageUrl = imgSrc
  }

  return { styleId, name, price, currency, imageUrl }
}

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  // Test with a few sample pages
  const testUrls = [
    { timestamp: '20100416073312', url: 'http://www.pandora.net:80/us/Jewelry/All/?item==132812' },
    { timestamp: '20100625022637', url: 'http://www.pandora.net:80/us/Jewelry/All/?item=14K+Charm+Golden+Disk+w/+Lavender+Natural+Pearl=99765' },
    { timestamp: '20100625022637', url: 'http://www.pandora.net:80/us/Jewelry/All/?item==130652' },
  ]

  console.log('Testing fixed 2008-2011 era parser:\n')

  for (const test of testUrls) {
    console.log(`Fetching ${test.url.substring(0, 60)}...`)

    try {
      const archiveUrl = `${waybackApi}/web/${test.timestamp}/${test.url}`
      const response = await fetch(archiveUrl, {
        headers: { 'User-Agent': 'Charmventory Bot' },
        signal: AbortSignal.timeout(15000)
      })

      if (!response.ok) {
        console.log(`  Error: ${response.status}`)
        continue
      }

      const html = await response.text()
      const product = parseOriginalV1(html)

      if (!product) {
        console.log('  Could not parse product')
        continue
      }

      console.log(`  Style ID: ${product.styleId}`)
      console.log(`  Name: ${product.name}`)
      console.log(`  Price: ${product.price} ${product.currency}`)
      console.log(`  Image: ${product.imageUrl?.substring(0, 60)}...`)
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
