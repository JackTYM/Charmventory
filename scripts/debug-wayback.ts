import 'dotenv/config'

// Debug the name extraction with actual page fetches

const waybackApi = 'https://web.archive.org'

function cleanName(rawName: string): string | null {
  console.log('  cleanName input:', JSON.stringify(rawName.substring(0, 80)))

  let name = rawName
    .split('\n')[0]
    .trim()
    .replace(/\s*-\s*(?:Product catalog|Official.*Website|Genuine Jewelry).*$/i, '')
    .replace(/^(?:Jewelry\s*-\s*)?(?:Genuine Jewelry\s*-\s*)?/i, '')
    .replace(/\s*-\s*PANDORA.*$/i, '')
    .replace(/\s*-\s*Jewelry$/i, '')
    .replace(/^PANDORA\s*/i, '')
    .trim()

  console.log('  cleanName output:', JSON.stringify(name))

  if (!name || name.toLowerCase() === 'jewelry' || name.length < 3) {
    return null
  }
  return name
}

async function testPage(timestamp: string, url: string, styleId: string) {
  console.log(`\nTesting ${styleId}: ${url}`)

  const archiveUrl = `${waybackApi}/web/${timestamp}/${url}`
  const response = await fetch(archiveUrl, {
    headers: { 'User-Agent': 'Charmventory Bot' }
  })

  if (!response.ok) {
    console.log('  Fetch error:', response.status)
    return
  }

  const html = await response.text()

  // Check URL format
  const urlWithNameMatch = url.match(/[?&]item=([^=]+)=(\d{5,})/i)
  const urlNoNameMatch = url.match(/[?&]item==(\d{5,})/i)

  console.log('  URL has name:', !!urlWithNameMatch)
  console.log('  URL no name:', !!urlNoNameMatch)

  let urlName: string | undefined
  if (urlWithNameMatch) {
    urlName = decodeURIComponent(urlWithNameMatch[1].replace(/\+/g, ' '))
    console.log('  URL name:', urlName)
  }

  // HTML extraction
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i)

  console.log('  H1 match:', h1Match ? JSON.stringify(h1Match[1].substring(0, 50)) : 'none')
  console.log('  Title match:', titleMatch ? JSON.stringify(titleMatch[1].substring(0, 50)) : 'none')

  // Final name
  let name = urlName || ''
  if (!name) {
    name = h1Match?.[1] || titleMatch?.[1] || ''
  }

  const finalName = cleanName(name) || `Charm ${styleId}`
  console.log('  Final name:', finalName)
}

async function main() {
  // Test a few different URL formats
  const testCases = [
    // URL with product name
    { timestamp: '20100625022637', url: 'http://www.pandora.net:80/us/Jewelry/All/?item=14K+Charm+Golden+Disk+w/+Lavender+Natural+Pearl=99765', styleId: '99765' },
    // URL without product name
    { timestamp: '20100625022637', url: 'http://www.pandora.net:80/us/Jewelry/All/?item==101806', styleId: '101806' },
    // Another without name (from AU)
    { timestamp: '20101130215619', url: 'http://www.pandora.net:80/au/Jewelry/All/?item==88110', styleId: '88110' },
  ]

  for (const test of testCases) {
    await testPage(test.timestamp, test.url, test.styleId)
    await new Promise(r => setTimeout(r, 1000))
  }

  process.exit(0)
}

main()
