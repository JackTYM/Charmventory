import 'dotenv/config'

// Test the name extraction with sample HTML
const testTitles = [
  'Silver charm, cameo\n\t\t\t\t -\n\t\t\t\tProduct catalog',
  'Jewelry - Genuine Jewelry - Official US Website\n\t\t\t\t -\n\t\t\t\tProduct catalog',
  'Bead Brown Oval Lights BCZ\n\t\t\t\t -\n\t\t\t\tProduct catalog',
  'Charm Pink Heart - PANDORA - Official Website',
  'Gold Ring with CZ - Jewelry - Genuine Jewelry',
]

function cleanName(name: string): string | null {
  let cleaned = name
    .split('\n')[0]
    .trim()
    .replace(/\s*-\s*(?:Product catalog|Official.*Website|Genuine Jewelry).*$/i, '')
    .replace(/^(?:Jewelry\s*-\s*)?(?:Genuine Jewelry\s*-\s*)?/i, '')
    .replace(/\s*-\s*PANDORA.*$/i, '')
    .replace(/^PANDORA\s*/i, '')
    .trim()

  if (!cleaned || cleaned.toLowerCase() === 'jewelry' || cleaned.length < 3) {
    return null
  }
  return cleaned
}

console.log('Testing name extraction:')
for (const title of testTitles) {
  const cleaned = cleanName(title)
  console.log(`  "${title.substring(0, 50)}..." => "${cleaned}"`)
}
